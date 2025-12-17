const buckets = new Map<string, { tokens: number; lastRefill: number; rps: number; capacity: number }>();

export async function consumeRate(host: string, rps: number): Promise<void> {
	const now = Date.now();
	let b = buckets.get(host);
	if (!b) {
		b = { tokens: rps, lastRefill: now, rps, capacity: rps };
		buckets.set(host, b);
	}
	// refill
	const elapsed = (now - b.lastRefill) / 1000;
	const refill = elapsed * b.rps;
	if (refill > 0) {
		b.tokens = Math.min(b.capacity, b.tokens + refill);
		b.lastRefill = now;
	}
	// if no tokens, wait until next token available
	if (b.tokens < 1) {
		const waitMs = Math.ceil((1 - b.tokens) * 1000 / b.rps);
		await new Promise((r) => setTimeout(r, Math.max(5, waitMs)));
		return consumeRate(host, rps);
	}
	b.tokens -= 1;
}


