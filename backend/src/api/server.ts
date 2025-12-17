import express from "express";
import { pg, withTransaction } from "../db/client";
import pino from "pino";
import dotenv from "dotenv";
import { z } from "zod";
import { maskVin } from "../utils/vin";
import { computeAndPersistScoreForLead } from "../jobs/enrichLead";
import { rateLimit } from "./utilRateLimit";
import { decodeVinBatch } from "../providers/nhtsa";
import { sha256Hex } from "../utils/crypto";
import { mapTagsToOffers } from "../services/offers";

dotenv.config();

const logger = pino({
	level: process.env.LOG_LEVEL || "info",
	redact: {
		paths: ["req.body.*.vin", "vin"],
		censor: "***REDACTED***",
	},
});

const app = express();
app.use(express.json({ limit: "1mb" }));

// Public health check BEFORE auth
app.get("/api/health", async (_req, res) => {
	const r = await pg.query("select 1 as ok");
	res.json({ ok: true, db: r.rows[0].ok === 1 });
});

// Simple API key auth
app.use((req, res, next) => {
	if (req.path === "/api/health") return next();
	const provided = req.header("x-api-key") || req.header("X-API-Key");
	const expected = process.env.API_KEY;
	if (!expected || provided === expected) {
		return next();
	}
	return res.status(401).json({ error: "unauthorized" });
});

// Light rate limiter (in-memory, per-key)
app.use(rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MIN || 120) }));

const IngestLeadSchema = z.object({
	lead_id: z.string().min(1),
	vin: z.string().min(5),
	dealer_id: z.string().min(1),
	dealer_zip: z.string().min(3),
	lead_type: z.string().optional(),
});

app.post("/api/leads/ingest", async (req, res) => {
	try {
		const body = z.array(IngestLeadSchema).parse(req.body);
		if (body.length === 0) {
			return res.json({ inserted: 0 });
		}
		// Batch insert (VALUES list) to avoid one-by-one inserts [[memory:12227534]]
		const values: string[] = [];
		const params: any[] = [];
		let idx = 1;
		for (const row of body) {
			values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
			params.push(row.lead_id, row.vin, row.dealer_id, row.dealer_zip, row.lead_type ?? null);
		}
		const sql = `
			insert into leads (lead_id, vin, dealer_id, dealer_zip, lead_type)
			values ${values.join(",")}
			on conflict (lead_id) do update set
				vin = excluded.vin,
				dealer_id = excluded.dealer_id,
				dealer_zip = excluded.dealer_zip,
				lead_type = excluded.lead_type,
				status = case when leads.status = 'failed' then 'new' else leads.status end,
				updated_at = now()
		`;
		await pg.query(sql, params);
		// vPIC batch decode for new VINs (up to 50 per call)
		const vins = Array.from(new Set(body.map((b) => b.vin)));
		if (vins.length) {
			const place = vins.map((_, i) => `($${i + 1})`).join(",");
			const missingFacts = await pg.query(
				`select v.vin from (values ${place}) as v(vin)
         left join vehicle_facts f on f.vin = v.vin
         where f.vin is null`,
				vins,
			);
			const toDecode = missingFacts.rows.map((r) => String(r.vin));
			while (toDecode.length) {
				const chunk = toDecode.splice(0, 50);
				try {
					const decoded = await decodeVinBatch(chunk);
					const values2: string[] = [];
					const params2: any[] = [];
					let j = 1;
					for (const vin of chunk) {
						const d = decoded[vin] || {};
						values2.push(`($${j++}, $${j++}, $${j++}, $${j++}, $${j++}, $${j++})`);
						params2.push(
							vin,
							sha256Hex(vin),
							d.model_year ?? null,
							d.make ?? null,
							d.model ?? null,
							d.raw ?? {},
						);
					}
					await pg.query(
						`insert into vehicle_facts (vin, vin_hash, model_year, make, model, decoded_json, decoded_at)
             values ${values2.join(",")}
             on conflict (vin) do update set vin_hash = excluded.vin_hash, model_year = excluded.model_year, make = excluded.make, model = excluded.model, decoded_json = excluded.decoded_json, decoded_at = now()`,
						params2,
					);
				} catch {}
			}
		}
		// Kick off enrichment best-effort (non-blocking)
		for (const row of body) {
			// Fire and forget; worker service can also run continuously
			computeAndPersistScoreForLead(row.lead_id).catch(() => {});
		}
		res.json({ inserted: body.length });
	} catch (err: any) {
		logger.error({ err }, "ingest failed");
		res.status(400).json({ error: "invalid_request" });
	}
});

app.get("/api/dealers/:dealerId/leads", async (req, res) => {
	const dealerId = req.params.dealerId;
	try {
		const rows = await pg.query(
			`
      select l.lead_id, l.vin, l.dealer_id, l.dealer_zip,
             s.priority_score, s.bucket, s.reasons, s.scored_at
      from leads l
      left join lead_scores s on s.lead_id = l.lead_id
      where l.dealer_id = $1
      order by coalesce(s.priority_score, -1) desc, l.created_at desc
      `,
			[dealerId],
		);
		const data = rows.rows.map((r: any) => ({
			lead_id: r.lead_id,
			vin_masked: maskVin(r.vin),
			priority_score: r.priority_score ?? null,
			bucket: r.bucket ?? null,
			reasons: r.reasons ?? [],
			offers: mapTagsToOffers(r.reasons ?? []),
			scored_at: r.scored_at ?? null,
		}));
		res.json({ dealer_id: dealerId, leads: data });
	} catch (err: any) {
		logger.error({ err }, "dealer leads failed");
		res.status(500).json({ error: "server_error" });
	}
});

app.get("/api/leads/:leadId/explain", async (req, res) => {
	const leadId = req.params.leadId;
	try {
		const fv = await pg.query(
			`
      select feature_vector_id, lead_id, vin, dealer_zip, run_date, feature_version, features, inputs, created_at
      from feature_vectors
      where lead_id = $1
      order by run_date desc, created_at desc
      limit 1
      `,
			[leadId],
		);
		const score = await pg.query(
			`
      select priority_score, bucket, reasons, score_version, scored_at
      from lead_scores
      where lead_id = $1
      `,
			[leadId],
		);
		res.json({
			lead_id: leadId,
			feature_vector: fv.rows[0] || null,
			score: score.rows[0] || null,
			offers: mapTagsToOffers(score.rows[0]?.reasons ?? []),
		});
	} catch (err: any) {
		logger.error({ err }, "explain failed");
		res.status(500).json({ error: "server_error" });
	}
});

const EventSchema = z.object({
	lead_id: z.string().min(1),
	dealer_id: z.string().min(1),
	event_type: z.string().min(1), // view/click/call/appt/close
	event_ts: z.string().datetime(),
	meta: z.record(z.any()).optional(),
});

app.post("/api/events", async (req, res) => {
	try {
		const body = EventSchema.parse(req.body);
		await pg.query(
			`
      insert into lead_events (lead_id, dealer_id, event_type, event_ts, meta)
      values ($1, $2, $3, $4, coalesce($5, '{}'::jsonb))
      `,
			[body.lead_id, body.dealer_id, body.event_type, body.event_ts, body.meta ?? {}],
		);
		res.json({ ok: true });
	} catch (err: any) {
		logger.error({ err }, "event insert failed");
		res.status(400).json({ error: "invalid_request" });
	}
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
	logger.info({ port }, "API service running");
});


