import { pgTable, serial, integer, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";

export const studentResumesTable = pgTable("student_resumes", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  templateId: text("template_id").notNull().default("classic"),
  jdText: text("jd_text"),
  companyName: text("company_name"),
  // Accepted from the client since day one but silently discarded — now persisted.
  roleTitle: text("role_title"),
  jobTags: jsonb("job_tags").notNull().default([]),
  content: jsonb("content").notNull(),
  // Deterministic ATS score/report (see @workspace/resume-core's ats.ts) — a pure
  // function of (content, jobTags/jdText), recomputed on every PATCH so it never
  // goes stale relative to hand-edited content.
  atsScore: integer("ats_score"),
  atsReport: jsonb("ats_report"),
  // Deterministic quality score (see @workspace/resume-core's quality.ts) — a
  // pure function of content, recomputed on every write like atsScore.
  qualityScore: integer("quality_score"),
  // Last AI-judge review (validated object + band/percentile framing) and when
  // it ran. Content-hash cached server-side; stale relative to content is fine —
  // the UI re-requests on the finish step.
  aiReview: jsonb("ai_review"),
  aiReviewedAt: timestamp("ai_reviewed_at"),
  // User-attested metrics from the quantification coach: values the student
  // typed themselves, kept forever so "UA:n" evidence citations stay valid.
  quantFacts: jsonb("quant_facts").notNull().default([]),
  // Stage-2 evidence map (coverage/thesis/honestGaps) — kept so a later PATCH or
  // "regenerate" can re-use the same strategy without re-running the pipeline.
  evidenceMap: jsonb("evidence_map"),
  // Pipeline telemetry: which stages ran/cached/degraded, critic scores, and what
  // the fabrication gate removed. Debugging aid, never shown raw to students.
  generation: jsonb("generation"),
  schemaVersion: integer("schema_version").notNull().default(1),
  // "Regenerate" creates a new row pointing at the old one rather than mutating
  // it in place, so a bad regeneration never destroys a resume that was working.
  parentResumeId: integer("parent_resume_id"),
  // Public share link. Generated on demand; null means the resume is private.
  shareSlug: text("share_slug"),
  shareViews: integer("share_views").notNull().default(0),
  // Undo history: up to 5 prior {content, templateId, atsScore, savedAt} snapshots,
  // newest first. Pushed onto by PATCH when the caller passes snapshot:true.
  versions: jsonb("versions").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => ({
  studentIdx: index("student_resumes_student_id_idx").on(t.studentId),
  studentCreatedIdx: index("student_resumes_student_created_idx").on(t.studentId, t.createdAt.desc()),
  shareSlugIdx: uniqueIndex("student_resumes_share_slug_idx").on(t.shareSlug),
}));

export type StudentResume = typeof studentResumesTable.$inferSelect;
