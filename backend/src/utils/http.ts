import { setTimeout as delay } from "node:timers/promises";

export async function httpGetJson<T>(url: string, init?: any, retries = 2): Promise<T> {
	let lastErr: any;
	for (let i = 0; i <= retries; i++) {
		try {
			const res = await fetch(url, {
				...init,
				headers: {
					"User-Agent": "DealerStressor/0.1 (+https://example.com)",
					"Accept": "application/json",
					...(init?.headers || {}),
				},
			});
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			return (await res.json()) as T;
		} catch (err) {
			lastErr = err;
			await delay(250 * (i + 1));
		}
	}
	throw lastErr;
}


