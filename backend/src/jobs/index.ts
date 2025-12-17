import dotenv from "dotenv";
import pino from "pino";
import { pg } from "../db/client";
import { computeAndPersistScoreForLead } from "./enrichLead";

dotenv.config();
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

async function runLoop() {
	logger.info("Worker started");
	while (true) {
		try {
			// Pull a lead needing scoring (new or processing stale)
			const res = await pg.query(
				`select lead_id from leads
         where status in ('new','processing')
         order by updated_at asc
         limit 1`,
			);
			if (res.rowCount === 0) {
				await new Promise((r) => setTimeout(r, 1000));
				continue;
			}
			const leadId = res.rows[0].lead_id as string;
			await pg.query(`update leads set status = 'processing', updated_at = now() where lead_id = $1`, [
				leadId,
			]);
			await computeAndPersistScoreForLead(leadId);
		} catch (err: any) {
			logger.error({ err }, "worker iteration failed");
			await new Promise((r) => setTimeout(r, 1500));
		}
	}
}

runLoop().catch((err) => {
	console.error(err);
	process.exit(1);
});


