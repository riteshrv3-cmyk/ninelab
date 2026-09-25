import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

// Admin token gate: fail-closed if env not set; constant-time compare.
// Also guards the legacy recruiter/talent-pool APIs, whose portals are not
// deployed and which expose other students' data.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    res.status(503).json({ error: "Admin API disabled (ADMIN_API_TOKEN not configured)" });
    return;
  }
  const provided = req.header("x-admin-token") || "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }
  next();
}
