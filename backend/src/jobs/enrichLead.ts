import { pg } from "../db/client";
import { geocodeZip } from "../providers/zips";
import { decodeVinWithVpic, fetchRecallsByVin } from "../providers/nhtsa";
import { getPoint, getHourlyForecast, getAlertsForArea } from "../providers/nws";
import { getDailyHistory } from "../providers/noaa";
import { getFederalHolidaysIcs } from "../providers/holidays";
import { computeFeatures } from "../scoring/features";
import { scoreFromFeatures } from "../scoring/scoring";
import { identifyVehicleClass } from "../scoring/lookup/identifyVehicleClass";
import { identifyScenario } from "../scoring/lookup/identifyScenario";
import { scoreLeadViaLookup } from "../scoring/lookup/scoreLeadViaLookup";
import { sha256Hex } from "../utils/crypto";
import { getOrResolveStation } from "../services/noaaStation";

export async function computeAndPersistScoreForLead(leadId: string): Promise<void> {
	// Load lead
	const leadRes = await pg.query(
		`select lead_id, vin, dealer_zip from leads where lead_id = $1`,
		[leadId],
	);
	if (leadRes.rowCount === 0) return;
	const lead = leadRes.rows[0] as { lead_id: string; vin: string; dealer_zip: string };
	const vinHash = sha256Hex(lead.vin);

	// Resolve zip -> lat/lon (cache in zip_geo)
	let zip = await pg.query(`select zip, lat, lon, state from zip_geo where zip = $1`, [
		lead.dealer_zip,
	]);
	let geo: { lat: number; lon: number } | null = null;
	if (zip.rowCount === 0) {
		const z = await geocodeZip(lead.dealer_zip);
		if (z) {
			await pg.query(
				`insert into zip_geo (zip, lat, lon, state) values ($1,$2,$3,$4)
         on conflict (zip) do update set lat = excluded.lat, lon = excluded.lon, state = excluded.state, updated_at = now()`,
				[z.zip, z.lat, z.lon, z.state ?? null],
			);
			geo = { lat: z.lat, lon: z.lon };
		}
	} else {
		geo = { lat: Number(zip.rows[0].lat), lon: Number(zip.rows[0].lon) };
	}

	// Fetch vehicle facts (cache)
	let facts = await pg.query(`select vin, model_year, make, model from vehicle_facts where vin = $1`, [
		lead.vin,
	]);
	if (facts.rowCount === 0) {
		const decoded = await decodeVinWithVpic(lead.vin);
		await pg.query(
			`insert into vehicle_facts (vin, vin_hash, model_year, make, model, decoded_json, decoded_at)
       values ($1,$2,$3,$4,$5,$6, now())
       on conflict (vin) do update set vin_hash = excluded.vin_hash, model_year = excluded.model_year, make = excluded.make, model = excluded.model, decoded_json = excluded.decoded_json, decoded_at = now()`,
			[lead.vin, vinHash, decoded.model_year ?? null, decoded.make ?? null, decoded.model ?? null, decoded.raw],
		);
		facts = await pg.query(`select vin, model_year, make, model from vehicle_facts where vin = $1`, [
			lead.vin,
		]);
	}
	const vehicle = facts.rows[0] || null;

	// Fetch recalls (cache)
	let recall: { open_recall_count: number } | null = null;
	if ((process.env.RECALLS_MODE || "disabled") !== "disabled") {
		let recalls = await pg.query(
			`select vin, open_recall_count, recalls_json from vehicle_recalls where vin = $1`,
			[lead.vin],
		);
		if (recalls.rowCount === 0) {
			const r = await fetchRecallsByVin(lead.vin);
			await pg.query(
				`insert into vehicle_recalls (vin, vin_hash, open_recall_count, recalls_json, last_checked_at)
       values ($1,$2,$3,$4, now())
       on conflict (vin) do update set vin_hash = excluded.vin_hash, open_recall_count = excluded.open_recall_count, recalls_json = excluded.recalls_json, last_checked_at = now()`,
				[lead.vin, vinHash, r.open_recall_count, r.raw],
			);
			recalls = await pg.query(
				`select vin, open_recall_count, recalls_json from vehicle_recalls where vin = $1`,
				[lead.vin],
			);
		}
		recall = recalls.rows[0] ? { open_recall_count: Number(recalls.rows[0].open_recall_count) || 0 } : null;
	}

	// Weather: forecast + alerts
	let forecastHourly: any[] = [];
	let alertsRaw: any[] = [];
	if (geo) {
		try {
			const point = await getPoint(geo.lat, geo.lon);
			const forecastRes = await getHourlyForecast(point.gridId, point.gridX, point.gridY);
			forecastHourly =
				forecastRes?.properties?.periods?.map((p: any) => ({
					startTime: p.startTime,
					temp_f: Number(p.temperature),
					precip_prob: Number(p.probabilityOfPrecipitation?.value || 0) / 100,
				})) ?? [];
		} catch {}
		try {
			const alerts = await getAlertsForArea(geo.lat, geo.lon);
			alertsRaw = alerts?.features ?? [];
		} catch {}
	}

	// Weather: daily history (last 30 days) placeholder (requires NOAA token)
	const today = new Date();
	const start = new Date(today.getTime() - 29 * 86400000);
	const startIso = start.toISOString().slice(0, 10);
	const endIso = today.toISOString().slice(0, 10);
	let weatherDaily: any[] = [];
	if (geo) {
		try {
			// Resolve and cache station (even if unused yet)
			await getOrResolveStation(lead.dealer_zip, geo.lat, geo.lon, startIso, endIso);
			const hist = await getDailyHistory(geo.lat, geo.lon, startIso, endIso);
			weatherDaily = hist?.results ?? [];
		} catch {}
	}

	// Holidays (ICS text)
	let holidaysIcs: string | null = null;
	try {
		holidaysIcs = await getFederalHolidaysIcs();
	} catch {
		holidaysIcs = null;
	}

	const nowIso = new Date().toISOString();
	const inputs = {
		nowUtcIso: nowIso,
		dealer_zip: lead.dealer_zip,
		geo,
		vin: lead.vin,
		vehicle: vehicle
			? {
					model_year: vehicle.model_year ? Number(vehicle.model_year) : undefined,
					make: vehicle.make || undefined,
					model: vehicle.model || undefined,
			  }
			: null,
		recalls: recall ? { open_recall_count: Number(recall.open_recall_count) || 0 } : null,
		weatherDaily,
		forecastHourly,
		alerts: alertsRaw,
		holidaysIcs,
	};

	// Choose scoring mode: lookup tensor or compute fallback
	const mode = process.env.SCORING_MODE || "lookup";
	let scoredScore = 0;
	let scoredBucket: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" = "LOW";
	let scoredReasons: string[] = [];
	let scoreVersion = process.env.TENSOR_VERSION || "v1.0.0";
	let features: any = null;

	if (mode === "lookup") {
		const vehicleClassId = identifyVehicleClass({
			make: vehicle?.make || undefined,
			model: vehicle?.model || undefined,
			model_year: vehicle?.model_year ? Number(vehicle.model_year) : undefined,
			drivetrain: undefined,
			powertrain: undefined,
			platform_bucket: undefined,
		});
		const scen = identifyScenario({
			weatherDaily,
			forecastHourly,
			alerts: alertsRaw,
			nowUtcIso: nowIso,
			holidaysIcs,
		});
		const lookup = await scoreLeadViaLookup(vehicleClassId, scen.scenario_id);
		scoredScore = lookup.score;
		scoredReasons = lookup.reasons;
		scoreVersion = lookup.model_version;
		// bucket from score
	} else {
		features = computeFeatures(inputs);
		const scored = scoreFromFeatures(features);
		scoredScore = scored.score;
		scoredReasons = scored.reasons;
		scoreVersion = scored.version;
	}
	if (scoredScore >= 85) scoredBucket = "CRITICAL";
	else if (scoredScore >= 65) scoredBucket = "HIGH";
	else if (scoredScore >= 40) scoredBucket = "MODERATE";

	// Deterministic A/B assignment
	const variant = (hashString(lead.lead_id) % 2 === 0) ? "control" : "treatment";
	const runDate = nowIso.slice(0, 10);

	await pg.query(
		`insert into feature_vectors (lead_id, vin, vin_hash, dealer_zip, run_date, feature_version, features, inputs)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
		[
			lead.lead_id,
			lead.vin,
			vinHash,
			lead.dealer_zip,
			runDate,
			scoreVersion,
			features ?? {},
			inputs,
		],
	);

	await pg.query(
		`insert into lead_scores (lead_id, priority_score, bucket, reasons, score_version, variant, scored_at)
     values ($1,$2,$3,$4,$5,$6, now())
     on conflict (lead_id) do update set priority_score = excluded.priority_score, bucket = excluded.bucket, reasons = excluded.reasons, score_version = excluded.score_version, variant = excluded.variant, scored_at = now()`,
		[lead.lead_id, scoredScore, scoredBucket, scoredReasons, scoreVersion, variant],
	);

	await pg.query(`update leads set status = 'scored', updated_at = now() where lead_id = $1`, [
		lead.lead_id,
	]);
}

function hashString(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h >>> 0;
}


