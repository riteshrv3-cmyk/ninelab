import { Router } from "express";
import { db } from "@workspace/db";
import { collegesTable, studentsTable } from "@workspace/db";
import { eq, sql, ilike, asc } from "drizzle-orm";
import { requireStudent, StudentAuthedRequest } from "../middlewares/studentAuth";

const router = Router();

// (The legacy unauthenticated TPO endpoints GET /tpo/my-college and
// POST /tpo/colleges/:id/regenerate were removed — anyone could create or
// rotate a college. College creation is now admin-only via
// POST /admin/college-admins; invite-code rotation moves to the authenticated
// college-admin surface if needed.)

// PUBLIC: searchable college list for the student profile picker.
router.get("/colleges", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const base = db
      .select({ id: collegesTable.id, name: collegesTable.name, city: collegesTable.city })
      .from(collegesTable);
    const rows = q
      ? await base.where(ilike(collegesTable.name, `%${q}%`)).orderBy(asc(collegesTable.name)).limit(50)
      : await base.orderBy(asc(collegesTable.name)).limit(50);
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list colleges");
    return res.status(500).json({ error: "Failed to list colleges" });
  }
});

// Set the signed-in/guest student's college (profile picker).
router.post("/students/:id/college", requireStudent({ allowGuest: true }), async (req: StudentAuthedRequest, res) => {
  const id = req.student!.id;
  const collegeId = Number((req.body as { collegeId?: number }).collegeId);
  if (!Number.isFinite(collegeId)) return res.status(400).json({ error: "collegeId required" });
  try {
    const [college] = await db.select().from(collegesTable).where(eq(collegesTable.id, collegeId)).limit(1);
    if (!college) return res.status(404).json({ error: "College not found" });
    await db.update(studentsTable).set({ collegeId: college.id, college: college.name }).where(eq(studentsTable.id, id));
    return res.json({ ok: true, collegeId: college.id, collegeName: college.name });
  } catch (err) {
    req.log.error({ err }, "Failed to set college");
    return res.status(500).json({ error: "Failed to set college" });
  }
});

// PUBLIC: resolve invite code
router.get("/invite/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").toUpperCase().trim();
    if (!code) return res.status(400).json({ error: "code required" });
    const [college] = await db.select({
      id: collegesTable.id,
      name: collegesTable.name,
      city: collegesTable.city,
      logoUrl: collegesTable.logoUrl,
      signupCount: collegesTable.signupCount,
      inviteCode: collegesTable.inviteCode,
    }).from(collegesTable).where(eq(collegesTable.inviteCode, code)).limit(1);
    if (!college) return res.status(404).json({ error: "Invalid invite link" });
    return res.json(college);
  } catch (err) {
    req.log.error({ err }, "Failed resolve invite");
    return res.status(500).json({ error: "Failed to resolve invite" });
  }
});

// Bind the student to a college via invite code (called right after signup).
// requireStudent verifies the caller owns req.body.studentId (guest token or
// Clerk session) — the studentId is authorization-checked, not trusted raw, so
// a guessed id can no longer be bound to an arbitrary college.
router.post("/invite/:code/claim", requireStudent({ allowGuest: true }), async (req: StudentAuthedRequest, res) => {
  const studentId = req.student!.id;
  const alreadyInCollege = req.student!.collegeId != null;
  try {
    const code = String(req.params.code || "").toUpperCase().trim();
    if (!code) return res.status(400).json({ error: "code required" });
    const [college] = await db.select().from(collegesTable).where(eq(collegesTable.inviteCode, code)).limit(1);
    if (!college) return res.status(404).json({ error: "Invalid invite" });
    await db.update(studentsTable)
      .set({ collegeId: college.id, college: college.name })
      .where(eq(studentsTable.id, studentId));
    // Only bump the counter when this student wasn't already attached to a
    // college, so repeated claims don't inflate signupCount.
    if (!alreadyInCollege) {
      await db.update(collegesTable)
        .set({ signupCount: sql`${collegesTable.signupCount} + 1` })
        .where(eq(collegesTable.id, college.id));
    }
    return res.json({ ok: true, collegeId: college.id, collegeName: college.name });
  } catch (err) {
    req.log.error({ err }, "Failed claim invite");
    return res.status(500).json({ error: "Failed to claim invite" });
  }
});

export default router;
