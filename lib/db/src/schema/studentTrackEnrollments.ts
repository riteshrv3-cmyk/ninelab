import { pgTable, serial, integer, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { learningTracksTable } from "./learningTracks";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A student's progress through one learning track. Modeled on
 * courseEnrollmentsTable: one row per (student, track), with completion held
 * as a jsonb map rather than a row-per-milestone table (which would recreate
 * the dead student_quests shape).
 *
 * completedMilestones maps milestoneId -> ISO completion timestamp, preserving
 * per-milestone dates without extra rows. milestonesDone / milestonesTotal are
 * DENORMALIZED counts written on every checker run so the TPO batch dashboard
 * aggregates via plain integer columns and never scans the jsonb.
 */
export const studentTrackEnrollmentsTable = pgTable("student_track_enrollments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  trackId: integer("track_id").notNull().references(() => learningTracksTable.id, { onDelete: "cascade" }),
  completedMilestones: jsonb("completed_milestones").notNull().default({}), // { [milestoneId]: ISO date }
  milestonesDone: integer("milestones_done").notNull().default(0),
  milestonesTotal: integer("milestones_total").notNull().default(0),
  status: text("status").notNull().default("in_progress"), // in_progress | completed
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => ({
  studentTrackIdx: uniqueIndex("student_track_enrollments_student_track_idx").on(t.studentId, t.trackId),
  studentIdx: index("student_track_enrollments_student_idx").on(t.studentId),
  trackIdx: index("student_track_enrollments_track_idx").on(t.trackId),
}));

export const insertStudentTrackEnrollmentSchema = createInsertSchema(studentTrackEnrollmentsTable).omit({ id: true, startedAt: true, updatedAt: true });
export type InsertStudentTrackEnrollment = z.infer<typeof insertStudentTrackEnrollmentSchema>;
export type StudentTrackEnrollment = typeof studentTrackEnrollmentsTable.$inferSelect;
