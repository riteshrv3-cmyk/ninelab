import { pgTable, serial, integer, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { collegesTable } from "./colleges";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * TPO (placement officer) access, on Clerk auth rather than the legacy
 * tpo_accounts email+password system (which is being retired).
 *
 * Allowlist model: an admin creates a row with {email, collegeId}. The
 * clerkUserId is null until that email first signs in via Clerk, at which
 * point requireCollegeAdmin binds it (one-time). email is the allowlist key
 * and is always stored lowercased so the Clerk primary-email match is exact.
 */
export const collegeAdminsTable = pgTable("college_admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(), // lowercased allowlist key
  clerkUserId: text("clerk_user_id"),      // null until first sign-in; bound lazily
  name: text("name"),
  collegeId: integer("college_id").notNull().references(() => collegesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at"),
}, t => ({
  clerkUserIdIdx: uniqueIndex("college_admins_clerk_user_id_idx").on(t.clerkUserId),
  collegeIdx: index("college_admins_college_idx").on(t.collegeId),
}));

export const insertCollegeAdminSchema = createInsertSchema(collegeAdminsTable).omit({ id: true, createdAt: true });
export type InsertCollegeAdmin = z.infer<typeof insertCollegeAdminSchema>;
export type CollegeAdmin = typeof collegeAdminsTable.$inferSelect;
