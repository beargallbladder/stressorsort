import { readFileSync } from "node:fs";
import { join } from "node:path";

type Bins = {
	version: string;
	cold_thresholds_f: { mild: number; hard: number; extreme: number };
	volatility_thresholds_f: { low: number; med: number; high: number };
	freeze_thaw_cycles_bins: number[];
	snow_ice_prob_thresholds: { none: number; some: number; high: number };
	timing_categories: string[];
};

let cached: Bins | null = null;
function loadBins(): Bins {
	if (cached) return cached;
	const p = join(process.cwd(), "..", "..", "config", "scenario_bins.json");
	cached = JSON.parse(readFileSync(p, "utf8")) as Bins;
	return cached;
}

export type ScenarioBins = {
	cold: "none" | "mild" | "hard" | "extreme";
	volatility: "low" | "med" | "high";
	freeze_thaw: "0" | "1-2" | "3+";
	snow_ice: "none" | "some" | "high";
	forecast_urgency: "none" | "cold-front" | "storm-alert";
	timing: "weekday-high" | "monday-low" | "weekend" | "holiday-prox" | "month-end";
};

export function identifyScenario(inputs: {
	weatherDaily: any[];
	forecastHourly: any[];
	alerts: any[];
	nowUtcIso: string;
	holidaysIcs?: string | null;
}): { scenario_id: string; bins: ScenarioBins } {
	const bins = loadBins();
	const next24 = (inputs.forecastHourly || []).slice(0, 24);
	const minTemp = minSafe(next24.map((h: any) => Number(h.temp_f)));
	const maxTemp = maxSafe(next24.map((h: any) => Number(h.temp_f)));
	const maxPrecip = maxSafe(next24.map((h: any) => Number(h.precip_prob)));

	let cold: ScenarioBins["cold"] = "none";
	if (Number.isFinite(minTemp)) {
		if (minTemp <= bins.cold_thresholds_f.extreme) cold = "extreme";
		else if (minTemp <= bins.cold_thresholds_f.hard) cold = "hard";
		else if (minTemp <= bins.cold_thresholds_f.mild) cold = "mild";
	}

	let volatility: ScenarioBins["volatility"] = "low";
	if (Number.isFinite(minTemp) && Number.isFinite(maxTemp)) {
		const swing = Math.abs(maxTemp - minTemp);
		if (swing >= bins.volatility_thresholds_f.high) volatility = "high";
		else if (swing >= bins.volatility_thresholds_f.med) volatility = "med";
		else volatility = "low";
	}

	// crude freeze-thaw estimate from recent daily highs/lows around freezing
	let cycles = 0;
	for (const d of inputs.weatherDaily || []) {
		const tmin = Number(d.tmin_f ?? d.tmin ?? NaN);
		const tmax = Number(d.tmax_f ?? d.tmax ?? NaN);
		if (Number.isFinite(tmin) && Number.isFinite(tmax)) {
			if (tmin <= 32 && tmax >= 34) cycles++;
		}
	}
	let freeze_thaw: ScenarioBins["freeze_thaw"] = "0";
	if (cycles >= 3) freeze_thaw = "3+";
	else if (cycles >= 1) freeze_thaw = "1-2";

	let snow_ice: ScenarioBins["snow_ice"] = "none";
	if (Number.isFinite(maxPrecip)) {
		if (maxPrecip >= bins.snow_ice_prob_thresholds.high) snow_ice = "high";
		else if (maxPrecip >= bins.snow_ice_prob_thresholds.some) snow_ice = "some";
	}

	let forecast_urgency: ScenarioBins["forecast_urgency"] = "none";
	if ((inputs.alerts || []).length > 0) forecast_urgency = "storm-alert";
	else if (volatility !== "low" && cold !== "none") forecast_urgency = "cold-front";

	const now = new Date(inputs.nowUtcIso);
	const dow = now.getUTCDay();
	const date = now.getUTCDate();
	let timing: ScenarioBins["timing"] = "weekday-high";
	if (dow === 0 || dow === 6) timing = "weekend";
	else if (dow === 1) timing = "monday-low";
	if (date >= 28 || date <= 2) timing = "month-end";
	// naive holiday proximity
	if ((inputs.holidaysIcs || "").includes(now.toISOString().slice(0, 10))) timing = "holiday-prox";

	const binsJson = {
		cold,
		volatility,
		freeze_thaw,
		snow_ice,
		forecast_urgency,
		timing,
	} as ScenarioBins;
	const scenario_id = stableId({ ...binsJson, version: bins.version });
	return { scenario_id, bins: binsJson };
}

function stableId(obj: any): string {
	return JSON.stringify(obj, Object.keys(obj).sort());
}
function minSafe(arr: number[]): number {
	const f = arr.filter((x) => Number.isFinite(x));
	return f.length ? Math.min(...f) : NaN;
}
function maxSafe(arr: number[]): number {
	const f = arr.filter((x) => Number.isFinite(x));
	return f.length ? Math.max(...f) : NaN;
}


