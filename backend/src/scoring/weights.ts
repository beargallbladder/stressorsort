import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ScoreConfig = {
	version: string;
	weights: {
		weather_stress: number;
		forecast_urgency: number;
		action_timing: number;
		vehicle_context: number;
	};
	caps: {
		action_timing_multiplier_min: number;
		action_timing_multiplier_max: number;
	};
};

let cached: ScoreConfig | null = null;

export function loadScoreConfig(): ScoreConfig {
	if (cached) return cached;
	const p = join(process.cwd(), "..", "..", "config", "score_weights.json");
	const raw = readFileSync(p, "utf8");
	cached = JSON.parse(raw) as ScoreConfig;
	return cached;
}


