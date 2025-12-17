import { pg } from "../db/client";

async function run() {
	const version = process.env.TENSOR_VERSION || "v1.0.0";
	// Simple deterministic rules for initial scores
	const classes = await pg.query(
		`select vehicle_class_id, platform_bucket, year_start, year_end from vehicle_classes`,
	);
	const scenarios = await pg.query(`select scenario_id, bins_json from scenarios`);

	for (const c of classes.rows) {
		for (const s of scenarios.rows) {
			const bins = s.bins_json || {};
			let score = 0;
			const reasons: string[] = [];
			let confidence = 0.7;
			// age boost
			const mid = ((Number(c.year_start) || 0) + (Number(c.year_end) || 0)) / 2;
			const age = new Date().getUTCFullYear() - mid;
			if (age >= 7) score += 10;
			// cold & snow
			if (bins.cold === "hard") score += 15;
			if (bins.cold === "extreme") score += 25;
			if (bins.snow_ice === "some") score += 10, reasons.push("SNOW_ICE_RISK");
			if (bins.snow_ice === "high") score += 20, reasons.push("SNOW_ICE_RISK");
			// volatility and freeze-thaw
			if (bins.volatility === "high") score += 10;
			if (bins.freeze_thaw === "3+") score += 10, reasons.push("FREEZE_THAW");
			// urgency
			if (bins.forecast_urgency === "cold-front") score += 10;
			if (bins.forecast_urgency === "storm-alert") score += 25, reasons.push("STORM_ALERT");
			// timing
			if (bins.timing === "holiday-prox") score += 5, reasons.push("HOLIDAY_PROXIMITY");
			if (bins.timing === "month-end") score += 5, reasons.push("MONTH_BOUNDARY");
			// clamp
			score = Math.max(0, Math.min(100, score));
			await pg.query(
				`insert into vehicle_scenario_scores (vehicle_class_id, scenario_id, score, reasons, confidence, model_version)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (vehicle_class_id, scenario_id) do update set score = excluded.score, reasons = excluded.reasons, confidence = excluded.confidence, model_version = excluded.model_version`,
				[c.vehicle_class_id, s.scenario_id, score, reasons, confidence, version],
			);
		}
	}
	await pg.end();
}

run().catch((e) => {
	console.error(e);
	process.exit(1);
});


