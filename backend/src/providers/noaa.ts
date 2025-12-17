import { httpGetJson } from "../utils/http";

const NOAA_TOKEN = process.env.NOAA_TOKEN || "";

export async function getDailyHistory(lat: number, lon: number, startDate: string, endDate: string): Promise<any> {
	// Placeholder: In production, query NOAA CDO datasets (e.g., GHCND) with token
	// This endpoint requires token; return empty structure if token missing
	if (!NOAA_TOKEN) {
		return { results: [] };
	}
	// Example pattern (not executed here): https://www.ncdc.noaa.gov/cdo-web/api/v2/data
	const url = `https://www.ncdc.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&startdate=${startDate}&enddate=${endDate}&limit=1000&units=standard&datatypeid=TMAX&datatypeid=TMIN&datatypeid=PRCP`;
	return await httpGetJson<any>(url, { headers: { token: NOAA_TOKEN } });
}


