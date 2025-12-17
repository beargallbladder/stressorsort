import { pg } from "../db/client";
import { httpGetJson } from "../utils/http";

const NOAA_TOKEN = process.env.NOAA_TOKEN || "";

export async function getOrResolveStation(geoKey: string, lat: number, lon: number, startDate: string, endDate: string): Promise<string | null> {
	// Try cache
	const cached = await pg.query(`select station_id from noaa_station_cache where geo_key = $1`, [geoKey]);
	if (cached.rowCount && cached.rowCount > 0) {
		return String(cached.rows[0].station_id);
	}
	if (!NOAA_TOKEN) return null;
	// Resolve nearest station with desired datatypes coverage
	// Using NCEI CDO stations endpoint with extent bounding box around point
	const delta = 0.25; // ~25km box
	const extent = `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`;
	const url = `https://www.ncdc.noaa.gov/cdo-web/api/v2/stations?extent=${extent}&datatypeid=TMAX&datatypeid=TMIN&datatypeid=PRCP&startdate=${startDate}&enddate=${endDate}&limit=25`;
	try {
		const json = await httpGetJson<any>(url, { headers: { token: NOAA_TOKEN } });
		const results = json?.results || [];
		if (!Array.isArray(results) || results.length === 0) return null;
		// Pick first for now; could rank by coverage period length
		const station = results[0];
		const stationId = String(station.id || station.station || station.mindate || "");
		await pg.query(
			`insert into noaa_station_cache (geo_key, station_id, coverage_json, updated_at)
       values ($1,$2,$3, now())
       on conflict (geo_key) do update set station_id = excluded.station_id, coverage_json = excluded.coverage_json, updated_at = now()`,
			[geoKey, stationId, station || {}],
		);
		return stationId;
	} catch {
		return null;
	}
}


