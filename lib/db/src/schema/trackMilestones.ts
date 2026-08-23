import { pgTable, serial, integer, text, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { learningTracksTable } from "./learningTracks";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One ordered milestone within a learning track. `kind` selects a checker in
 * lib/trackProgress.ts that decides "done" purely from existing student data
 * (profile strength, skills, mock sessions, courses, resumes, applications) —
 * there is no manual mark-done. `config` carries the checker's threshold, e.g.
 * { minStrength: 60 }, { count: 3 }, { minScore: 60 }.
 */
export const trackMilestonesTable = pgTable("track_milestones", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id").notNull().references(() => learningTracksTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  config: jsonb("config").notNull().default({}),
}, t => ({
  trackPositionIdx: uniqueIndex("track_milestones_track_position_idx").on(t.trackId, t.position),
  trackIdx: index("track_milestones_track_idx").on(t.trackId),
}));

export const insertTrackMilestoneSchema = createInsertSchema(trackMilestonesTable).omit({ id: true });
export type InsertTrackMilestone = z.infer<typeof insertTrackMilestoneSchema>;
export type TrackMilestone = typeof trackMilestonesTable.$inferSelect;
