import { httpGetJson } from "../utils/http";

export type ZipGeo = { zip: string; lat: number; lon: number; state?: string };

export async function geocodeZip(zip: string): Promise<ZipGeo | null> {
	// Use Zippopotam.us free API as a simple zip -> lat/lon
	// https://api.zippopotam.us/us/{zip}
	const url = `https://api.zippopotam.us/us/${encodeURIComponent(zip)}`;
	try {
		const json = await httpGetJson<any>(url);
		const place = json?.places?.[0];
		if (!place) return null;
		return {
			zip,
			lat: Number(place["latitude"]),
			lon: Number(place["longitude"]),
			state: place["state abbreviation"] || place["state"],
		};
	} catch {
		return null;
	}
}


