import { httpGetJson } from "../utils/http";

export type VpicDecoded = {
	model_year?: number;
	make?: string;
	model?: string;
	raw: any;
};

export async function decodeVinWithVpic(vin: string): Promise<VpicDecoded> {
	// vPIC VIN decode
	const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/${encodeURIComponent(
		vin,
	)}?format=json`;
	const json = await httpGetJson<any>(url);
	const result = json?.Results?.[0] || {};
	const model_year = Number(result.ModelYear) || undefined;
	const make = result.Make || undefined;
	const model = result.Model || undefined;
	return { model_year, make, model, raw: json };
}

export async function decodeVinBatch(vins: string[]): Promise<Record<string, VpicDecoded>> {
	if (!vins.length) return {};
	// vPIC batch: up to 50 VINs, comma-separated
	const list = vins.slice(0, 50).map((v) => encodeURIComponent(v)).join(",");
	const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesBatch/${list}?format=json`;
	const json = await httpGetJson<any>(url);
	const out: Record<string, VpicDecoded> = {};
	for (const r of json?.Results || []) {
		const vin = (r?.VIN || "").toString();
		out[vin] = {
			model_year: Number(r?.ModelYear) || undefined,
			make: r?.Make || undefined,
			model: r?.Model || undefined,
			raw: r,
		};
	}
	return out;
}

export type RecallSummary = {
	open_recall_count: number;
	raw: any;
};

export async function fetchRecallsByVin(vin: string): Promise<RecallSummary> {
	// NHTSA recalls API (VIN)
	// Endpoint may vary; this is commonly used pattern
	const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${encodeURIComponent(vin)}`;
	const json = await httpGetJson<any>(url);
	const results = json?.results || json?.Results || [];
	// naive open count (no status field in some datasets)
	const openCount = Array.isArray(results) ? results.length : 0;
	return { open_recall_count: openCount, raw: json };
}


