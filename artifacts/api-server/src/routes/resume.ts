import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable, studentResumesTable, applicationsTable } from "@workspace/db";
import { eq, and, desc, sql, isNull, ilike } from "drizzle-orm";
import { createHash } from "node:crypto";
import { buildAtsReport, buildQualityReport, renderPlainText, upgradeContent, type QuantFact, type TemplateDensity, type ResumeVersion, MAX_RESUME_VERSIONS } from "@workspace/resume-core";
import { GenerateResumeBody, UpdateResumeBody, ImproveResumeSectionBody, QuantApplyBody } from "@workspace/api-zod";
import { rlAiMedium, rlResumeGen } from "../middlewares/rateLimit";
import { requireStudent } from "../middlewares/studentAuth";
import { logEvent } from "../lib/events";
import { cacheGetOrSet } from "../lib/aiCache";
import { runResumePipeline } from "../lib/resume/pipeline";
import { buildLedger, ledgerVolume, parseQuantFacts, withQuantFacts } from "../lib/resume/ledger";
import { bulletPassesGate } from "../lib/resume/gate";
import { rewriteBullet, BULLET_REWRITE_ACTIONS, type BulletRewriteAction } from "../lib/resume/bulletRewrite";
import { improveSection, ImproveRejectedError, IMPROVABLE_SECTIONS, type ImprovableSection } from "../lib/resume/sectionImprove";
import { reviewResume, percentileBand } from "../lib/resume/review";
import { generateQuantQuestions, applyQuantAnswers, ANSWER_VALUE_RE } from "../lib/resume/quantCoach";

const router = Router();

const VALID_TEMPLATES = ["ats", "classic", "tech", "minimal"] as const;
type TemplateId = typeof VALID_TEMPLATES[number];

// Mirrors artifacts/ninelab/src/lib/resume-pdf/templates/*.ts — the server
// has no access to those client-only template configs (fonts/colors), but
// needs the density value for estimateLayout()'s densityFit critic axis.
// Keep this in sync if a template's density ever changes.
const TEMPLATE_DENSITY: Record<TemplateId, TemplateDensity> = {
  ats: "normal",
  classic: "airy",
  tech: "compact",
  minimal: "airy",
};

// ─── GET /students/:id/resumes ────────────────────────────────────────────────

router.get("/students/:id/resumes", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const resumes = await db
      .select()
      .from(studentResumesTable)
      .where(eq(studentResumesTable.studentId, id))
      .orderBy(desc(studentResumesTable.createdAt));
    return res.json(resumes);
  } catch (err) {
    req.log.error({ err }, "Failed to list resumes");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /students/:id/resumes ───────────────────────────────────────────────

// Stage copy is how the student "feels" the reasoning happening — shown only over SSE.
const STAGE_COPY: Record<string, string> = {
  jd: "Understanding your target role…",
  map: "Matching it against your real work…",
  draft: "Writing your bullets…",
  critic: "Running it through an ATS screen…",
};

router.post("/students/:id/resumes", requireStudent({ allowGuest: true }), rlResumeGen, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsedBody = GenerateResumeBody.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ error: parsedBody.error.message });
  const body = parsedBody.data;

  const templateId = (body.templateId ?? "classic") as TemplateId;
  const jdText = (body.jdText ?? "").slice(0, 5000);
  const companyName = (body.companyName ?? "").slice(0, 200);
  const resumeName = body.resumeName?.slice(0, 200);
  let roleTitle = (body.roleTitle ?? "").slice(0, 200);
  let jobTags = (body.jobTags ?? []).slice(0, 8).map(t => t.slice(0, 40));
  const parentResumeId = body.parentResumeId ?? null;

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
  if (!student) return res.status(404).json({ error: "Student not found" });

  // Substance gate. With an empty ledger the pipeline still runs and the
  // fabrication gate strips every unsupported bullet, so what comes out is a
  // name, a degree, and a one-line summary — a document that looks like a
  // resume and helps nobody. Refuse instead: a resume can only be as real as
  // the profile behind it, and the student is better served by the capture
  // step than by a hollow PDF. (Client-side gating is UX; this is the rule.)
  const volume = ledgerVolume(buildLedger(student));
  const substance = volume.skillCount + volume.projectCount + volume.experienceCount + volume.certificationCount;
  if (substance === 0) {
    return res.status(422).json({
      error: "Add your skills, a project, or an internship first — we only write from what's actually on your profile.",
      code: "EMPTY_PROFILE",
    });
  }

  // Profile-only generation: with no JD and no tags, stage 1 would infer from
  // nothing. Seed the target from the profile so the pipeline still gets a
  // coherent role to write toward.
  if (!jdText.trim() && jobTags.length === 0) {
    if (!roleTitle.trim() && typeof student.targetRole === "string") roleTitle = student.targetRole.slice(0, 200);
    const skills = (student.skills && typeof student.skills === "object" ? student.skills : {}) as Record<string, number>;
    jobTags = Object.entries(skills)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 8)
      .map(([name]) => name.slice(0, 40));
  }

  // Validate parentResumeId belongs to this student (if provided).
  if (parentResumeId) {
    const [parent] = await db.select({ id: studentResumesTable.id, studentId: studentResumesTable.studentId })
      .from(studentResumesTable).where(eq(studentResumesTable.id, parentResumeId)).limit(1);
    if (!parent || parent.studentId !== id) {
      return res.status(400).json({ error: "Invalid parentResumeId" });
    }
  }

  const isSSE = req.headers.accept === "text/event-stream";
  const controller = new AbortController();
  req.on("close", () => controller.abort());

  if (isSSE) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
  }

  try {
    const { doc, generation, evidenceMap } = await runResumePipeline({
      student,
      jdText,
      roleTitle,
      jobTags,
      templateDensity: TEMPLATE_DENSITY[templateId],
      signal: controller.signal,
      onProgress: isSSE
        ? (stage, status, payload) => {
            res.write(`data: ${JSON.stringify({ stage, status, message: STAGE_COPY[stage] ?? stage, ...payload })}\n\n`);
          }
        : undefined,
    });

    const name =
      resumeName?.trim() ||
      (companyName && roleTitle
        ? `${companyName} — ${roleTitle}`
        : companyName
          ? `${companyName} Resume`
          : `${templateId.charAt(0).toUpperCase() + templateId.slice(1)} Resume`);

    const [saved] = await db
      .insert(studentResumesTable)
      .values({
        studentId: id,
        name,
        templateId,
        jdText: jdText || null,
        companyName: companyName || null,
        roleTitle: roleTitle || null,
        jobTags,
        content: doc,
        atsScore: doc.atsMeta?.scorePct ?? null,
        atsReport: doc.atsMeta ?? null,
        qualityScore: buildQualityReport(doc, { density: TEMPLATE_DENSITY[templateId] }).total,
        evidenceMap,
        generation,
        schemaVersion: 2,
        parentResumeId: parentResumeId ?? null,
      })
      .returning();

    logEvent(id, "resume_generated", name, { templateId, degraded: generation.degraded });

    if (isSSE) {
      res.write(`data: ${JSON.stringify({ done: true, resume: saved })}\n\n`);
      res.end();
    } else {
      res.status(201).json(saved);
    }
  } catch (err) {
    if (controller.signal.aborted) {
      // Client disconnected mid-generation — nothing to send back, and the
      // aborted OpenAI call means we didn't pay for a response nobody reads.
      if (!res.writableEnded) res.end();
      return;
    }
    req.log.error({ err }, "Failed to generate resume");
    if (isSSE) {
      res.write(`data: ${JSON.stringify({ done: true, error: true })}\n\n`);
      res.end();
    } else if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate resume" });
    }
  }
  return;
});

// ─── PATCH /students/:id/resumes/:resumeId ────────────────────────────────────

router.patch("/students/:id/resumes/:resumeId", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });

  const parsedBody = UpdateResumeBody.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ error: parsedBody.error.message });
  const body = parsedBody.data;

  if (body.content === undefined && body.templateId === undefined) {
    return res.status(400).json({ error: "Provide content and/or templateId to update" });
  }
  const templateId = body.templateId as TemplateId | undefined;
  const incoming = (body.content ?? {}) as Record<string, unknown>;

  try {
    const [resume] = await db
      .select()
      .from(studentResumesTable)
      .where(eq(studentResumesTable.id, resumeId))
      .limit(1);

    if (!resume || resume.studentId !== id) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const existingContent = (resume.content ?? {}) as Record<string, unknown>;

    // Everything is editable — contact, headline, education, and section order
    // included. The merged blob is normalized through upgradeContent before it
    // is persisted, so a v1 row becomes v2 on its first edit and malformed
    // shapes are coerced rather than stored raw.
    const allowedKeys = ["contact", "headline", "summary", "order", "skillSections", "experience", "projects", "education", "certifications", "achievements"] as const;
    const patchedFields: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in incoming) {
        patchedFields[key] = incoming[key];
      }
    }

    const upgradedDoc = upgradeContent({ ...upgradeContent(existingContent), ...patchedFields });

    // Recompute the deterministic scores against the edited content —
    // otherwise the numbers shown to the student go stale the moment they
    // change a bullet or add a skill.
    const jobTags = Array.isArray(resume.jobTags) ? (resume.jobTags as unknown[]).filter((t): t is string => typeof t === "string") : [];
    const atsReport = buildAtsReport({ doc: upgradedDoc, jdText: resume.jdText ?? undefined, jobTags });
    const effectiveTemplate = (templateId ?? resume.templateId) as TemplateId;
    const quality = buildQualityReport(upgradedDoc, { density: TEMPLATE_DENSITY[effectiveTemplate] ?? "normal" });

    const setFields: { content: Record<string, unknown>; templateId?: TemplateId; atsScore?: number | null; atsReport?: unknown; qualityScore?: number; schemaVersion?: number; versions?: ResumeVersion[]; updatedAt: Date } = {
      content: upgradedDoc as unknown as Record<string, unknown>,
      atsScore: atsReport?.scorePct ?? null,
      atsReport: atsReport ?? null,
      qualityScore: quality.total,
      schemaVersion: 2,
      updatedAt: new Date(),
    };
    if (templateId) setFields.templateId = templateId;

    if (body.snapshot) {
      const existingVersions = Array.isArray(resume.versions) ? (resume.versions as ResumeVersion[]) : [];
      const snapshot: ResumeVersion = {
        content: upgradeContent(existingContent),
        templateId: resume.templateId,
        atsScore: resume.atsScore,
        savedAt: new Date().toISOString(),
      };
      setFields.versions = [snapshot, ...existingVersions].slice(0, MAX_RESUME_VERSIONS);
    }

    const [updated] = await db
      .update(studentResumesTable)
      .set(setFields)
      .where(eq(studentResumesTable.id, resumeId))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update resume");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /students/:id/resumes/:resumeId/restore-version ────────────────────
// Restores a prior snapshot from `versions` as the current content. The state
// being replaced is itself pushed onto the history first, so restoring is
// always undoable too — nothing is ever discarded, only reordered.

router.post("/students/:id/resumes/:resumeId/restore-version", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });

  const index = Number(req.body?.index);
  if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: "Invalid index" });

  try {
    const [resume] = await db.select().from(studentResumesTable).where(eq(studentResumesTable.id, resumeId)).limit(1);
    if (!resume || resume.studentId !== id) return res.status(404).json({ error: "Resume not found" });

    const versions = Array.isArray(resume.versions) ? (resume.versions as ResumeVersion[]) : [];
    const target = versions[index];
    if (!target) return res.status(404).json({ error: "Version not found" });

    const currentSnapshot: ResumeVersion = {
      content: upgradeContent((resume.content ?? {}) as Record<string, unknown>),
      templateId: resume.templateId,
      atsScore: resume.atsScore,
      savedAt: new Date().toISOString(),
    };
    const remainingVersions = versions.filter((_, i) => i !== index);
    const newVersions = [currentSnapshot, ...remainingVersions].slice(0, MAX_RESUME_VERSIONS);

    const jobTags = Array.isArray(resume.jobTags) ? (resume.jobTags as unknown[]).filter((t): t is string => typeof t === "string") : [];
    const atsReport = buildAtsReport({ doc: target.content, jdText: resume.jdText ?? undefined, jobTags });
    const restoredQuality = buildQualityReport(target.content, { density: TEMPLATE_DENSITY[target.templateId as TemplateId] ?? "normal" });

    const [updated] = await db
      .update(studentResumesTable)
      .set({
        content: target.content,
        templateId: target.templateId as TemplateId,
        atsScore: atsReport?.scorePct ?? null,
        atsReport: atsReport ?? null,
        qualityScore: restoredQuality.total,
        versions: newVersions,
        updatedAt: new Date(),
      })
      .where(eq(studentResumesTable.id, resumeId))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to restore resume version");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /students/:id/resumes/:resumeId/bullet-rewrite ─────────────────────
// Rewrites one bullet in place (shorter / add a number / match JD wording /
// different opening verb). The rewrite is re-run through the same
// fabrication gate as generation — it may only reuse evidence IDs already
// attached to the bullet, never claim a new one — so this can never be used
// to sneak in an unsupported fact.

router.post("/students/:id/resumes/:resumeId/bullet-rewrite", requireStudent({ allowGuest: true }), rlResumeGen, async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });

  const { section, entryIndex, bulletIndex, action } = req.body ?? {};
  if (section !== "experience" && section !== "projects") {
    return res.status(400).json({ error: "section must be 'experience' or 'projects'" });
  }
  if (!Number.isInteger(entryIndex) || entryIndex < 0) return res.status(400).json({ error: "Invalid entryIndex" });
  if (!Number.isInteger(bulletIndex) || bulletIndex < 0) return res.status(400).json({ error: "Invalid bulletIndex" });
  if (!BULLET_REWRITE_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${BULLET_REWRITE_ACTIONS.join(", ")}` });
  }

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const [resume] = await db.select().from(studentResumesTable).where(eq(studentResumesTable.id, resumeId)).limit(1);
    if (!resume || resume.studentId !== id) return res.status(404).json({ error: "Resume not found" });

    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student) return res.status(404).json({ error: "Student not found" });

    if (action === "jd_wording" && !resume.jdText?.trim()) {
      return res.status(400).json({ error: "This resume has no job description to match wording against" });
    }

    const doc = upgradeContent((resume.content ?? {}) as Record<string, unknown>);
    const entryList = section === "experience" ? doc.experience : doc.projects;
    const entry = entryList[entryIndex];
    const bullet = entry?.bullets[bulletIndex];
    if (!entry || !bullet) return res.status(404).json({ error: "Bullet not found" });

    // Include user-attested quant facts so a previously-quantified bullet's
    // "UA:n" citations still resolve.
    const ledger = withQuantFacts(buildLedger(student), parseQuantFacts(resume.quantFacts));
    const evidenceText =
      bullet.evidence
        .map((eid) => ledger.rows.find((r) => r.id === eid))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => `${r.id}. ${r.text}`)
        .join("\n") || "(no ledger rows resolve for this bullet's evidence — it may be stale)";

    const rewritten = await rewriteBullet({
      currentText: bullet.text,
      evidenceText,
      action: action as BulletRewriteAction,
      jdText: resume.jdText ?? undefined,
      signal: controller.signal,
    });

    // The rewrite may only reuse evidence IDs already on this bullet — never
    // claim a new one, even if the model returned a technically-valid ledger ID.
    const candidateEvidence = rewritten.evidence.filter((eid) => bullet.evidence.includes(eid));
    const passesGate = rewritten.text.length > 0 && candidateEvidence.length > 0 && bulletPassesGate(rewritten.text, candidateEvidence, ledger);

    if (!passesGate) {
      return res.status(422).json({ error: "Rewrite failed the anti-fabrication check — try a different action" });
    }

    return res.json({ text: rewritten.text, evidence: candidateEvidence });
  } catch (err) {
    if (controller.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    req.log.error({ err }, "Failed to rewrite bullet");
    return res.status(500).json({ error: "Server error" });
  }
  return;
});

// ─── POST /students/:id/resumes/:resumeId/improve-section ────────────────────
// AI-polishes ONE section against its failing quality rules. Bullet-bearing
// sections are accepted bullet-by-bullet through the same fabrication gate as
// generation (a failed bullet silently keeps its original text); free prose
// runs the forbidden-term scan. The server never persists — the client applies
// the value locally (instant undo) and saves via the normal PATCH.

router.post("/students/:id/resumes/:resumeId/improve-section", requireStudent({ allowGuest: true }), rlAiMedium, async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });

  const parsedBody = ImproveResumeSectionBody.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ error: parsedBody.error.message });
  const section = parsedBody.data.section as ImprovableSection;
  if (!IMPROVABLE_SECTIONS.includes(section)) {
    return res.status(400).json({ error: `section must be one of: ${IMPROVABLE_SECTIONS.join(", ")}` });
  }

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const [resume] = await db.select().from(studentResumesTable).where(eq(studentResumesTable.id, resumeId)).limit(1);
    if (!resume || resume.studentId !== id) return res.status(404).json({ error: "Resume not found" });
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const doc = upgradeContent((resume.content ?? {}) as Record<string, unknown>);
    const ledger = withQuantFacts(buildLedger(student), parseQuantFacts(resume.quantFacts));
    const report = buildQualityReport(doc, { density: TEMPLATE_DENSITY[resume.templateId as TemplateId] ?? "normal" });

    const result = await improveSection({ doc, section, ledger, report, signal: controller.signal });
    return res.json(result);
  } catch (err) {
    if (controller.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    if (err instanceof ImproveRejectedError) {
      return res.status(422).json({ error: err.message });
    }
    req.log.error({ err }, "Failed to improve section");
    return res.status(500).json({ error: "Server error" });
  }
  return;
});

// ─── POST /students/:id/resumes/:resumeId/review ─────────────────────────────
// On-demand AI judge: recruiter 7-second read, per-section notes, top fixes.
// Content-hash cached (same content ⇒ same review, free re-open); the honest
// percentile framing is computed server-side from the deterministic score,
// never by the model.

router.post("/students/:id/resumes/:resumeId/review", requireStudent({ allowGuest: true }), rlAiMedium, async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const [resume] = await db.select().from(studentResumesTable).where(eq(studentResumesTable.id, resumeId)).limit(1);
    if (!resume || resume.studentId !== id) return res.status(404).json({ error: "Resume not found" });

    const doc = upgradeContent((resume.content ?? {}) as Record<string, unknown>);
    const report = buildQualityReport(doc, { density: TEMPLATE_DENSITY[resume.templateId as TemplateId] ?? "normal" });
    const contentHash = createHash("sha256").update(renderPlainText(doc)).digest("hex").slice(0, 32);

    const { value: review, cached } = await cacheGetOrSet(
      { namespace: "resume-review-v2", keyParts: [resumeId, contentHash, report.total], ttlSeconds: 7 * 24 * 3600 },
      () => reviewResume({ doc, report, signal: controller.signal }),
    );

    const { band, copy } = percentileBand(report.total);
    await db.update(studentResumesTable)
      .set({
        aiReview: { ...review, band, percentileCopy: copy, qualityTotal: report.total },
        aiReviewedAt: new Date(),
        qualityScore: report.total,
      })
      .where(eq(studentResumesTable.id, resumeId));

    logEvent(id, "resume_reviewed", resume.name, { qualityScore: report.total, cached });
    return res.json({ review, band, percentileCopy: copy, qualityScore: report.total, cached });
  } catch (err) {
    if (controller.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    req.log.error({ err }, "Failed to review resume");
    return res.status(500).json({ error: "Server error" });
  }
  return;
});

// ─── POST /students/:id/resumes/:resumeId/quant-questions ────────────────────
// The quantification coach's question pass: for up to 6 unquantified bullets,
// generate 1-2 micro-questions each whose answer is a single number the
// student personally knows. Cached per bullet-set.

router.post("/students/:id/resumes/:resumeId/quant-questions", requireStudent({ allowGuest: true }), rlAiMedium, async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const [resume] = await db.select().from(studentResumesTable).where(eq(studentResumesTable.id, resumeId)).limit(1);
    if (!resume || resume.studentId !== id) return res.status(404).json({ error: "Resume not found" });

    const doc = upgradeContent((resume.content ?? {}) as Record<string, unknown>);
    const { items } = await generateQuantQuestions({ resumeId, doc, signal: controller.signal });
    return res.json({ items });
  } catch (err) {
    if (controller.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    req.log.error({ err }, "Failed to generate quant questions");
    return res.status(500).json({ error: "Server error" });
  }
  return;
});

// ─── POST /students/:id/resumes/:resumeId/quant-apply ────────────────────────
// Applies the student's own numbers to one bullet. The values are validated as
// plain numbers, stored as user-attested (UA) evidence on the resume row, and
// the rewrite is verified deterministically (exact digit containment + gate) —
// with an append fallback, so the coach never fails for the student. The
// bullet itself is applied client-side via the normal PATCH.

router.post("/students/:id/resumes/:resumeId/quant-apply", requireStudent({ allowGuest: true }), rlAiMedium, async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });

  const parsedBody = QuantApplyBody.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ error: parsedBody.error.message });
  const { section, entryIndex, bulletIndex } = parsedBody.data;
  const answers = parsedBody.data.answers.map((a) => ({ ...a, value: a.value.replace(/,/g, "").trim() }));

  if (answers.length === 0) return res.status(400).json({ error: "Provide at least one answer" });
  for (const a of answers) {
    if (!ANSWER_VALUE_RE.test(a.value)) {
      return res.status(400).json({ error: "Answers must be a plain number (e.g. 120 or 42.5)" });
    }
  }

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const [resume] = await db.select().from(studentResumesTable).where(eq(studentResumesTable.id, resumeId)).limit(1);
    if (!resume || resume.studentId !== id) return res.status(404).json({ error: "Resume not found" });
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const doc = upgradeContent((resume.content ?? {}) as Record<string, unknown>);
    const entryList = section === "experience" ? doc.experience : doc.projects;
    const bullet = entryList[entryIndex]?.bullets[bulletIndex];
    if (!bullet) return res.status(404).json({ error: "Bullet not found" });

    const bulletPath = `${section}[${entryIndex}].bullets[${bulletIndex}]`;
    const existingFacts = parseQuantFacts(resume.quantFacts);
    let nextUa = existingFacts.reduce((max, f) => {
      const m = /^UA:(\d+)$/.exec(f.id);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    const newFacts: QuantFact[] = answers.map((a) => ({
      id: `UA:${++nextUa}`,
      question: a.prompt.slice(0, 200),
      value: a.value,
      unit: a.unit.slice(0, 30),
      bulletPath,
      answeredAt: new Date().toISOString(),
    }));

    const ledger = withQuantFacts(buildLedger(student), [...existingFacts, ...newFacts]);
    const evidenceText =
      bullet.evidence
        .map((eid) => ledger.rows.find((r) => r.id === eid))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => `${r.id}. ${r.text}`)
        .join("\n") || "(no ledger rows resolve for this bullet's evidence)";

    const result = await applyQuantAnswers({
      bullet,
      bulletPath,
      answers,
      newFacts,
      ledger,
      evidenceText,
      signal: controller.signal,
    });

    const quantFacts = [...existingFacts, ...newFacts];
    await db.update(studentResumesTable).set({ quantFacts }).where(eq(studentResumesTable.id, resumeId));

    logEvent(id, "resume_quantified", resume.name, { bulletPath, usedFallback: result.usedFallback });
    return res.json({ text: result.text, evidence: result.evidence, quantFacts });
  } catch (err) {
    if (controller.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    req.log.error({ err }, "Failed to apply quant answers");
    return res.status(500).json({ error: "Server error" });
  }
  return;
});

// ─── POST /students/:id/resumes/:resumeId/downloaded ──────────────────────────
// Fired client-side right after a PDF/DOCX download succeeds. The "proof
// loop": if this resume has a company name and there's a recent unlinked
// application for the same company, link them automatically — closing the
// gap between generating a tailored resume and actually knowing it got used.

router.post("/students/:id/resumes/:resumeId/downloaded", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [resume] = await db.select().from(studentResumesTable).where(eq(studentResumesTable.id, resumeId)).limit(1);
    if (!resume || resume.studentId !== id) return res.status(404).json({ error: "Resume not found" });

    logEvent(id, "resume_downloaded", resume.name, { templateId: resume.templateId });

    let linkedApplicationId: number | null = null;
    if (resume.companyName?.trim()) {
      const [match] = await db
        .select({ id: applicationsTable.id })
        .from(applicationsTable)
        .where(and(
          eq(applicationsTable.studentId, id),
          isNull(applicationsTable.resumeId),
          ilike(applicationsTable.company, resume.companyName.trim()),
        ))
        .orderBy(desc(applicationsTable.createdAt))
        .limit(1);
      if (match) {
        await db.update(applicationsTable).set({ resumeId }).where(eq(applicationsTable.id, match.id));
        linkedApplicationId = match.id;
      }
    }

    return res.json({ ok: true, linkedApplicationId });
  } catch (err) {
    req.log.error({ err }, "Failed to record resume download");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /students/:id/resumes/:resumeId ───────────────────────────────────

router.delete("/students/:id/resumes/:resumeId", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [resume] = await db
      .select()
      .from(studentResumesTable)
      .where(eq(studentResumesTable.id, resumeId))
      .limit(1);

    if (!resume || resume.studentId !== id) {
      return res.status(404).json({ error: "Resume not found" });
    }

    await db.delete(studentResumesTable).where(eq(studentResumesTable.id, resumeId));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete resume");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /students/:id/resumes/:resumeId/share ───────────────────────────────
// Generates a public share slug for a resume (idempotent — re-calling returns
// the same slug). The slug is 8 random alphanumeric chars, unique index ensures
// no collision reaches the DB.

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

router.post("/students/:id/resumes/:resumeId/share", requireStudent({ allowGuest: false }), async (req, res) => {
  const id = Number(req.params.id);
  const resumeId = Number(req.params.resumeId);
  if (isNaN(id) || isNaN(resumeId)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [resume] = await db.select().from(studentResumesTable).where(eq(studentResumesTable.id, resumeId)).limit(1);
    if (!resume || resume.studentId !== id) return res.status(404).json({ error: "Resume not found" });

    if (resume.shareSlug) return res.json({ slug: resume.shareSlug, views: resume.shareViews });

    // Retry once on the (very unlikely) slug collision.
    let slug = generateSlug();
    try {
      const [updated] = await db.update(studentResumesTable).set({ shareSlug: slug }).where(eq(studentResumesTable.id, resumeId)).returning({ shareSlug: studentResumesTable.shareSlug });
      slug = updated.shareSlug!;
    } catch {
      slug = generateSlug();
      const [updated] = await db.update(studentResumesTable).set({ shareSlug: slug }).where(eq(studentResumesTable.id, resumeId)).returning({ shareSlug: studentResumesTable.shareSlug });
      slug = updated.shareSlug!;
    }

    logEvent(id, "resume_shared", resume.name, {});
    return res.json({ slug, views: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create share link");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /r/:slug ─────────────────────────────────────────────────────────────
// Public resume view — no auth required. Returns only the fields safe to expose.

router.get("/r/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || slug.length > 32) return res.status(404).json({ error: "Not found" });

  try {
    const [resume] = await db.select().from(studentResumesTable).where(eq(studentResumesTable.shareSlug, slug)).limit(1);
    if (!resume) return res.status(404).json({ error: "Not found" });

    // Only expose the fields the public page needs.
    return res.json({
      id: resume.id,
      name: resume.name,
      templateId: resume.templateId,
      content: resume.content,
      shareViews: resume.shareViews,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch public resume");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /r/:slug/view ────────────────────────────────────────────────────────
// Increments the view counter. Fire-and-forget from the client.

router.post("/r/:slug/view", async (req, res) => {
  const { slug } = req.params;
  if (!slug || slug.length > 32) return res.status(404).json({ error: "Not found" });
  try {
    await db.update(studentResumesTable)
      .set({ shareViews: sql`${studentResumesTable.shareViews} + 1` })
      .where(eq(studentResumesTable.shareSlug, slug));
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: false });
  }
});

export default router;
