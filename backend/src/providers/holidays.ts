import { httpGetJson } from "../utils/http";

// Very simple ICS-to-list placeholder using a public ICS (US Federal Holidays)
// For production, cache and parse ICS; here we return raw text for now.

const FEDERAL_ICS =
	"https://www.officeholidays.com/ics/ics_country.php?tbl_country=United_States";

export async function getFederalHolidaysIcs(): Promise<string> {
	// ICS is text; we still use GET; caller can parse proximity externally
	const res = await fetch(FEDERAL_ICS, {
		headers: { "User-Agent": "DealerStressor/0.1" },
	});
	if (!res.ok) throw new Error(`ICS fetch failed ${res.status}`);
	return await res.text();
}


