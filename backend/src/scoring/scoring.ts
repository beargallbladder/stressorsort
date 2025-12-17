import { ComputedFeatures } from "./features";
import { loadScoreConfig } from "./weights";
import { StressorTag } from "./tags";

export type ScoreResult = {
	score: number; // 0..100
	bucket: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
	reasons: StressorTag[];
	version: string;
};

export function scoreFromFeatures(f: ComputedFeatures): ScoreResult {
	const cfg = loadScoreConfig();
	const base =
		f.weather_stress * cfg.weights.weather_stress +
		f.forecast_urgency * cfg.weights.forecast_urgency +
		f.action_timing * cfg.weights.action_timing +
		f.vehicle_context * cfg.weights.vehicle_context;
	// Normalize weights assume they sum ~1.0
	const score = Math.round(base);
	let bucket: ScoreResult["bucket"] = "LOW";
	if (score >= 85) bucket = "CRITICAL";
	else if (score >= 65) bucket = "HIGH";
	else if (score >= 40) bucket = "MODERATE";
	return { score, bucket, reasons: f.reasons, version: cfg.version };
}


