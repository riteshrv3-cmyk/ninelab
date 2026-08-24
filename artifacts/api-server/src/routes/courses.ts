import { Router } from "express";
import { db } from "@workspace/db";
import {
  studentsTable,
  courseEnrollmentsTable,
  moduleQuizAttemptsTable,
  courseFinalExamsTable,
  courseFinalExamAttemptsTable,
  courseCertificateInterviewsTable,
  courseCertificatesTable,
  interviewSessionsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { anthropic, AI_MODEL } from "@workspace/integrations-anthropic-ai";
import { requireStudent } from "../middlewares/studentAuth";
import { rlAiHeavy } from "../middlewares/rateLimit";
import { logEvent } from "../lib/events";
import { autoCompleteTaskKind } from "../lib/dailyTasks";

const router = Router();

const COURSE_COMPLETE_XP = 100;
const EXAM_PASS_PCT = 0.7;
const INTERVIEW_PASS_SCORE = 60;

function slug8(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function certCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  // NL- prefix since the ninelab rebrand; earlier KT- codes remain valid.
  return `NL-${new Date().getFullYear()}-${rand}`;
}
function letter(s: unknown): string {
  return String(s ?? "").trim().charAt(0).toUpperCase();
}

interface QuizQ { id?: string; question: string; options: string[]; answer: string; explanation?: string; difficulty?: string; moduleId?: string }

/** Distinct moduleIds this enrollment has a PASSED quiz attempt for. */
async function passedModuleIds(enrollmentId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ moduleId: moduleQuizAttemptsTable.moduleId })
    .from(moduleQuizAttemptsTable)
    .where(and(eq(moduleQuizAttemptsTable.enrollmentId, enrollmentId), eq(moduleQuizAttemptsTable.passed, true)));
  return rows.map(r => r.moduleId);
}

/** Questions belonging to a module — tagged (courseData v2) or index-mapped (old cache). */
function moduleQuestions(courseData: unknown, moduleId: string): QuizQ[] {
  const all = ((courseData as { quizQuestions?: QuizQ[] } | null)?.quizQuestions ?? []) as QuizQ[];
  const tagged = all.filter(q => q.moduleId === moduleId);
  if (tagged.length > 0) return tagged;
  const idx = Number(moduleId.replace(/[^0-9]/g, "")) - 1;
  return idx >= 0 && idx < all.length ? [all[idx]] : [];
}

function grade(questions: QuizQ[], answers: string[]): { score: number; total: number; passed: boolean } {
  let score = 0;
  questions.forEach((q, i) => { if (letter(answers[i]) && letter(answers[i]) === letter(q.answer)) score++; });
  const total = questions.length;
  return { score, total, passed: total > 0 && score / total >= EXAM_PASS_PCT };
}

async function enrollmentDto(enrollmentId: number) {
  const [e] = await db.select().from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.id, enrollmentId)).limit(1);
  if (!e) return null;
  return { ...e, passedModuleIds: await passedModuleIds(enrollmentId) };
}

/* ── enroll ─────────────────────────────────────────────────────── */
router.post("/students/:id/courses/enroll", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const { subDomainId, subDomainName, domainId, domainName, skills, courseData } = req.body ?? {};
  if (!subDomainId || !subDomainName || !domainId || !domainName) {
    return res.status(400).json({ error: "subDomainId, subDomainName, domainId, domainName required" });
  }
  try {
    const [existing] = await db.select().from(courseEnrollmentsTable)
      .where(and(eq(courseEnrollmentsTable.studentId, id), eq(courseEnrollmentsTable.subDomainId, String(subDomainId)))).limit(1);
    if (existing) {
      // Fill courseData if the client now has it and we didn't before.
      if (courseData && !existing.courseData) {
        await db.update(courseEnrollmentsTable).set({ courseData, updatedAt: new Date() }).where(eq(courseEnrollmentsTable.id, existing.id));
      }
      return res.json(await enrollmentDto(existing.id));
    }
    const [row] = await db.insert(courseEnrollmentsTable).values({
      studentId: id,
      subDomainId: String(subDomainId),
      subDomainName: String(subDomainName),
      domainId: String(domainId),
      domainName: String(domainName),
      skills: Array.isArray(skills) ? skills : [],
      courseData: courseData ?? null,
    }).returning({ id: courseEnrollmentsTable.id });
    return res.json(await enrollmentDto(row.id));
  } catch (err) {
    req.log.error({ err }, "enroll failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── list / detail ──────────────────────────────────────────────── */
router.get("/students/:id/courses", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const rows = await db.select().from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.studentId, id)).orderBy(desc(courseEnrollmentsTable.updatedAt));
    const withProgress = await Promise.all(rows.map(async r => ({ ...r, passedModuleIds: await passedModuleIds(r.id) })));
    return res.json(withProgress);
  } catch (err) {
    req.log.error({ err }, "list courses failed");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/students/:id/courses/:enrollmentId", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const enrollmentId = Number(req.params.enrollmentId);
  try {
    const dto = await enrollmentDto(enrollmentId);
    if (!dto || dto.studentId !== id) return res.status(404).json({ error: "Not found" });
    return res.json(dto);
  } catch (err) {
    req.log.error({ err }, "get enrollment failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── progress ───────────────────────────────────────────────────── */
router.patch("/students/:id/courses/:enrollmentId/progress", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const enrollmentId = Number(req.params.enrollmentId);
  const { completedLessonIds, watchedVideoIds } = req.body ?? {};
  try {
    const [e] = await db.select().from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.id, enrollmentId)).limit(1);
    if (!e || e.studentId !== id) return res.status(404).json({ error: "Not found" });
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (Array.isArray(completedLessonIds)) patch.completedLessonIds = completedLessonIds;
    if (Array.isArray(watchedVideoIds)) patch.watchedVideoIds = watchedVideoIds;
    await db.update(courseEnrollmentsTable).set(patch).where(eq(courseEnrollmentsTable.id, enrollmentId));
    // Total lessons = 5 modules x 3 = 15; mark the daily "course" task done when finished.
    const totalLessons = (((e.courseData as { modules?: { lessons?: unknown[] }[] } | null)?.modules ?? []) as { lessons?: unknown[] }[])
      .reduce((n, m) => n + (m.lessons?.length ?? 0), 0);
    if (Array.isArray(completedLessonIds) && totalLessons > 0 && completedLessonIds.length >= totalLessons) {
      autoCompleteTaskKind(id, "course").catch(() => {});
    }
    return res.json(await enrollmentDto(enrollmentId));
  } catch (err) {
    req.log.error({ err }, "progress update failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── module quiz ────────────────────────────────────────────────── */
router.post("/students/:id/courses/:enrollmentId/modules/:moduleId/quiz", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const enrollmentId = Number(req.params.enrollmentId);
  const moduleId = String(req.params.moduleId);
  const answers: string[] = Array.isArray(req.body?.answers) ? req.body.answers : [];
  try {
    const [e] = await db.select().from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.id, enrollmentId)).limit(1);
    if (!e || e.studentId !== id) return res.status(404).json({ error: "Not found" });
    const qs = moduleQuestions(e.courseData, moduleId);
    if (qs.length === 0) return res.status(400).json({ error: "No quiz for this module" });
    const { score, total, passed } = grade(qs, answers);
    await db.insert(moduleQuizAttemptsTable).values({ enrollmentId, studentId: id, moduleId, answers, score, total, passed });
    return res.json({ score, total, passed });
  } catch (err) {
    req.log.error({ err }, "module quiz failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── final exam ─────────────────────────────────────────────────── */
router.post("/students/:id/courses/:enrollmentId/final-exam/generate", requireStudent({ allowGuest: true }), rlAiHeavy, async (req, res) => {
  const id = Number(req.params.id);
  const enrollmentId = Number(req.params.enrollmentId);
  try {
    const [e] = await db.select().from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.id, enrollmentId)).limit(1);
    if (!e || e.studentId !== id) return res.status(404).json({ error: "Not found" });

    const [existing] = await db.select().from(courseFinalExamsTable).where(eq(courseFinalExamsTable.enrollmentId, enrollmentId)).limit(1);
    if (existing) return res.json({ examId: existing.id, questions: existing.questions });

    // Gate: every module quiz passed.
    const passed = await passedModuleIds(enrollmentId);
    const modules = ((e.courseData as { modules?: { id: string }[] } | null)?.modules ?? []) as { id: string }[];
    const allPassed = modules.length > 0 && modules.every(m => passed.includes(m.id));
    if (!allPassed) return res.status(403).json({ error: "Pass every module quiz first" });

    const resp = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: `Create a 10-question final exam for the course "${e.subDomainName}" (${e.domainName}).
Return ONLY valid compact JSON, no markdown:
{"questions":[{"id":"e1","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","difficulty":"easy"}]}
Rules:
- Exactly 10 questions: 4 easy, 4 medium, 2 hard
- "answer" = single letter A/B/C/D only
- Cover the whole course, harder than module quizzes`,
      }],
    });
    const c = resp.content[0];
    if (c.type !== "text") throw new Error("Unexpected AI response");
    let parsed: { questions?: QuizQ[] };
    try { parsed = JSON.parse(c.text); }
    catch { const m = c.text.match(/\{[\s\S]*\}/); if (!m) throw new Error("No JSON"); parsed = JSON.parse(m[0]); }
    const questions = parsed.questions ?? [];
    const [row] = await db.insert(courseFinalExamsTable).values({ enrollmentId, questions }).returning({ id: courseFinalExamsTable.id });
    return res.json({ examId: row.id, questions });
  } catch (err) {
    req.log.error({ err }, "exam generate failed");
    return res.status(500).json({ error: "Exam generation failed" });
  }
});

router.post("/students/:id/courses/:enrollmentId/final-exam/submit", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const enrollmentId = Number(req.params.enrollmentId);
  const answers: string[] = Array.isArray(req.body?.answers) ? req.body.answers : [];
  try {
    const [e] = await db.select().from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.id, enrollmentId)).limit(1);
    if (!e || e.studentId !== id) return res.status(404).json({ error: "Not found" });
    const [exam] = await db.select().from(courseFinalExamsTable).where(eq(courseFinalExamsTable.enrollmentId, enrollmentId)).limit(1);
    if (!exam) return res.status(404).json({ error: "No exam generated" });
    const { score, total, passed } = grade((exam.questions as QuizQ[]) ?? [], answers);
    await db.insert(courseFinalExamAttemptsTable).values({ examId: exam.id, studentId: id, answers, score, total, passed });
    return res.json({ score, total, passed });
  } catch (err) {
    req.log.error({ err }, "exam submit failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── certificate interview link ─────────────────────────────────── */
router.post("/students/:id/courses/:enrollmentId/certificate-interview/:interviewSessionId/link", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const enrollmentId = Number(req.params.enrollmentId);
  const sessionId = Number(req.params.interviewSessionId);
  try {
    const [e] = await db.select().from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.id, enrollmentId)).limit(1);
    if (!e || e.studentId !== id) return res.status(404).json({ error: "Not found" });
    const [session] = await db.select().from(interviewSessionsTable).where(eq(interviewSessionsTable.id, sessionId)).limit(1);
    if (!session || session.studentId !== id) return res.status(404).json({ error: "Session not found" });
    if (!session.completed || session.overallScore == null) return res.status(400).json({ error: "Interview not evaluated yet" });
    const passed = session.overallScore >= INTERVIEW_PASS_SCORE;

    const [existing] = await db.select().from(courseCertificateInterviewsTable).where(eq(courseCertificateInterviewsTable.enrollmentId, enrollmentId)).limit(1);
    if (existing) {
      await db.update(courseCertificateInterviewsTable).set({ interviewSessionId: sessionId, passed }).where(eq(courseCertificateInterviewsTable.enrollmentId, enrollmentId));
    } else {
      await db.insert(courseCertificateInterviewsTable).values({ enrollmentId, interviewSessionId: sessionId, passed });
    }
    return res.json({ passed, overallScore: session.overallScore });
  } catch (err) {
    req.log.error({ err }, "cert interview link failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── issue certificate (claimed accounts only) ──────────────────── */
router.post("/students/:id/courses/:enrollmentId/certificate", requireStudent({ allowGuest: false }), async (req, res) => {
  const id = Number(req.params.id);
  const enrollmentId = Number(req.params.enrollmentId);
  try {
    const [e] = await db.select().from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.id, enrollmentId)).limit(1);
    if (!e || e.studentId !== id) return res.status(404).json({ error: "Not found" });

    const [existingCert] = await db.select().from(courseCertificatesTable).where(eq(courseCertificatesTable.enrollmentId, enrollmentId)).limit(1);
    if (existingCert) return res.json(existingCert);

    // Both gates must be passed.
    const [bestExam] = await db.select().from(courseFinalExamAttemptsTable)
      .innerJoin(courseFinalExamsTable, eq(courseFinalExamAttemptsTable.examId, courseFinalExamsTable.id))
      .where(and(eq(courseFinalExamsTable.enrollmentId, enrollmentId), eq(courseFinalExamAttemptsTable.passed, true)))
      .orderBy(desc(courseFinalExamAttemptsTable.score)).limit(1);
    if (!bestExam) return res.status(403).json({ error: "Pass the final exam first" });
    const [interview] = await db.select().from(courseCertificateInterviewsTable)
      .where(and(eq(courseCertificateInterviewsTable.enrollmentId, enrollmentId), eq(courseCertificateInterviewsTable.passed, true))).limit(1);
    if (!interview) return res.status(403).json({ error: "Pass the certificate interview first" });

    const attempt = bestExam.course_final_exam_attempts;
    const examPct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;

    const [cert] = await db.insert(courseCertificatesTable).values({
      studentId: id,
      enrollmentId,
      certificateCode: certCode(),
      subDomainName: e.subDomainName,
      domainName: e.domainName,
      skillsCovered: e.skills,
      finalExamScore: examPct,
      interviewSessionId: interview.interviewSessionId,
      verifySlug: slug8(),
    }).returning();

    await db.update(courseEnrollmentsTable).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(courseEnrollmentsTable.id, enrollmentId));
    await db.update(studentsTable).set({
      xp: sql`${studentsTable.xp} + ${COURSE_COMPLETE_XP}`,
      level: sql`GREATEST(1, FLOOR((${studentsTable.xp} + ${COURSE_COMPLETE_XP}) / 500) + 1)`,
    }).where(eq(studentsTable.id, id));
    logEvent(id, "course_completed", `${e.subDomainName} certificate`, { enrollmentId, examPct });

    return res.json(cert);
  } catch (err) {
    req.log.error({ err }, "certificate issue failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── resume-flag toggle ─────────────────────────────────────────── */
router.patch("/students/:id/courses/:enrollmentId/certificate/resume-flag", requireStudent({ allowGuest: false }), async (req, res) => {
  const id = Number(req.params.id);
  const enrollmentId = Number(req.params.enrollmentId);
  const includeOnResume = Boolean(req.body?.includeOnResume);
  try {
    const [cert] = await db.select().from(courseCertificatesTable).where(eq(courseCertificatesTable.enrollmentId, enrollmentId)).limit(1);
    if (!cert || cert.studentId !== id) return res.status(404).json({ error: "Not found" });
    const [updated] = await db.update(courseCertificatesTable).set({ includeOnResume }).where(eq(courseCertificatesTable.id, cert.id)).returning();
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "resume-flag failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── certificates list ──────────────────────────────────────────── */
router.get("/students/:id/certificates", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const rows = await db.select().from(courseCertificatesTable)
      .where(eq(courseCertificatesTable.studentId, id)).orderBy(desc(courseCertificatesTable.issuedAt));
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "certificates list failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── skills confirm (explicit merge, never silent) ──────────────── */
router.post("/students/:id/skills/confirm", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const rawName = String(req.body?.skillName ?? "").trim().slice(0, 40);
  const proficiency = Math.max(0, Math.min(100, Math.round(Number(req.body?.proficiency ?? 50))));
  if (!rawName) return res.status(400).json({ error: "skillName required" });
  try {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student) return res.status(404).json({ error: "Not found" });
    const skills = { ...((student.skills as Record<string, number>) ?? {}) };
    if (!(rawName in skills) && Object.keys(skills).length >= 40) {
      return res.status(400).json({ error: "Skill limit reached" });
    }
    skills[rawName] = proficiency;
    await db.update(studentsTable).set({ skills }).where(eq(studentsTable.id, id));
    return res.json({ skills });
  } catch (err) {
    req.log.error({ err }, "skill confirm failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── public certificate verify (no auth) ────────────────────────── */
router.get("/certs/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || slug.length > 32) return res.status(404).json({ error: "Not found" });
  try {
    const [cert] = await db.select().from(courseCertificatesTable).where(eq(courseCertificatesTable.verifySlug, slug)).limit(1);
    if (!cert) return res.status(404).json({ error: "Not found" });
    const [student] = await db.select({ name: studentsTable.name }).from(studentsTable).where(eq(studentsTable.id, cert.studentId)).limit(1);
    return res.json({
      studentName: student?.name ?? "A ninelab learner",
      certificateCode: cert.certificateCode,
      subDomainName: cert.subDomainName,
      domainName: cert.domainName,
      skillsCovered: cert.skillsCovered,
      finalExamScore: cert.finalExamScore,
      issuedAt: cert.issuedAt,
    });
  } catch (err) {
    req.log.error({ err }, "public cert failed");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
