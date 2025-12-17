import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pg } from "../db/client";

async function run() {
	const p = join(process.cwd(), "..", "..", "config", "scenario_bins.json");
	const cfg = JSON.parse(readFileSync(p, "utf8")) as any;
	const version = cfg.version;

	const colds = ["none", "mild", "hard", "extreme"] as const;
	const vols = ["low", "med", "high"] as const;
	const freezes = ["0", "1-2", "3+"] as const;
	const snows = ["none", "some", "high"] as const;
	const urgencies = ["none", "cold-front", "storm-alert"] as const;
	const timings = ["weekday-high", "monday-low", "weekend", "holiday-prox", "month-end"] as const;

	for (const cold of colds)
		for (const volatility of vols)
			for (const freeze_thaw of freezes)
				for (const snow_ice of snows)
					for (const forecast_urgency of urgencies)
						for (const timing of timings) {
							const bins = {
								cold,
								volatility,
								freeze_thaw,
								snow_ice,
								forecast_urgency,
								timing,
								version,
							};
							const scenario_id = JSON.stringify(bins);
							const scenario_hash = scenario_id;
							await pg.query(
								`insert into scenarios (scenario_id, bins_json, scenario_hash, version)
                 values ($1,$2,$3,$4)
                 on conflict (scenario_id) do nothing`,
								[scenario_id, { cold, volatility, freeze_thaw, snow_ice, forecast_urgency, timing }, scenario_hash, version],
							);
						}

	await pg.end();
}

run().catch((e) => {
	console.error(e);
	process.exit(1);
});


