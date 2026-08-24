import { Router, type Response } from "express";
import {
  db,
  studentsTable,
  collegesTable,
  learningTracksTable,
  trackMilestonesTable,
  studentTrackEnrollmentsTable,
  interviewSessionsTable,
} from "@workspace/db";
import { and, eq, desc, asc, inArray, count, isNotNull } from "drizzle-orm";
import { requireCollegeAdmin, CollegeAdminRequest } from "../middlewares/collegeAdminAuth";
import { readTrackProgress, MILESTONE_KINDS } from "../lib/trackProgress";
import { computeReadiness, loadTrackPct, loadMockScore } from "../lib/readiness";
import { DEFAULT_TRACKS, loadTemplateWithMilestones } from "../lib/defaultTracks";
import { istToday } from "../lib/dailyTasks";

const router = Router();

// Path-scoped: every feature router shares the /api root, so this gate must be
// bound to the /college-admin prefix, never used unscoped.
router.use("/college-admin", requireCollegeAdmin());

// ─── GET /college-admin/dashboard ────────────────────────────────────────────
router.get("/college-admin/dashboard", async (req: CollegeAdminRequest, res: Response) => {
  const collegeId = req.collegeAdmin!.collegeId;
  try {
    const [college] = await db
      .select({ id: collegesTable.id, name: collegesTable.name, city: collegesTable.city, inviteCode: collegesTable.inviteCode, signupCount: collegesTable.signupCount })
      .from(collegesTable)
      .where(eq(collegesTable.id, collegeId))
      .limit(1);

    const students = await db
      .select({
        id: studentsTable.id,
        name: studentsTable.name,
        email: studentsTable.email,
        year: studentsTable.year,
        field: studentsTable.field,
        targetRole: studentsTable.targetRole,
        readinessScore: studentsTable.readinessScore,
        profileStrength: studentsTable.profileStrength,
        lastActiveDate: studentsTable.lastActiveDate,
        streakCount: studentsTable.streakCount,
      })
      .from(studentsTable)
      .where(eq(studentsTable.collegeId, collegeId))
      .orderBy(desc(studentsTable.readinessScore));

    const ids = students.map((s) => s.id);

    // Milestone counts (latest enrollment per student) + mock counts — two
    // batch queries, merged in JS, so no per-student round trips.
    const enrollments = ids.length
      ? await db
          .select({
            studentId: studentTrackEnrollmentsTable.studentId,
            done: studentTrackEnrollmentsTable.milestonesDone,
            total: studentTrackEnrollmentsTable.milestonesTotal,
            updatedAt: studentTrackEnrollmentsTable.updatedAt,
          })
          .from(studentTrackEnrollmentsTable)
          .where(inArray(studentTrackEnrollmentsTable.studentId, ids))
          .orderBy(desc(studentTrackEnrollmentsTable.updatedAt))
      : [];
    const enrByStudent = new Map<number, { done: number; total: number }>();
    for (const e of enrollments) {
      if (!enrByStudent.has(e.studentId)) enrByStudent.set(e.studentId, { done: e.done, total: e.total });
    }

    const mockRows = ids.length
      ? await db
          .select({ studentId: interviewSessionsTable.studentId, n: count() })
          .from(interviewSessionsTable)
          .where(and(inArray(interviewSessionsTable.studentId, ids), eq(interviewSessionsTable.completed, true)))
          .groupBy(interviewSessionsTable.studentId)
      : [];
    const mockByStudent = new Map<number, number>();
    for (const m of mockRows) mockByStudent.set(m.studentId, Number(m.n));

    const today = istToday();
    const rows = students.map((s) => ({
      ...s,
      milestonesDone: enrByStudent.get(s.id)?.done ?? 0,
      milestonesTotal: enrByStudent.get(s.id)?.total ?? 0,
      mockCount: mockByStudent.get(s.id) ?? 0,
    }));

    const studentCount = rows.length;
    const avgReadiness = studentCount ? Math.round(rows.reduce((a, s) => a + (s.readinessScore ?? 0), 0) / studentCount) : 0;
    const readyCount = rows.filter((s) => (s.readinessScore ?? 0) >= 60).length;
    const activeToday = rows.filter((s) => s.lastActiveDate === today).length;
    const distribution = {
      red: rows.filter((s) => (s.readinessScore ?? 0) < 35).length,
      amber: rows.filter((s) => (s.readinessScore ?? 0) >= 35 && (s.readinessScore ?? 0) < 60).length,
      green: rows.filter((s) => (s.readinessScore ?? 0) >= 60).length,
    };

    return res.json({
      college: college ?? null,
      stats: { studentCount, avgReadiness, readyCount, activeToday },
      distribution,
      students: rows,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load college dashboard");
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ─── GET /college-admin/students/:id ─────────────────────────────────────────
router.get("/college-admin/students/:id", async (req: CollegeAdminRequest, res: Response) => {
  const collegeId = req.collegeAdmin!.collegeId;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student || student.collegeId !== collegeId) return res.status(404).json({ error: "Not found" });

    const [trackPct, mockScore, track] = await Promise.all([
      loadTrackPct(id),
      loadMockScore(id),
      readTrackProgress(id),
    ]);
    const readiness = computeReadiness({ student, trackPct, mockScore });

    const mockHistory = await db
      .select({
        id: interviewSessionsTable.id,
        company: interviewSessionsTable.company,
        overallScore: interviewSessionsTable.overallScore,
        createdAt: interviewSessionsTable.createdAt,
      })
      .from(interviewSessionsTable)
      .where(and(eq(interviewSessionsTable.studentId, id), eq(interviewSessionsTable.completed, true), isNotNull(interviewSessionsTable.overallScore)))
      .orderBy(asc(interviewSessionsTable.createdAt));

    return res.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        year: student.year,
        field: student.field,
        targetRole: student.targetRole,
        readinessScore: student.readinessScore,
        profileStrength: student.profileStrength,
        streakCount: student.streakCount,
        lastActiveDate: student.lastActiveDate,
      },
      readiness,
      track,
      mockHistory,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load student detail");
    return res.status(500).json({ error: "Failed to load student" });
  }
});

// ─── Track editor ────────────────────────────────────────────────────────────

async function loadActiveTrack(collegeId: number) {
  const [track] = await db
    .select()
    .from(learningTracksTable)
    .where(and(eq(learningTracksTable.collegeId, collegeId), eq(learningTracksTable.active, true)))
    .orderBy(desc(learningTracksTable.updatedAt))
    .limit(1);
  if (!track) return null;
  const milestones = await db
    .select()
    .from(trackMilestonesTable)
    .where(eq(trackMilestonesTable.trackId, track.id))
    .orderBy(asc(trackMilestonesTable.position));
  return { track, milestones };
}

// GET /college-admin/track — the college's active track (or null) + templates.
router.get("/college-admin/track", async (req: CollegeAdminRequest, res: Response) => {
  const collegeId = req.collegeAdmin!.collegeId;
  try {
    const active = await loadActiveTrack(collegeId);
    return res.json({
      track: active,
      templates: DEFAULT_TRACKS,
      milestoneKinds: MILESTONE_KINDS,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load track editor");
    return res.status(500).json({ error: "Failed to load track" });
  }
});

// POST /college-admin/track — clone a template ({templateKey}) or create empty ({name}).
router.post("/college-admin/track", async (req: CollegeAdminRequest, res: Response) => {
  const collegeId = req.collegeAdmin!.collegeId;
  const { templateKey, name } = req.body as { templateKey?: string; name?: string };
  try {
    // Deactivate any current active track for this college first.
    await db.update(learningTracksTable).set({ active: false }).where(and(eq(learningTracksTable.collegeId, collegeId), eq(learningTracksTable.active, true)));

    let newName = (name ?? "").trim();
    let newDesc = "";
    let milestoneSpecs: { kind: string; title: string; description: string; config: unknown }[] = [];

    if (templateKey) {
      const tpl = await loadTemplateWithMilestones(templateKey);
      if (!tpl) return res.status(404).json({ error: "Template not found" });
      newName = newName || tpl.track.name;
      newDesc = tpl.track.description;
      milestoneSpecs = tpl.milestones.map((m) => ({ kind: m.kind, title: m.title, description: m.description, config: m.config }));
    } else if (!newName) {
      return res.status(400).json({ error: "templateKey or name required" });
    }

    const [created] = await db
      .insert(learningTracksTable)
      .values({ collegeId, templateKey: null, name: newName, description: newDesc, active: true })
      .returning();

    if (milestoneSpecs.length) {
      await db.insert(trackMilestonesTable).values(
        milestoneSpecs.map((m, i) => ({ trackId: created.id, position: i, kind: m.kind, title: m.title, description: m.description, config: (m.config as Record<string, unknown>) ?? {} })),
      );
    }

    const active = await loadActiveTrack(collegeId);
    return res.status(201).json({ track: active });
  } catch (err) {
    req.log.error({ err }, "Failed to create/clone track");
    return res.status(500).json({ error: "Failed to create track" });
  }
});

interface MilestoneInput {
  id?: number;
  kind: string;
  title: string;
  description?: string;
  config?: Record<string, unknown>;
}

// PUT /college-admin/track — replace the active track's name/description + milestones.
router.put("/college-admin/track", async (req: CollegeAdminRequest, res: Response) => {
  const collegeId = req.collegeAdmin!.collegeId;
  const body = req.body as { name?: string; description?: string; milestones?: MilestoneInput[] };
  try {
    const active = await loadActiveTrack(collegeId);
    if (!active) return res.status(404).json({ error: "No active track to edit" });
    const trackId = active.track.id;

    const incoming = Array.isArray(body.milestones) ? body.milestones : [];
    for (const m of incoming) {
      if (!MILESTONE_KINDS.includes(m.kind)) return res.status(400).json({ error: `Unknown milestone kind: ${m.kind}` });
      if (!m.title?.trim()) return res.status(400).json({ error: "Every milestone needs a title" });
    }

    // Track meta.
    await db
      .update(learningTracksTable)
      .set({ name: (body.name ?? active.track.name).trim() || active.track.name, description: body.description ?? active.track.description, updatedAt: new Date() })
      .where(eq(learningTracksTable.id, trackId));

    // Replace milestones: delete removed, upsert the rest by position order.
    const keepIds = incoming.filter((m) => m.id != null).map((m) => m.id as number);
    const existing = active.milestones;
    const toDelete = existing.filter((e) => !keepIds.includes(e.id)).map((e) => e.id);
    if (toDelete.length) await db.delete(trackMilestonesTable).where(inArray(trackMilestonesTable.id, toDelete));

    for (let i = 0; i < incoming.length; i++) {
      const m = incoming[i];
      if (m.id != null && existing.some((e) => e.id === m.id)) {
        await db
          .update(trackMilestonesTable)
          .set({ position: i, kind: m.kind, title: m.title.trim(), description: m.description ?? "", config: m.config ?? {} })
          .where(eq(trackMilestonesTable.id, m.id));
      } else {
        await db
          .insert(trackMilestonesTable)
          .values({ trackId, position: i, kind: m.kind, title: m.title.trim(), description: m.description ?? "", config: m.config ?? {} });
      }
    }

    // Re-snapshot enrollment totals so progress percentages stay bounded until
    // each student's next Home load recomputes their done count.
    await db.update(studentTrackEnrollmentsTable).set({ milestonesTotal: incoming.length }).where(eq(studentTrackEnrollmentsTable.trackId, trackId));

    const updated = await loadActiveTrack(collegeId);
    return res.json({ track: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update track");
    return res.status(500).json({ error: "Failed to update track" });
  }
});

export default router;
