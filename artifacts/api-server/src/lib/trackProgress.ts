import {
  db,
  studentsTable,
  learningTracksTable,
  trackMilestonesTable,
  studentTrackEnrollmentsTable,
  interviewSessionsTable,
  courseEnrollmentsTable,
  studentResumesTable,
  applicationsTable,
  dailyTasksTable,
} from "@workspace/db";
import { and, eq, desc, isNull, isNotNull, count } from "drizzle-orm";
import { computeProfileStrength } from "./profileStrength";
import { GENERIC_SKILLS, completeTask, istToday } from "./dailyTasks";
import { refreshReadiness, ReadinessResult } from "./readiness";

type Student = typeof studentsTable.$inferSelect;

/** Global default track used to auto-enroll a student with no college track. */
export const DEFAULT_TEMPLATE_KEY = "core_placement_v1";

/** Product destination for each milestone kind — where "do the thing" lives. */
const HREF_BY_KIND: Record<string, string> = {
  complete_profile: "/profile",
  add_skills: "/profile",
  first_mock: "/practice",
  mock_series: "/practice",
  mock_score: "/practice",
  finish_course: "/practice/courses",
  build_resume: "/resume",
  apply_jobs: "/pipeline",
};

// ─── Checkers: each decides "done" purely from existing student data ──────────

type Checker = (studentId: number, student: Student, config: Record<string, unknown>) => Promise<boolean>;

function nonGenericSkillCount(skills: Record<string, number> | null | undefined): number {
  return Object.keys(skills ?? {}).filter((n) => !GENERIC_SKILLS.has(n.toLowerCase().trim())).length;
}

async function countCompletedMocks(studentId: number): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(interviewSessionsTable)
    .where(and(eq(interviewSessionsTable.studentId, studentId), eq(interviewSessionsTable.completed, true)));
  return Number(r?.n ?? 0);
}

async function maxMockScore(studentId: number): Promise<number> {
  const [r] = await db
    .select({ s: interviewSessionsTable.overallScore })
    .from(interviewSessionsTable)
    .where(and(
      eq(interviewSessionsTable.studentId, studentId),
      eq(interviewSessionsTable.completed, true),
      isNotNull(interviewSessionsTable.overallScore),
    ))
    .orderBy(desc(interviewSessionsTable.overallScore))
    .limit(1);
  return Number(r?.s ?? 0);
}

async function countCompletedCourses(studentId: number): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(courseEnrollmentsTable)
    .where(and(eq(courseEnrollmentsTable.studentId, studentId), eq(courseEnrollmentsTable.status, "completed")));
  return Number(r?.n ?? 0);
}

async function countResumes(studentId: number): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(studentResumesTable)
    .where(eq(studentResumesTable.studentId, studentId));
  return Number(r?.n ?? 0);
}

async function countApplications(studentId: number): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(applicationsTable)
    .where(eq(applicationsTable.studentId, studentId));
  return Number(r?.n ?? 0);
}

const CHECKERS: Record<string, Checker> = {
  complete_profile: async (_id, s, cfg) => computeProfileStrength(s) >= Number(cfg.minStrength ?? 60),
  add_skills: async (_id, s, cfg) => nonGenericSkillCount(s.skills as Record<string, number>) >= Number(cfg.count ?? 3),
  first_mock: async (id) => (await countCompletedMocks(id)) >= 1,
  mock_series: async (id, _s, cfg) => (await countCompletedMocks(id)) >= Number(cfg.count ?? 3),
  mock_score: async (id, _s, cfg) => (await maxMockScore(id)) >= Number(cfg.minScore ?? 60),
  finish_course: async (id) => (await countCompletedCourses(id)) >= 1,
  build_resume: async (id) => (await countResumes(id)) >= 1,
  apply_jobs: async (id, _s, cfg) => (await countApplications(id)) >= Number(cfg.count ?? 3),
};

export const MILESTONE_KINDS = Object.keys(CHECKERS);

// ─── Track resolution + progress ─────────────────────────────────────────────

type Track = typeof learningTracksTable.$inferSelect;

/** The student's college active track if any, else the global default template. */
async function resolveTrack(student: Student): Promise<Track | null> {
  if (student.collegeId != null) {
    const [t] = await db
      .select()
      .from(learningTracksTable)
      .where(and(eq(learningTracksTable.collegeId, student.collegeId), eq(learningTracksTable.active, true)))
      .orderBy(desc(learningTracksTable.updatedAt))
      .limit(1);
    if (t) return t;
  }
  const [d] = await db
    .select()
    .from(learningTracksTable)
    .where(and(isNull(learningTracksTable.collegeId), eq(learningTracksTable.templateKey, DEFAULT_TEMPLATE_KEY)))
    .limit(1);
  return d ?? null;
}

export interface MilestoneView {
  id: number;
  position: number;
  kind: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
  completedAt: string | null;
}

export interface TrackStepCandidate {
  milestoneId: number;
  label: string;
  sublabel: string;
  href: string;
}

export interface TrackProgress {
  track: { id: number; name: string; description: string } | null;
  milestones: MilestoneView[];
  done: number;
  total: number;
  status: string;
  readiness: ReadinessResult;
  nextTask: TrackStepCandidate | null;
}

const EMPTY_READINESS: ReadinessResult = { score: 0, breakdown: { profile: 0, skills: 0, track: 0, mocks: 0 } };

/**
 * Evaluate the student's track: resolve it, lazily auto-enroll, run checkers for
 * incomplete milestones, persist the enrollment + readiness, tick today's
 * track_step daily task if its milestone just completed, and return the full
 * view + the next-incomplete milestone (for the daily-task R8 rule).
 *
 * Called only from read paths (GET today-tasks, GET /students/:id/track), each
 * wrapping this in try/catch — a checker fault must never break those routes.
 */
export async function checkMilestones(studentId: number): Promise<TrackProgress> {
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
  if (!student) return { track: null, milestones: [], done: 0, total: 0, status: "in_progress", readiness: EMPTY_READINESS, nextTask: null };

  const track = await resolveTrack(student);
  if (!track) {
    const readiness = await refreshReadiness(studentId, student);
    return { track: null, milestones: [], done: 0, total: 0, status: "in_progress", readiness, nextTask: null };
  }

  const milestones = await db
    .select()
    .from(trackMilestonesTable)
    .where(eq(trackMilestonesTable.trackId, track.id))
    .orderBy(trackMilestonesTable.position);
  const total = milestones.length;

  // Lazily ensure the enrollment, then load it.
  await db
    .insert(studentTrackEnrollmentsTable)
    .values({ studentId, trackId: track.id, milestonesTotal: total })
    .onConflictDoNothing();
  const [enr] = await db
    .select()
    .from(studentTrackEnrollmentsTable)
    .where(and(eq(studentTrackEnrollmentsTable.studentId, studentId), eq(studentTrackEnrollmentsTable.trackId, track.id)))
    .limit(1);

  const completedMap: Record<string, string> = { ...((enr?.completedMilestones as Record<string, string>) ?? {}) };
  // Drop entries for milestones the TPO has since deleted.
  const currentIds = new Set(milestones.map((m) => String(m.id)));
  for (const key of Object.keys(completedMap)) {
    if (!currentIds.has(key)) delete completedMap[key];
  }

  // Run checkers only for still-incomplete milestones.
  for (const m of milestones) {
    const key = String(m.id);
    if (completedMap[key]) continue;
    const checker = CHECKERS[m.kind];
    if (!checker) continue;
    let ok = false;
    try {
      ok = await checker(studentId, student, ((m.config as Record<string, unknown>) ?? {}));
    } catch {
      ok = false;
    }
    if (ok) completedMap[key] = new Date().toISOString();
  }

  const done = milestones.filter((m) => completedMap[String(m.id)]).length;
  const status = total > 0 && done >= total ? "completed" : "in_progress";
  const wasCompleted = enr?.status === "completed";
  if (enr) {
    await db
      .update(studentTrackEnrollmentsTable)
      .set({
        completedMilestones: completedMap,
        milestonesDone: done,
        milestonesTotal: total,
        status,
        completedAt: status === "completed" ? (wasCompleted ? enr.completedAt : new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(studentTrackEnrollmentsTable.id, enr.id));
  }

  const readiness = await refreshReadiness(studentId, student);

  const views: MilestoneView[] = milestones.map((m) => ({
    id: m.id,
    position: m.position,
    kind: m.kind,
    title: m.title,
    description: m.description,
    href: HREF_BY_KIND[m.kind] ?? "/home",
    done: !!completedMap[String(m.id)],
    completedAt: completedMap[String(m.id)] ?? null,
  }));

  const nextMilestone = views.find((v) => !v.done) ?? null;
  const nextTask: TrackStepCandidate | null = nextMilestone
    ? {
        milestoneId: nextMilestone.id,
        label: nextMilestone.title,
        sublabel: `Milestone ${Math.min(done + 1, total)} of ${total} · ${track.name}`,
        href: nextMilestone.href,
      }
    : null;

  await tickTrackStepIfComplete(studentId, completedMap);

  return {
    track: { id: track.id, name: track.name, description: track.description },
    milestones: views,
    done,
    total,
    status,
    readiness,
    nextTask,
  };
}

/**
 * Read-only track view (no checkers, no writes) for a third party (a TPO)
 * viewing a student. Reflects the last persisted enrollment state.
 */
export async function readTrackProgress(studentId: number): Promise<Omit<TrackProgress, "readiness" | "nextTask">> {
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
  if (!student) return { track: null, milestones: [], done: 0, total: 0, status: "in_progress" };
  const track = await resolveTrack(student);
  if (!track) return { track: null, milestones: [], done: 0, total: 0, status: "in_progress" };

  const milestones = await db
    .select()
    .from(trackMilestonesTable)
    .where(eq(trackMilestonesTable.trackId, track.id))
    .orderBy(trackMilestonesTable.position);
  const [enr] = await db
    .select()
    .from(studentTrackEnrollmentsTable)
    .where(and(eq(studentTrackEnrollmentsTable.studentId, studentId), eq(studentTrackEnrollmentsTable.trackId, track.id)))
    .limit(1);
  const completedMap = (enr?.completedMilestones as Record<string, string>) ?? {};

  const views: MilestoneView[] = milestones.map((m) => ({
    id: m.id,
    position: m.position,
    kind: m.kind,
    title: m.title,
    description: m.description,
    href: HREF_BY_KIND[m.kind] ?? "/home",
    done: !!completedMap[String(m.id)],
    completedAt: completedMap[String(m.id)] ?? null,
  }));
  const done = views.filter((v) => v.done).length;
  return {
    track: { id: track.id, name: track.name, description: track.description },
    milestones: views,
    done,
    total: milestones.length,
    status: enr?.status ?? "in_progress",
  };
}

/** If today's track_step card points at a milestone that just completed, tick it (awards XP like any task). */
async function tickTrackStepIfComplete(studentId: number, completedMap: Record<string, string>): Promise<void> {
  const date = istToday();
  const [task] = await db
    .select({ id: dailyTasksTable.id, done: dailyTasksTable.done, meta: dailyTasksTable.meta })
    .from(dailyTasksTable)
    .where(and(eq(dailyTasksTable.studentId, studentId), eq(dailyTasksTable.date, date), eq(dailyTasksTable.kind, "track_step")))
    .limit(1);
  if (!task || task.done) return;
  const meta = task.meta as { milestoneId?: number } | null;
  if (meta?.milestoneId != null && completedMap[String(meta.milestoneId)]) {
    await completeTask(studentId, task.id, true);
  }
}
