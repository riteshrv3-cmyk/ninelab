import { db, studentsTable, studentTrackEnrollmentsTable, interviewSessionsTable } from "@workspace/db";
import { and, eq, desc, isNotNull } from "drizzle-orm";
import { computeProfileStrength } from "./profileStrength";
import { GENERIC_SKILLS } from "./dailyTasks";

type Student = typeof studentsTable.$inferSelect;

export interface ReadinessBreakdown {
  profile: number; // 0-100 profile completeness
  skills: number;  // 0-100 coverage x depth
  track: number;   // 0-100 milestones done / total
  mocks: number;   // 0-100 avg of last 3 completed mock scores
}

export interface ReadinessResult {
  score: number;
  breakdown: ReadinessBreakdown;
}

// Weights sum to 1.0 — track weighted highest because it is the loop the sprint
// sells, so an unenrolled/new student lands honestly low.
const W_PROFILE = 0.25;
const W_SKILLS = 0.20;
const W_TRACK = 0.30;
const W_MOCKS = 0.25;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** coverage (up to 5 non-generic skills) x average depth of those skills. 0-100. */
export function computeSkillsScore(skills: Record<string, number> | null | undefined): number {
  const entries = Object.entries(skills ?? {}).filter(([name]) => !GENERIC_SKILLS.has(name.toLowerCase().trim()));
  if (entries.length === 0) return 0;
  const coverage = Math.min(entries.length, 5) / 5;
  const values = entries.map(([, v]) => Number(v)).filter((v) => Number.isFinite(v));
  const depth = values.length ? clamp(values.reduce((a, b) => a + b, 0) / values.length, 0, 100) : 0;
  return Math.round(coverage * depth);
}

/**
 * Pure readiness computation from pre-loaded signals — no DB. The seed script
 * and refreshReadiness both call this so persisted numbers are provably the
 * real formula.
 */
export function computeReadiness(input: { student: Student; trackPct: number; mockScore: number }): ReadinessResult {
  const profile = computeProfileStrength(input.student);
  const skills = computeSkillsScore(input.student.skills as Record<string, number>);
  const track = clamp(Math.round(input.trackPct), 0, 100);
  const mocks = clamp(Math.round(input.mockScore), 0, 100);
  const score = Math.round(W_PROFILE * profile + W_SKILLS * skills + W_TRACK * track + W_MOCKS * mocks);
  return { score, breakdown: { profile, skills, track, mocks } };
}

/** Track completion percent from the student's enrollment (0 if unenrolled). */
export async function loadTrackPct(studentId: number): Promise<number> {
  const [enr] = await db
    .select({ done: studentTrackEnrollmentsTable.milestonesDone, total: studentTrackEnrollmentsTable.milestonesTotal })
    .from(studentTrackEnrollmentsTable)
    .where(eq(studentTrackEnrollmentsTable.studentId, studentId))
    .orderBy(desc(studentTrackEnrollmentsTable.updatedAt))
    .limit(1);
  if (!enr || enr.total <= 0) return 0;
  return (enr.done / enr.total) * 100;
}

/** Average overallScore of the last 3 completed mock interviews (0 if none). */
export async function loadMockScore(studentId: number): Promise<number> {
  const rows = await db
    .select({ overallScore: interviewSessionsTable.overallScore })
    .from(interviewSessionsTable)
    .where(and(
      eq(interviewSessionsTable.studentId, studentId),
      eq(interviewSessionsTable.completed, true),
      isNotNull(interviewSessionsTable.overallScore),
    ))
    .orderBy(desc(interviewSessionsTable.createdAt))
    .limit(3);
  const scores = rows.map((r) => Number(r.overallScore)).filter((v) => Number.isFinite(v));
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Loads the readiness signals, computes the score, persists it to
 * students.readinessScore, and returns the breakdown. Pass a preloaded student
 * to skip the re-read (checkMilestones already holds it).
 */
export async function refreshReadiness(studentId: number, preloaded?: Student): Promise<ReadinessResult> {
  let student = preloaded;
  if (!student) {
    [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
  }
  if (!student) return { score: 0, breakdown: { profile: 0, skills: 0, track: 0, mocks: 0 } };

  const [trackPct, mockScore] = await Promise.all([loadTrackPct(studentId), loadMockScore(studentId)]);
  const result = computeReadiness({ student, trackPct, mockScore });
  await db.update(studentsTable).set({ readinessScore: result.score }).where(eq(studentsTable.id, studentId));
  return result;
}
