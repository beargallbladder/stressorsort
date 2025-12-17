import { StressorTag } from "./tags";

export type FeatureInputs = {
	nowUtcIso: string;
	dealer_zip: string;
	geo: { lat: number; lon: number } | null;
	vin: string;
	vehicle: { model_year?: number; make?: string; model?: string } | null;
	recalls: { open_recall_count: number } | null;
	weatherDaily: any[];
	forecastHourly: any[];
	alerts: any[];
	holidaysIcs: string | null;
};

export type ComputedFeatures = {
	weather_stress: number; // 0..100
	forecast_urgency: number; // 0..100
	action_timing: number; // 0..100
	vehicle_context: number; // 0..100
	reasons: StressorTag[];
};

export function computeFeatures(inputs: FeatureInputs): ComputedFeatures {
	const reasons: StressorTag[] = [];
	let weather_stress = 0;
	let forecast_urgency = 0;
	let action_timing = 100;
	let vehicle_context = 0;

	// Very naive initial heuristics; refine in later pass
	// Weather stress from alerts presence
	if ((inputs.alerts || []).length > 0) {
		weather_stress += 50;
		reasons.push("STORM_ALERT");
	}
	// Forecast urgency if next 24h show low temps or precip prob high
	const next24 = (inputs.forecastHourly || []).slice(0, 24);
	const minTemp = Math.min(
		...next24
			.map((h: any) => Number(h.temp_f))
			.filter((v) => Number.isFinite(v)),
		Infinity,
	);
	const maxPrecipProb = Math.max(
		...next24
			.map((h: any) => Number(h.precip_prob))
			.filter((v) => Number.isFinite(v)),
		0,
	);
	if (minTemp !== Infinity && minTemp <= 20) {
		forecast_urgency += 40;
		reasons.push("THERMAL_COLD");
	}
	if (maxPrecipProb >= 0.6) {
		forecast_urgency += 30;
		reasons.push("SNOW_ICE_RISK");
	}

	// Vehicle context
	const year = inputs.vehicle?.model_year;
	if (year && new Date().getUTCFullYear() - year >= 8) {
		vehicle_context += 20;
		reasons.push("OLDER_VEHICLE_COHORT");
	}
	if ((inputs.recalls?.open_recall_count || 0) > 0) {
		vehicle_context += 30;
		reasons.push("RECALL_ATTENTION");
	}

	// Timing multipliers (weekend-adjacent, month boundary)
	const now = new Date(inputs.nowUtcIso);
	const day = now.getUTCDay(); // 0 Sun - 6 Sat
	if (day === 0 || day === 6) {
		action_timing *= 0.9;
		reasons.push("WEEKEND_ADJACENCY");
	}
	const date = now.getUTCDate();
	if (date >= 28 || date <= 2) {
		action_timing *= 1.05;
		reasons.push("MONTH_BOUNDARY");
	}

	return {
		weather_stress: clamp01(weather_stress / 100) * 100,
		forecast_urgency: clamp01(forecast_urgency / 100) * 100,
		action_timing: clamp01(action_timing / 100) * 100,
		vehicle_context: clamp01(vehicle_context / 100) * 100,
		reasons: Array.from(new Set(reasons)),
	};
}

function clamp01(n: number) {
	return Math.max(0, Math.min(1, n));
}


