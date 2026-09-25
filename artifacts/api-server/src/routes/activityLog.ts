import { Router } from "express";
import { db } from "@workspace/db";
import { studentActivityLogTable, interviewSessionsTable, studentResumesTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireStudent } from "../middlewares/studentAuth";
import { logEvent } from "../lib/events";

const router = Router();

// GET /students/:id/activity-log
router.get("/students/:id/activity-log", requireStudent({ allowGuest: true }), async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) return res.status(400).json({ error: "Invalid id" });
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  try {
    const logs = await db
      .select()
      .from(studentActivityLogTable)
      .where(eq(studentActivityLogTable.studentId, studentId))
      .orderBy(desc(studentActivityLogTable.createdAt))
      .limit(limit);
    return res.json(
      logs.map(l => ({
        id: l.id,
        action: l.action,
        description: l.description,
        xpAmount: l.xpAmount,
        createdAt: l.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get activity log");
    return res.status(500).json({ error: "Failed to get activity log" });
  }
});

// POST /students/:id/activity/opportunity-opened — fired when a student taps
// Apply on an opportunity card. Locked spec: this logs activity ONLY; it does
// not create a pipeline entry and makes no claim the student actually applied.
// The student owns their pipeline; we only know they opened the posting.
router.post("/students/:id/activity/opportunity-opened", requireStudent({ allowGuest: true }), async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) return res.status(400).json({ error: "Invalid id" });

  const { title, company, source, url } = (req.body ?? {}) as {
    title?: unknown; company?: unknown; source?: unknown; url?: unknown;
  };
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const safeTitle = str(title, 200);
  const safeCompany = str(company, 120);
  if (!safeTitle) return res.status(400).json({ error: "title is required" });

  logEvent(
    studentId,
    "opportunity_opened",
    `Opened ${safeTitle}${safeCompany ? ` at ${safeCompany}` : ""}`,
    { title: safeTitle, company: safeCompany, source: str(source, 60), url: str(url, 500) },
  );
  return res.status(202).json({ ok: true });
});

// GET /students/:id/activity/summary — the counts shown on the Profile page.
// Every number here is a real count of a real row; nothing is estimated.
router.get("/students/:id/activity/summary", requireStudent({ allowGuest: true }), async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) return res.status(400).json({ error: "Invalid id" });

  try {
    const countOf = async (table: typeof interviewSessionsTable | typeof studentResumesTable, extra?: ReturnType<typeof eq>) => {
      const where = extra ? and(eq(table.studentId, studentId), extra) : eq(table.studentId, studentId);
      const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
      return row?.n ?? 0;
    };

    const [mockInterviews, resumesGenerated, applicationsOpenedRow] = await Promise.all([
      countOf(interviewSessionsTable, eq(interviewSessionsTable.completed, true)),
      countOf(studentResumesTable),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(studentActivityLogTable)
        .where(and(
          eq(studentActivityLogTable.studentId, studentId),
          eq(studentActivityLogTable.action, "opportunity_opened"),
        ))
        .then(rows => rows[0]),
    ]);

    return res.json({
      mockInterviews,
      resumesGenerated,
      applicationsOpened: applicationsOpenedRow?.n ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get activity summary");
    return res.status(500).json({ error: "Failed to get activity summary" });
  }
});

export default router;
