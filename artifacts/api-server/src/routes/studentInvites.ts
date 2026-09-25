import { Router } from "express";
import { db, recruiterInvites } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireStudent, authorizeStudentAccess } from "../middlewares/studentAuth";

// The student Inbox. These three used to live in the legacy TPO router, which
// is no longer mounted, so the Inbox got 404s and crashed.
const router = Router();

router.get("/students/:id/invites", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const invites = await db
    .select()
    .from(recruiterInvites)
    .where(eq(recruiterInvites.studentId, id))
    .orderBy(desc(recruiterInvites.createdAt));
  res.json(invites);
});

router.post("/students/:id/mark-invites-seen", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  await db.update(recruiterInvites).set({ studentSeen: true }).where(eq(recruiterInvites.studentId, id));
  res.json({ ok: true });
});

router.patch("/recruiter-invites/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  const status = (req.body ?? {}).status;
  if (status !== "accepted" && status !== "declined") return res.status(400).json({ error: "Invalid status" });

  const [invite] = await db.select().from(recruiterInvites).where(eq(recruiterInvites.id, id)).limit(1);
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  // Only the invited student may answer it.
  const auth = await authorizeStudentAccess(req, invite.studentId, true);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error, ...(auth.code ? { code: auth.code } : {}) });

  const [updated] = await db
    .update(recruiterInvites)
    .set({ status, studentSeen: true })
    .where(eq(recruiterInvites.id, id))
    .returning();
  return res.json(updated);
});

export default router;
