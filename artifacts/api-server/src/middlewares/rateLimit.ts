import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { createHash } from "node:crypto";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

interface LimiterOptions {
  windowMs: number;
  max: number;
  name: string;
  keyer?: (req: Request) => string;
}

const buckets = new Map<string, Bucket>();

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [k, b] of buckets) {
    if (b.updatedAt < cutoff) buckets.delete(k);
  }
}, 10 * 60 * 1000).unref?.();

// Keyed on the authenticated subject, never a client-supplied studentId (trivially evadable
// by just sending a different id in the body/param).
function defaultKeyer(req: Request): string {
  const { userId } = getAuth(req);
  if (userId) return `u:${userId}`;

  const guestToken = req.header("x-guest-token");
  if (guestToken) return `g:${createHash("sha256").update(guestToken).digest("hex").slice(0, 16)}`;

  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0]?.trim()) || req.ip || "unknown";
  return `ip:${ip}`;
}

export function rateLimit(opts: LimiterOptions): RequestHandler {
  const { windowMs, max, name } = opts;
  const keyer = opts.keyer ?? defaultKeyer;
  const refillPerMs = max / windowMs;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}|${keyer(req)}`;
    const now = Date.now();
    const b = buckets.get(key);
    let tokens: number;
    if (!b) {
      tokens = max - 1;
    } else {
      const elapsed = now - b.updatedAt;
      tokens = Math.min(max, b.tokens + elapsed * refillPerMs) - 1;
    }
    buckets.set(key, { tokens, updatedAt: now });

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, Math.floor(tokens))));

    if (tokens < 0) {
      const retryAfter = Math.ceil(Math.abs(tokens) / refillPerMs / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      req.log?.warn({ key, name }, "rate limit exceeded");
      res.status(429).json({
        error: "Too many requests",
        message: `You're going a bit fast. Try again in ${retryAfter}s.`,
        retryAfter,
      });
      return;
    }
    // Lets a route hand the token back when the work failed on our side, so a
    // student retrying after a server error isn't also locked out.
    const refunds = ((res.locals.rateLimitRefunds as (() => void)[] | undefined) ??= []);
    refunds.push(() => {
      const cur = buckets.get(key);
      if (cur) cur.tokens = Math.min(max, cur.tokens + 1);
    });
    next();
  };
}

export function refundRateLimit(res: Response): void {
  const refunds = res.locals.rateLimitRefunds as (() => void)[] | undefined;
  for (const refund of refunds ?? []) refund();
  res.locals.rateLimitRefunds = [];
}

export const rlAiHeavy = rateLimit({ name: "ai-heavy", windowMs: 60 * 60 * 1000, max: 30 });
export const rlAiMedium = rateLimit({ name: "ai-medium", windowMs: 60 * 60 * 1000, max: 60 });
export const rlAiLight = rateLimit({ name: "ai-light", windowMs: 60 * 1000, max: 30 });
export const rlInterview = rateLimit({ name: "interview", windowMs: 60 * 60 * 1000, max: 20 });
export const rlDriveCheck = rateLimit({ name: "drivecheck", windowMs: 60 * 60 * 1000, max: 15 });
// The 4-stage resume pipeline costs 4-5x a single rlAiHeavy call — a dedicated,
// tighter bucket instead of sharing rlAiHeavy's 30/hr.
export const rlResumeGen = rateLimit({ name: "resume-gen", windowMs: 60 * 60 * 1000, max: 10 });
// Single-bullet rewrites are one small call each; sharing the generation bucket
// meant a few rewrites could block the student's next full generation.
export const rlBulletRewrite = rateLimit({ name: "resume-rewrite", windowMs: 60 * 60 * 1000, max: 40 });
