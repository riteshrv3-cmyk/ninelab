import { Router } from "express";
import { db } from "@workspace/db";
import {
  recruitersTable,
  recruiterJobsTable,
  recruiterInvites,
  studentsTable,
} from "@workspace/db";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { anthropic, AI_MODEL } from "@workspace/integrations-anthropic-ai";

import { requireAdmin } from "../middlewares/adminAuth";

const router = Router();

interface ParsedJob {
  role: string;
  seniority: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  minCgpa: number | null;
  workMode: string | null;
  minExperience: string | null;
  location: string | null;
  summary: string;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

router.post("/recruiters/login", requireAdmin, async (req, res) => {
  const { email, name, company, role } = (req.body ?? {}) as {
    email?: string; name?: string; company?: string; role?: string;
  };
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: "Valid email required" });
  if (!name?.trim() || !company?.trim()) return res.status(400).json({ error: "Name and company required" });

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.select().from(recruitersTable).where(eq(recruitersTable.email, normalizedEmail)).limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(recruitersTable)
      .set({ name: name.trim(), company: company.trim(), role: role?.trim() || null, lastSeenAt: new Date() })
      .where(eq(recruitersTable.id, existing[0].id))
      .returning();
    return res.json(updated);
  }

  const [created] = await db
    .insert(recruitersTable)
    .values({ email: normalizedEmail, name: name.trim(), company: company.trim(), role: role?.trim() || null })
    .returning();
  return res.json(created);
});

router.get("/recruiters/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [recruiter] = await db.select().from(recruitersTable).where(eq(recruitersTable.id, id)).limit(1);
  if (!recruiter) return res.status(404).json({ error: "Not found" });
  return res.json(recruiter);
});

router.get("/recruiters/:id/dashboard", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [recruiter] = await db.select().from(recruitersTable).where(eq(recruitersTable.id, id)).limit(1);
  if (!recruiter) return res.status(404).json({ error: "Not found" });

  const invites = await db
    .select()
    .from(recruiterInvites)
    .where(eq(recruiterInvites.recruiterId, id))
    .orderBy(desc(recruiterInvites.createdAt));

  const jobs = await db
    .select()
    .from(recruiterJobsTable)
    .where(eq(recruiterJobsTable.recruiterId, id))
    .orderBy(desc(recruiterJobsTable.createdAt));

  const total = invites.length;
  const accepted = invites.filter(i => i.status === "accepted").length;
  const declined = invites.filter(i => i.status === "declined").length;
  const pending = invites.filter(i => i.status === "pending").length;
  const interviewed = invites.filter(i => i.status === "interviewed").length;
  const hired = invites.filter(i => i.status === "hired").length;
  const seenByStudent = invites.filter(i => i.studentSeen).length;
  const responseRate = total === 0 ? 0 : Math.round(((accepted + declined + interviewed + hired) / total) * 100);
  const acceptRate = total === 0 ? 0 : Math.round(((accepted + interviewed + hired) / total) * 100);
  const hireRate = total === 0 ? 0 : Math.round((hired / total) * 100);

  // Funnel: Invited → Seen → Accepted → Interviewed → Hired
  const acceptedOrLater = accepted + interviewed + hired;
  const interviewedOrLater = interviewed + hired;
  const funnel = [
    { stage: "Invited", count: total, conversionPct: 100 },
    { stage: "Seen", count: seenByStudent, conversionPct: total === 0 ? 0 : Math.round((seenByStudent / total) * 100) },
    { stage: "Accepted", count: acceptedOrLater, conversionPct: seenByStudent === 0 ? 0 : Math.round((acceptedOrLater / seenByStudent) * 100) },
    { stage: "Interviewed", count: interviewedOrLater, conversionPct: acceptedOrLater === 0 ? 0 : Math.round((interviewedOrLater / acceptedOrLater) * 100) },
    { stage: "Hired", count: hired, conversionPct: interviewedOrLater === 0 ? 0 : Math.round((hired / interviewedOrLater) * 100) },
  ];

  // Per-job funnel breakdown
  const jobFunnels = jobs.slice(0, 5).map(j => {
    const jobInvites = invites.filter(i => i.jobId === j.id);
    const jt = jobInvites.length;
    const jh = jobInvites.filter(i => i.status === "hired").length;
    const ja = jobInvites.filter(i => ["accepted", "interviewed", "hired"].includes(i.status)).length;
    return {
      id: j.id,
      title: j.title,
      invited: jt,
      accepted: ja,
      hired: jh,
      acceptRate: jt === 0 ? 0 : Math.round((ja / jt) * 100),
    };
  });

  const recentRaw = invites.slice(0, 8);
  const recentStudentIds = [...new Set(recentRaw.map(i => i.studentId))];
  const recentStudents = recentStudentIds.length > 0
    ? await db.select({ id: studentsTable.id, name: studentsTable.name })
        .from(studentsTable)
        .where(inArray(studentsTable.id, recentStudentIds))
    : [];
  const studentNameMap: Record<number, string> = {};
  for (const s of recentStudents) studentNameMap[s.id] = s.name;

  return res.json({
    recruiter,
    stats: {
      totalInvites: total,
      accepted,
      declined,
      pending,
      interviewed,
      hired,
      seenByStudent,
      responseRate,
      acceptRate,
      hireRate,
      jobsPosted: jobs.length,
    },
    funnel,
    jobFunnels,
    recentInvites: recentRaw.map(i => ({ ...i, studentName: studentNameMap[i.studentId] ?? null })),
    jobs: jobs.slice(0, 10),
  });
});

// PATCH invite status — recruiter marks "interviewed" / "hired" / etc.
router.patch("/recruiter-invites/:id/status", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { status } = (req.body ?? {}) as { status?: string };
  const ALLOWED = ["pending", "accepted", "declined", "interviewed", "hired"];
  if (!status || !ALLOWED.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${ALLOWED.join(", ")}` });
  }
  const [updated] = await db
    .update(recruiterInvites)
    .set({ status })
    .where(eq(recruiterInvites.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Invite not found" });
  return res.json(updated);
});

// GET invites for a specific student from a specific recruiter (for status buttons in StudentDetail)
router.get("/recruiters/:recruiterId/invites/student/:studentId", requireAdmin, async (req, res) => {
  const recruiterId = Number(req.params.recruiterId);
  const studentId = Number(req.params.studentId);
  if (isNaN(recruiterId) || isNaN(studentId)) return res.status(400).json({ error: "Invalid id" });
  const rows = await db
    .select()
    .from(recruiterInvites)
    .where(and(eq(recruiterInvites.recruiterId, recruiterId), eq(recruiterInvites.studentId, studentId)))
    .orderBy(desc(recruiterInvites.createdAt))
    .limit(5);
  return res.json(rows);
});

router.get("/recruiters/:id/jobs", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const jobs = await db
    .select()
    .from(recruiterJobsTable)
    .where(eq(recruiterJobsTable.recruiterId, id))
    .orderBy(desc(recruiterJobsTable.createdAt));
  return res.json(jobs);
});

async function parseJobWithAI(rawDescription: string): Promise<ParsedJob> {
  const prompt = `You are extracting structured requirements from a job description for matching against engineering students in India.

Job description:
"""
${rawDescription.slice(0, 4000)}
"""

Return ONLY a JSON object with these exact fields:
{
  "role": "short role title e.g. 'Backend Engineer'",
  "seniority": "intern | fresher | junior | mid | senior",
  "mustHaveSkills": ["array of 3-8 normalized skills like 'react', 'node.js', 'python', 'postgres'"],
  "niceToHaveSkills": ["array of 0-5 bonus skills"],
  "minCgpa": number or null,
  "workMode": "remote | hybrid | onsite | null",
  "minExperience": "string like '0-1 years' or null",
  "location": "city or null",
  "summary": "1 sentence honest TL;DR for a student in Hinglish-friendly English"
}

Normalize skills to lowercase canonical names. No extra commentary, just JSON.`;

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  const text = block.type === "text" ? block.text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return JSON");
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    role: typeof parsed.role === "string" ? parsed.role : "Engineer",
    seniority: typeof parsed.seniority === "string" ? parsed.seniority : "fresher",
    mustHaveSkills: Array.isArray(parsed.mustHaveSkills) ? parsed.mustHaveSkills.map((s: unknown) => String(s).toLowerCase()).slice(0, 8) : [],
    niceToHaveSkills: Array.isArray(parsed.niceToHaveSkills) ? parsed.niceToHaveSkills.map((s: unknown) => String(s).toLowerCase()).slice(0, 5) : [],
    minCgpa: typeof parsed.minCgpa === "number" ? parsed.minCgpa : null,
    workMode: typeof parsed.workMode === "string" && ["remote", "hybrid", "onsite"].includes(parsed.workMode) ? parsed.workMode : null,
    minExperience: typeof parsed.minExperience === "string" ? parsed.minExperience : null,
    location: typeof parsed.location === "string" ? parsed.location : null,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

interface MatchedStudent {
  id: number;
  name: string;
  college: string;
  field: string;
  year: number;
  cgpa: string | null;
  workMode: string | null;
  profileStrength: number;
  commitmentScore: number;
  overallScore: number;
  skills: Record<string, number>;
  githubUrl: string | null;
  matchScore: number;
  matchReasons: string[];
  matchedSkills: string[];
}

function scoreStudentForJob(
  student: typeof studentsTable.$inferSelect,
  parsed: ParsedJob,
): { matchScore: number; matchReasons: string[]; matchedSkills: string[] } {
  const reasons: string[] = [];
  const matched: string[] = [];
  let score = 0;

  const skills = (student.skills ?? {}) as Record<string, number>;
  const skillKeys = Object.keys(skills).map(k => k.toLowerCase());

  let mustHaveHits = 0;
  for (const want of parsed.mustHaveSkills) {
    const hit = skillKeys.find(k => k.includes(want) || want.includes(k));
    if (hit) {
      mustHaveHits++;
      matched.push(hit);
    }
  }
  const mustHaveCoverage = parsed.mustHaveSkills.length === 0 ? 1 : mustHaveHits / parsed.mustHaveSkills.length;
  score += mustHaveCoverage * 50;
  if (mustHaveHits > 0) reasons.push(`${mustHaveHits}/${parsed.mustHaveSkills.length} must-have skills`);

  let niceHits = 0;
  for (const want of parsed.niceToHaveSkills) {
    const hit = skillKeys.find(k => k.includes(want) || want.includes(k));
    if (hit) {
      niceHits++;
      if (!matched.includes(hit)) matched.push(hit);
    }
  }
  score += (parsed.niceToHaveSkills.length === 0 ? 0 : (niceHits / parsed.niceToHaveSkills.length) * 10);
  if (niceHits > 0) reasons.push(`+${niceHits} bonus skills`);

  score += (student.profileStrength ?? 0) * 0.15;
  if ((student.profileStrength ?? 0) >= 70) reasons.push(`strong profile (${student.profileStrength}%)`);

  score += (student.commitmentScore ?? 0) * 0.1;

  if (parsed.minCgpa && student.cgpa) {
    const cg = parseFloat(student.cgpa);
    if (!isNaN(cg) && cg >= parsed.minCgpa) {
      score += 8;
      reasons.push(`CGPA ${cg} ≥ ${parsed.minCgpa}`);
    } else if (!isNaN(cg)) {
      score -= 10;
    }
  }

  if (parsed.workMode && student.workMode === parsed.workMode) {
    score += 5;
    reasons.push(`prefers ${parsed.workMode}`);
  }

  if (student.openToWork) score += 3;

  return {
    matchScore: clamp(Math.round(score), 0, 100),
    matchReasons: reasons.slice(0, 4),
    matchedSkills: matched.slice(0, 6),
  };
}

router.post("/recruiter-jobs", requireAdmin, async (req, res) => {
  const { recruiterId, title, rawDescription } = (req.body ?? {}) as {
    recruiterId?: number; title?: string; rawDescription?: string;
  };
  if (!recruiterId || isNaN(Number(recruiterId))) return res.status(400).json({ error: "recruiterId required" });
  if (!rawDescription?.trim() || rawDescription.trim().length < 30) {
    return res.status(400).json({ error: "Paste a real job description (30+ chars)" });
  }

  const [recruiter] = await db.select().from(recruitersTable).where(eq(recruitersTable.id, Number(recruiterId))).limit(1);
  if (!recruiter) return res.status(404).json({ error: "Recruiter not found" });

  let parsed: ParsedJob | null = null;
  try {
    parsed = await parseJobWithAI(rawDescription);
  } catch (err) {
    req.log.warn({ err }, "Job parse failed, using fallback");
    parsed = {
      role: title?.trim() || "Engineer",
      seniority: "fresher",
      mustHaveSkills: [],
      niceToHaveSkills: [],
      minCgpa: null,
      workMode: null,
      minExperience: null,
      location: null,
      summary: rawDescription.slice(0, 200),
    };
  }

  const [job] = await db
    .insert(recruiterJobsTable)
    .values({
      recruiterId: Number(recruiterId),
      title: title?.trim() || parsed.role,
      rawDescription,
      parsedRequirements: parsed,
    })
    .returning();

  await db
    .update(recruitersTable)
    .set({ jobsPosted: sql`${recruitersTable.jobsPosted} + 1`, lastSeenAt: new Date() })
    .where(eq(recruitersTable.id, Number(recruiterId)));

  const candidates = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.openToWork, true));

  const ranked: MatchedStudent[] = candidates
    .map(s => {
      const m = scoreStudentForJob(s, parsed!);
      return {
        id: s.id,
        name: s.name,
        college: s.college,
        field: s.field,
        year: s.year,
        cgpa: s.cgpa,
        workMode: s.workMode,
        profileStrength: s.profileStrength ?? 0,
        commitmentScore: s.commitmentScore ?? 0,
        overallScore: s.overallScore ?? 0,
        skills: (s.skills ?? {}) as Record<string, number>,
        githubUrl: s.githubUrl,
        ...m,
      };
    })
    .filter(s => s.matchScore > 15)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 20);

  return res.json({ job, parsed, matches: ranked });
});

router.get("/recruiter-jobs/:id/matches", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [job] = await db.select().from(recruiterJobsTable).where(eq(recruiterJobsTable.id, id)).limit(1);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (!job.parsedRequirements) return res.json({ job, matches: [] });

  const candidates = await db.select().from(studentsTable).where(eq(studentsTable.openToWork, true));
  const ranked: MatchedStudent[] = candidates
    .map(s => {
      const m = scoreStudentForJob(s, job.parsedRequirements!);
      return {
        id: s.id, name: s.name, college: s.college, field: s.field, year: s.year,
        cgpa: s.cgpa, workMode: s.workMode,
        profileStrength: s.profileStrength ?? 0,
        commitmentScore: s.commitmentScore ?? 0,
        overallScore: s.overallScore ?? 0,
        skills: (s.skills ?? {}) as Record<string, number>,
        githubUrl: s.githubUrl,
        ...m,
      };
    })
    .filter(s => s.matchScore > 15)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 30);

  return res.json({ job, matches: ranked });
});

router.post("/recruiter-jobs/:id/bulk-invite", requireAdmin, async (req, res) => {
  const jobId = Number(req.params.id);
  if (isNaN(jobId)) return res.status(400).json({ error: "Invalid id" });
  const { studentIds, message } = (req.body ?? {}) as { studentIds?: number[]; message?: string };
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: "studentIds required" });
  }
  if (studentIds.length > 50) return res.status(400).json({ error: "Max 50 invites per batch" });

  const [job] = await db.select().from(recruiterJobsTable).where(eq(recruiterJobsTable.id, jobId)).limit(1);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const [recruiter] = await db.select().from(recruitersTable).where(eq(recruitersTable.id, job.recruiterId)).limit(1);
  if (!recruiter) return res.status(404).json({ error: "Recruiter not found" });

  const validIds = studentIds.map(Number).filter(n => !isNaN(n));
  const existingStudents = await db.select({ id: studentsTable.id }).from(studentsTable).where(inArray(studentsTable.id, validIds));
  const existingIds = new Set(existingStudents.map(s => s.id));

  const rows = validIds
    .filter(id => existingIds.has(id))
    .map(studentId => ({
      studentId,
      recruiterCompany: recruiter.company,
      recruiterName: recruiter.name,
      recruiterEmail: recruiter.email,
      role: job.title,
      message: message?.trim() || `Hi! We have an exciting ${job.title} opportunity at ${recruiter.company}. Would love to chat.`,
      recruiterId: recruiter.id,
      jobId: job.id,
    }));

  if (rows.length === 0) return res.json({ sent: 0 });

  await db.insert(recruiterInvites).values(rows);
  await db
    .update(recruiterJobsTable)
    .set({ invitesSent: sql`${recruiterJobsTable.invitesSent} + ${rows.length}` })
    .where(eq(recruiterJobsTable.id, jobId));
  await db
    .update(recruitersTable)
    .set({ invitesSent: sql`${recruitersTable.invitesSent} + ${rows.length}`, lastSeenAt: new Date() })
    .where(eq(recruitersTable.id, recruiter.id));

  return res.json({ sent: rows.length });
});

router.get("/platform/stats", async (req, res) => {
  try {
    const [row] = await db.select({
      totalStudents: sql<number>`count(*)::int`,
      totalColleges: sql<number>`count(distinct ${studentsTable.college})::int`,
      avgScore: sql<number>`coalesce(round(avg(${studentsTable.overallScore}))::int, 0)`,
      openToWork: sql<number>`sum(case when ${studentsTable.openToWork} then 1 else 0 end)::int`,
    }).from(studentsTable);
    return res.json(row ?? { totalStudents: 0, totalColleges: 0, avgScore: 0, openToWork: 0 });
  } catch (err) {
    req.log.error({ err }, "platform stats failed");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/talent-pool/showcase", requireAdmin, async (_req, res) => {
  const all = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.openToWork, true))
    .orderBy(desc(studentsTable.profileStrength))
    .limit(12);

  const masked = all.map(s => {
    const skills = (s.skills ?? {}) as Record<string, number>;
    const topSkills = Object.entries(skills).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k]) => k);
    const initials = s.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    return {
      id: s.id,
      initials,
      maskedName: s.name.split(" ")[0]?.[0] + ". " + (s.name.split(" ").slice(-1)[0]?.[0] || "") + ".",
      college: s.college,
      field: s.field,
      year: s.year,
      profileStrength: s.profileStrength ?? 0,
      overallScore: s.overallScore ?? 0,
      topSkills,
      hasGithub: !!s.githubUrl,
    };
  });

  const [{ count: totalOpen }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studentsTable)
    .where(eq(studentsTable.openToWork, true));

  res.json({ candidates: masked, totalOpen });
});

export default router;
