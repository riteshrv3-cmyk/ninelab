import { db, studentActivityLogTable } from "@workspace/db";
import { logger } from "./logger";

/** Typed event actions Kit's noticing engine reads. Never mix with legacy quest/XP actions. */
export type EventAction =
  | "task_completed"
  | "all_tasks_done"
  | "interview_completed"
  | "application_added"
  | "application_status_changed"
  | "course_progress"
  | "course_completed"
  | "resume_generated"
  | "resume_shared"
  | "resume_downloaded"
  | "resume_reviewed"
  | "resume_quantified"
  | "goal_changed"
  | "profile_imported"
  | "opportunity_opened";

/** Fire-and-forget event log write. Never blocks or throws into the caller's response path. */
export function logEvent(studentId: number, action: EventAction, description: string, payload?: Record<string, unknown>): void {
  db.insert(studentActivityLogTable)
    .values({ studentId, action, description, xpAmount: 0, payload: payload ?? null })
    .catch((err) => logger.error({ err, studentId, action }, "Failed to log student event (non-fatal)"));
}
