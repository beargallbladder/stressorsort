import type { Request, Response, NextFunction } from "express";

type Options = { windowMs: number; limit: number };

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(opts: Options) {
	return function (req: Request, res: Response, next: NextFunction) {
		const key = (req.header("x-api-key") || req.ip || "anon") + ":" + (req.path || "/");
		const now = Date.now();
		const b = buckets.get(key);
		if (!b || now > b.resetAt) {
			buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
			return next();
		}
		if (b.count >= opts.limit) {
			const retry = Math.max(0, Math.ceil((b.resetAt - now) / 1000));
			res.setHeader("Retry-After", String(retry));
			return res.status(429).json({ error: "rate_limited" });
		}
		b.count++;
		return next();
	};
}


