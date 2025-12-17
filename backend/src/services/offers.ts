import { readFileSync } from "node:fs";
import { join } from "node:path";

type OffersConfig = {
	version: string;
	mapping: Record<string, string[]>;
};

let cached: OffersConfig | null = null;

function loadOffers(): OffersConfig {
	if (cached) return cached;
	const p = join(process.cwd(), "..", "..", "config", "service_offers.json");
	cached = JSON.parse(readFileSync(p, "utf8")) as OffersConfig;
	return cached;
}

export function mapTagsToOffers(tags: string[]): string[] {
	const cfg = loadOffers();
	const set = new Set<string>();
	for (const t of tags || []) {
		for (const offer of cfg.mapping[t] || []) {
			set.add(offer);
		}
	}
	return Array.from(set);
}


