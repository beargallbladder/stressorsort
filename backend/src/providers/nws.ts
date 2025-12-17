import { httpGetJson } from "../utils/http";

export type NwsPoint = {
	gridId: string;
	gridX: number;
	gridY: number;
};

export async function getPoint(lat: number, lon: number): Promise<NwsPoint> {
	const url = `https://api.weather.gov/points/${lat},${lon}`;
	const json = await httpGetJson<any>(url, {
		headers: { "Accept": "application/geo+json" },
	});
	const props = json?.properties;
	const gridId = props?.gridId;
	const gridX = props?.gridX;
	const gridY = props?.gridY;
	return { gridId, gridX, gridY };
}

export async function getHourlyForecast(gridId: string, gridX: number, gridY: number): Promise<any> {
	const url = `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`;
	return await httpGetJson<any>(url, { headers: { "Accept": "application/geo+json" } });
}

export async function getAlertsForArea(lat: number, lon: number): Promise<any> {
	const url = `https://api.weather.gov/alerts?point=${lat},${lon}`;
	return await httpGetJson<any>(url, { headers: { "Accept": "application/geo+json" } });
}


