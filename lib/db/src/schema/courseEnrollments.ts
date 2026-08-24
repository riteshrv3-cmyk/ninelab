import { pgTable, serial, integer, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Replaces students.lastCourse (a single overwritten jsonb field — only one
 * course was ever tracked). One row per student per subdomain, so a student
 * can have several courses in flight and revisiting a subdomain resumes the
 * same row instead of creating a duplicate.
 *
 * subDomainId/domainId are validated text, not FKs: the domain taxonomy is
 * frontend-owned static data (artifacts/ninelab/src/data/domains.ts),
 * effectively a stable enum with no runtime table behind it.
 */
export const courseEnrollmentsTable = pgTable("course_enrollments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  subDomainId: text("sub_domain_id").notNull(),
  subDomainName: text("sub_domain_name").notNull(),
  domainId: text("domain_id").notNull(),
  domainName: text("domain_name").notNull(),
  // Skills snapshot at generation time — kept alongside courseData so the
  // course-generate cache key (subDomainName+domainName+skills) stays
  // reconstructible without re-reading the student's current skill set.
  skills: jsonb("skills").notNull().default([]),
  // The generated {modules, flashcards, quizQuestions} payload, stored per
  // enrollment so a student's course survives the 30-day ai_cache TTL and so
  // module-quiz attempts can grade against the exact question set they saw.
  courseData: jsonb("course_data"),
  completedLessonIds: jsonb("completed_lesson_ids").notNull().default([]),
  watchedVideoIds: jsonb("watched_video_ids").notNull().default([]),
  status: text("status").notNull().default("in_progress"), // in_progress | completed
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => ({
  studentIdx: index("course_enrollments_student_idx").on(t.studentId),
  // One active enrollment per subdomain — re-entering a course resumes it.
  studentSubDomainIdx: uniqueIndex("course_enrollments_student_subdomain_idx").on(t.studentId, t.subDomainId),
  studentUpdatedIdx: index("course_enrollments_student_updated_idx").on(t.studentId, t.updatedAt.desc()),
}));

export const insertCourseEnrollmentSchema = createInsertSchema(courseEnrollmentsTable).omit({ id: true, startedAt: true, updatedAt: true });
export type InsertCourseEnrollment = z.infer<typeof insertCourseEnrollmentSchema>;
export type CourseEnrollment = typeof courseEnrollmentsTable.$inferSelect;
