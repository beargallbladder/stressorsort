import { sha256Hex } from "../../utils/crypto";

type Vehicle = {
	make?: string;
	model?: string;
	model_year?: number;
	platform_bucket?: string;
	powertrain?: string;
	drivetrain?: string;
};

function bucketYears(year?: number): { start: number; end: number } {
	if (!year) return { start: 0, end: 0 };
	// 3-year buckets
	const start = year - ((year - 2000) % 3);
	return { start, end: start + 2 };
}

export function identifyVehicleClass(v: Vehicle): string {
	const years = bucketYears(v.model_year);
	const key = [
		`make=${(v.make || "unknown").toLowerCase()}`,
		`model=${(v.model || "unknown").toLowerCase()}`,
		`years=${years.start}-${years.end}`,
		`platform=${(v.platform_bucket || "unknown").toLowerCase()}`,
		`powertrain=${(v.powertrain || "unknown").toLowerCase()}`,
		`drivetrain=${(v.drivetrain || "unknown").toLowerCase()}`,
	].join("|");
	// use the canonical key directly; stable and readable
	// alternatively: return short hash: sha256Hex(key).slice(0, 16)
	return key;
}


