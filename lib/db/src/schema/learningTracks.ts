import { pgTable, serial, integer, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { collegesTable } from "./colleges";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A college-defined learning track: an ordered set of milestones (see
 * trackMilestonesTable) that a TPO curates for their batch.
 *
 * collegeId is nullable: a null collegeId marks a GLOBAL DEFAULT template
 * shipped with the app (seeded idempotently at boot via templateKey). A TPO
 * "picks" a template by CLONING it into a college-owned row (collegeId set,
 * templateKey null) plus copied milestones, then edits freely — so editing a
 * college's track never mutates the shipped template.
 *
 * One active track per college is enforced in application code (activating a
 * new track deactivates the previous one).
 */
export const learningTracksTable = pgTable("learning_tracks", {
  id: serial("id").primaryKey(),
  collegeId: integer("college_id").references(() => collegesTable.id, { onDelete: "cascade" }), // null = global default template
  templateKey: text("template_key"), // set only on shipped templates; makes boot seeding idempotent
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => ({
  templateKeyIdx: uniqueIndex("learning_tracks_template_key_idx").on(t.templateKey),
  collegeIdx: index("learning_tracks_college_idx").on(t.collegeId),
}));

export const insertLearningTrackSchema = createInsertSchema(learningTracksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLearningTrack = z.infer<typeof insertLearningTrackSchema>;
export type LearningTrack = typeof learningTracksTable.$inferSelect;
