import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, studentsTable, collegesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveCollegeAdmin } from "../middlewares/collegeAdminAuth";

const router = Router();

/**
 * GET /me/role — resolves the signed-in user's role for the client gate.
 * Performs the one-time email->clerkUserId binding for allowlisted college
 * admins as a side effect (via resolveCollegeAdmin). Returns "none" for signed
 * out or unrecognized users.
 */
router.get("/me/role", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.json({ role: "none" });
  try {
    const admin = await resolveCollegeAdmin(req);
    if (admin) {
      const [college] = await db
        .select({ name: collegesTable.name })
        .from(collegesTable)
        .where(eq(collegesTable.id, admin.collegeId))
        .limit(1);
      return res.json({ role: "college_admin", collegeId: admin.collegeId, collegeName: college?.name ?? null });
    }
    const [student] = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.clerkUserId, userId))
      .limit(1);
    return res.json({ role: student ? "student" : "none" });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve role");
    return res.status(500).json({ error: "Failed to resolve role" });
  }
});

export default router;
