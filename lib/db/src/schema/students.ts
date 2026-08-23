import { pgTable, serial, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  college: text("college").notNull(),
  city: text("city").notNull(),
  year: integer("year").notNull(),
  field: text("field").notNull(),
  photoUrl: text("photo_url"),

  // ─── Career links ─────────────────────────────────────────────────────────
  githubUrl: text("github_url"),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  phone: text("phone"),
  bio: text("bio"),

  // ─── Academic / goals ─────────────────────────────────────────────────────
  cgpa: text("cgpa"),
  targetPackage: text("target_package"),
  dreamCompany: text("dream_company"),

  // ─── Rich profile data ────────────────────────────────────────────────────
  projects: jsonb("projects").notNull().default([]),
  certifications: jsonb("certifications").notNull().default([]),
  // { id, company, role, period, bullets: string[] }[] — feeds the resume EXPERIENCE section
  experience: jsonb("experience").notNull().default([]),
  // { id, degree, institution, field, start, end, cgpa? }[] — feeds the resume EDUCATION
  // section; empty until the student fills the Profile card, so resume generation
  // falls back to the flat degree/college/field/cgpa columns above when this is empty.
  education: jsonb("education").notNull().default([]),

  // ─── Job preferences ──────────────────────────────────────────────────────
  openToWork: boolean("open_to_work").notNull().default(true),
  workMode: text("work_mode").default("hybrid"),
  preferredLocations: jsonb("preferred_locations").notNull().default([]),
  expectedSalary: text("expected_salary"),

  // ─── AI-analyzed data ────────────────────────────────────────────────────
  githubStats: jsonb("github_stats"),
  linkedinData: jsonb("linkedin_data"),

  // ─── Scores ───────────────────────────────────────────────────────────────
  profileStrength: integer("profile_strength").notNull().default(0),
  commitmentScore: integer("commitment_score").notNull().default(0),
  overallScore: integer("overall_score").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streakCount: integer("streak_count").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  // Rules-based placement readiness (0-100), computed in lib/readiness.ts from
  // profile strength + skills + track milestones + mock scores. Persisted so
  // the TPO dashboard sorts/aggregates in SQL. Distinct from overallScore
  // (which the leaderboard sorts on and only the legacy quests route moves).
  readinessScore: integer("readiness_score").notNull().default(0),
  skills: jsonb("skills").notNull().default({}),
  isPro: boolean("is_pro").notNull().default(false),
  collegeId: integer("college_id"),

  // ─── Auth / identity ──────────────────────────────────────────────────────
  clerkUserId: text("clerk_user_id"), // null = unclaimed guest row; uniqueness enforced by students_clerk_user_id_idx below
  guestToken: text("guest_token"),             // random secret for anonymous sessions; nulled on claim

  // ─── Agent core (goal + baseline + course signal) ─────────────────────────
  targetRole: text("target_role"),             // goal picker, e.g. "SDE", "Data/ML"
  targetBatch: integer("target_batch"),        // placement/grad year, e.g. 2027
  baselineScore: integer("baseline_score"),    // first completed mock's score; set once
  // (lastCourse column removed — active-course signal now derived from
  //  courseEnrollments via lib/courseProgress.getActiveCourseProgress.)
  noticingHistory: jsonb("noticing_history"),  // { [ruleType]: lastShownDate, lastGapFramedDate }
  // Opportunity ids already surfaced to this student, newest-first and capped.
  // Compared against the live matched feed to mark genuinely-new listings —
  // id-based rather than date-based because sources report posting age as a
  // humanised string ("7d ago"), which is not a reliable ordering key.
  seenOpportunityIds: jsonb("seen_opportunity_ids").notNull().default([]),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => ({
  collegeIdIdx: index("students_college_id_idx").on(t.collegeId),
  collegeReadinessIdx: index("students_college_readiness_idx").on(t.collegeId, t.readinessScore),
  clerkUserIdIdx: uniqueIndex("students_clerk_user_id_idx").on(t.clerkUserId),
  collegeIdx: index("students_college_idx").on(t.college),
  openToWorkIdx: index("students_open_to_work_idx").on(t.openToWork),
  yearIdx: index("students_year_idx").on(t.year),
  fieldIdx: index("students_field_idx").on(t.field),
  overallScoreIdx: index("students_overall_score_idx").on(t.overallScore),
  collegeScoreIdx: index("students_college_score_idx").on(t.college, t.overallScore),
  recruiterSearchIdx: index("students_recruiter_search_idx").on(t.openToWork, t.year, t.college),
}));

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
