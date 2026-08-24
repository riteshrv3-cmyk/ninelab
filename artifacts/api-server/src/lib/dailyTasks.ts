import { db } from "@workspace/db";
import {
  studentsTable,
  dailyTasksTable,
  interviewSessionsTable,
  recruiterInvites,
  applicationsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getActiveCourseProgress } from "./courseProgress";

export const GENERIC_SKILLS = new Set([
  "dsa", "data structures", "algorithms", "problem solving", "communication",
  "teamwork", "leadership", "time management", "critical thinking", "git",
  "linux", "python", "networking",
]);

const CAP = 5;
const COURSE_FRESH_MS = 14 * 24 * 60 * 60 * 1000;

export function istToday(): string {
  return istDateString(new Date());
}

export function istYesterday(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return istDateString(d);
}

function istDateString(d: Date): string {
  // IST = UTC+5:30, no DST.
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

interface Candidate {
  kind: string;
  label: string;
  sublabel?: string;
  href: string;
  hot: boolean;
  manual: boolean;
  source: "rule" | "report";
  meta?: Record<string, unknown>;
}

/**
 * The next incomplete track milestone, surfaced as a daily task (R8). Resolved
 * by lib/trackProgress.checkMilestones in the today-tasks route and threaded in
 * here as a param, so this module never imports trackProgress (avoids a cycle).
 */
export interface TrackStep {
  milestoneId: number;
  label: string;
  sublabel: string;
  href: string;
}

async function weakestSkill(studentId: number, skills: Record<string, number>): Promise<string | null> {
  const nonGeneric = Object.entries(skills).filter(([name]) => !GENERIC_SKILLS.has(name.toLowerCase().trim()));
  if (nonGeneric.length > 0) {
    return nonGeneric.sort(([, a], [, b]) => a - b)[0][0];
  }

  // Fall back to the weakest sub-score across recent evaluations, if any. Only
  // reached when there's no scored skill yet, so this query is skipped entirely
  // for the common case instead of always running alongside the skills lookup.
  const recent = await db
    .select({ evaluation: interviewSessionsTable.evaluation })
    .from(interviewSessionsTable)
    .where(and(eq(interviewSessionsTable.studentId, studentId), eq(interviewSessionsTable.completed, true)))
    .orderBy(desc(interviewSessionsTable.createdAt))
    .limit(3);

  for (const row of recent) {
    const ev = row.evaluation as { communicationScore?: number; technicalScore?: number; confidenceScore?: number } | null;
    if (!ev) continue;
    const entries = Object.entries({
      Communication: ev.communicationScore,
      Technical: ev.technicalScore,
      Confidence: ev.confidenceScore,
    }).filter((e): e is [string, number] => typeof e[1] === "number");
    if (entries.length > 0) return entries.sort(([, a], [, b]) => a - b)[0][0];
  }

  return null;
}

async function buildCandidates(
  studentId: number,
  student: typeof studentsTable.$inferSelect,
  trackStep?: TrackStep | null,
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  // R1/R2, R4, R5 are independent lookups against different tables — run them
  // concurrently instead of one round trip at a time.
  const [[completedInterview], [recentApplication], [pendingInvite]] = await Promise.all([
    db
      .select({ id: interviewSessionsTable.id })
      .from(interviewSessionsTable)
      .where(and(eq(interviewSessionsTable.studentId, studentId), eq(interviewSessionsTable.completed, true)))
      .limit(1),
    db
      .select({ id: applicationsTable.id })
      .from(applicationsTable)
      .where(eq(applicationsTable.studentId, studentId))
      .limit(1),
    db
      .select({ id: recruiterInvites.id })
      .from(recruiterInvites)
      .where(and(eq(recruiterInvites.studentId, studentId), eq(recruiterInvites.status, "pending"), eq(recruiterInvites.studentSeen, false)))
      .limit(1),
  ]);

  // R1 / R2 — exactly one hot task.
  if (!completedInterview) {
    candidates.push({
      kind: "first_mock",
      label: "Take your first mock interview",
      sublabel: "AI interviewer · 15 minutes",
      href: "/practice",
      hot: true,
      manual: false,
      source: "rule",
    });
  } else {
    const skill = await weakestSkill(studentId, (student.skills as Record<string, number>) ?? {});
    if (skill) {
      candidates.push({
        kind: "practice",
        label: `Your ${skill} score is your weakest area`,
        sublabel: "AI interviewer · 15 minutes",
        href: "/practice",
        hot: true,
        manual: false,
        source: "rule",
      });
    }
  }

  // R3 — resume the last-opened course, if progress is fresh and incomplete.
  const lastCourse = await getActiveCourseProgress(student.id);
  if (lastCourse && lastCourse.total > 0 && lastCourse.completed < lastCourse.total) {
    const fresh = Date.now() - new Date(lastCourse.updatedAt).getTime() < COURSE_FRESH_MS;
    if (fresh) {
      const pct = Math.round((lastCourse.completed / lastCourse.total) * 100);
      candidates.push({
        kind: "course",
        label: `Continue ${lastCourse.subDomainName}`,
        sublabel: `${pct}% complete`,
        href: "/practice/courses",
        hot: false,
        manual: false,
        source: "rule",
      });
    }
  }

  // R8 — the next incomplete track milestone (before R4 so it survives CAP).
  if (trackStep) {
    candidates.push({
      kind: "track_step",
      label: trackStep.label,
      sublabel: trackStep.sublabel,
      href: trackStep.href,
      hot: false,
      manual: false,
      source: "rule",
      meta: { milestoneId: trackStep.milestoneId },
    });
  }

  // R4 — pipeline nudge.
  candidates.push({
    kind: "jobs",
    label: recentApplication ? "Update your pipeline" : "Add a job to your pipeline",
    href: "/pipeline",
    hot: false,
    manual: true,
    source: "rule",
  });

  // R5 — a recruiter is waiting on a response.
  if (pendingInvite) {
    candidates.push({
      kind: "invite",
      label: "A recruiter is interested — respond",
      href: "/inbox",
      hot: false,
      manual: true,
      source: "rule",
    });
  }

  // R7 — always offered, manual.
  candidates.push({
    kind: "drive_check",
    label: "Scam-check a placement message",
    sublabel: "Only if you got one today",
    href: "/drive-check",
    hot: false,
    manual: true,
    source: "rule",
  });

  return candidates;
}

/** Idempotent: safe to call on every "today" load. R6 (report follow-ups) is written separately by the report's "Add" action, so it's read here as pre-existing rows, never generated. */
export async function generateTodayTasks(
  studentId: number,
  student: typeof studentsTable.$inferSelect,
  trackStep?: TrackStep | null,
): Promise<void> {
  const date = istToday();
  // existingKinds and the candidate pool don't depend on each other — build both concurrently.
  const [existing, candidatesRaw] = await Promise.all([
    db
      .select({ kind: dailyTasksTable.kind })
      .from(dailyTasksTable)
      .where(and(eq(dailyTasksTable.studentId, studentId), eq(dailyTasksTable.date, date))),
    buildCandidates(studentId, student, trackStep),
  ]);
  const existingKinds = new Set(existing.map((r) => r.kind));

  const candidates = candidatesRaw.filter((c) => !existingKinds.has(c.kind));
  const remainingSlots = Math.max(0, CAP - existing.length);
  const toInsert = candidates.slice(0, remainingSlots);
  if (toInsert.length === 0) return;

  await db
    .insert(dailyTasksTable)
    .values(
      toInsert.map((c) => ({
        studentId,
        date,
        kind: c.kind,
        label: c.label,
        sublabel: c.sublabel ?? null,
        href: c.href,
        hot: c.hot,
        manual: c.manual,
        done: false,
        source: c.source,
        meta: c.meta ?? null,
      })),
    )
    .onConflictDoNothing();
}

export async function getTodayTasks(studentId: number, student: typeof studentsTable.$inferSelect, trackStep?: TrackStep | null) {
  await generateTodayTasks(studentId, student, trackStep);
  const date = istToday();
  const rows = await db
    .select()
    .from(dailyTasksTable)
    .where(and(eq(dailyTasksTable.studentId, studentId), eq(dailyTasksTable.date, date)))
    .orderBy(desc(dailyTasksTable.hot), dailyTasksTable.id);
  return { date, tasks: rows };
}

const XP_PER_TASK = 20;
const XP_ALL_DONE_BONUS = 50;

/** Same formula as quests.ts's level derivation — keep both in sync if either changes. */
function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 500) + 1);
}

/**
 * Awards XP for a task completion (and a same-day bonus for finishing every
 * task), or revokes it on uncomplete. Called from completeTask so every path
 * that flips `done` — manual toggle and autoCompleteTaskKind alike — earns
 * XP consistently. Uncomplete doesn't try to claw back a bonus that may have
 * come from a different task; simplicity over perfect symmetry on an edge case.
 */
async function applyTaskXp(studentId: number, date: string, justCompleted: boolean): Promise<{ xp: number; level: number }> {
  const [student] = await db.select({ xp: studentsTable.xp }).from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
  let xp = student?.xp ?? 0;

  if (justCompleted) {
    xp += XP_PER_TASK;
    const todaysTasks = await db
      .select({ done: dailyTasksTable.done })
      .from(dailyTasksTable)
      .where(and(eq(dailyTasksTable.studentId, studentId), eq(dailyTasksTable.date, date)));
    const allDone = todaysTasks.length > 0 && todaysTasks.every((t) => t.done);
    if (allDone) xp += XP_ALL_DONE_BONUS;
  } else {
    xp = Math.max(0, xp - XP_PER_TASK);
  }

  const level = levelForXp(xp);
  await db.update(studentsTable).set({ xp, level }).where(eq(studentsTable.id, studentId));
  return { xp, level };
}

export async function completeTask(studentId: number, taskId: number, done: boolean) {
  const [task] = await db
    .update(dailyTasksTable)
    .set({ done, completedAt: done ? new Date() : null })
    .where(and(eq(dailyTasksTable.id, taskId), eq(dailyTasksTable.studentId, studentId)))
    .returning();
  if (!task) return null;
  const streakCount = await recomputeStreak(studentId);
  const { xp, level } = await applyTaskXp(studentId, task.date, done);
  return { task, streakCount, xp, level };
}

/** Consecutive IST days ending today or yesterday with >=1 completed task. Writes the students.streakCount cache and returns it. */
export async function recomputeStreak(studentId: number): Promise<number> {
  const doneDates = await db
    .selectDistinct({ date: dailyTasksTable.date })
    .from(dailyTasksTable)
    .where(and(eq(dailyTasksTable.studentId, studentId), eq(dailyTasksTable.done, true)));
  const dateSet = new Set(doneDates.map((r) => r.date));

  let count = 0;
  const today = istToday();
  const yesterday = istYesterday();
  let cursor: Date;
  if (dateSet.has(today)) {
    cursor = new Date(`${today}T00:00:00Z`);
  } else if (dateSet.has(yesterday)) {
    cursor = new Date(`${yesterday}T00:00:00Z`);
  } else {
    await db.update(studentsTable).set({ streakCount: 0 }).where(eq(studentsTable.id, studentId));
    return 0;
  }

  while (dateSet.has(cursor.toISOString().slice(0, 10))) {
    count++;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  await db.update(studentsTable).set({ streakCount: count }).where(eq(studentsTable.id, studentId));
  return count;
}

/** Writer for R6 — an interview report's "Add" button inserts a followup task for tomorrow. */
export async function addFollowupTask(studentId: number, label: string, sublabel: string | undefined, href: string) {
  const tomorrow = istDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [row] = await db
    .insert(dailyTasksTable)
    .values({
      studentId,
      date: tomorrow,
      kind: "followup",
      label,
      sublabel: sublabel ?? null,
      href,
      hot: false,
      manual: true,
      done: false,
      source: "report",
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/** Called after a course-progress update; auto-completes today's course task if one exists. */
export async function autoCompleteTaskKind(studentId: number, kind: string): Promise<void> {
  const date = istToday();
  const [row] = await db
    .select({ id: dailyTasksTable.id, done: dailyTasksTable.done })
    .from(dailyTasksTable)
    .where(and(eq(dailyTasksTable.studentId, studentId), eq(dailyTasksTable.date, date), eq(dailyTasksTable.kind, kind)))
    .limit(1);
  if (row && !row.done) {
    await completeTask(studentId, row.id, true);
  }
}

/** One label per task kind for the hot-task hero CTA (TaskRow only renders it when hot). */
const CTA_LABEL_BY_KIND: Record<string, string> = {
  first_mock: "Start",
  practice: "Start",
  course: "Learn",
  jobs: "See jobs",
  invite: "Invite",
  drive_check: "Check",
  followup: "Do it",
  track_step: "Go",
};

export function formatDailyTask(t: typeof dailyTasksTable.$inferSelect) {
  return {
    id: String(t.id),
    label: t.label,
    sublabel: t.sublabel ?? undefined,
    done: t.done,
    hot: t.hot,
    ctaLabel: CTA_LABEL_BY_KIND[t.kind] ?? "Open",
    href: t.href,
    manual: t.manual,
  };
}
