import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// Railway gates each deploy on this. It must fail when the database is
// unreachable (bad DATABASE_URL, Neon down), or a broken build goes live
// while every data call fails.
router.get("/healthz", async (_req, res) => {
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db ping timeout")), 5000)),
    ]);
  } catch {
    res.status(503).json({ status: "db_unreachable" });
    return;
  }
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
