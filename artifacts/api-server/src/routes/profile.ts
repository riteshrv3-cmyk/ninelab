import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic, AI_MODEL } from "@workspace/integrations-anthropic-ai";
import { rlAiHeavy, rlAiMedium } from "../middlewares/rateLimit";
import { requireStudent } from "../middlewares/studentAuth";
import { contextPack } from "../lib/contextPack";
import { extractJson } from "../lib/extractJson";
import { logEvent } from "../lib/events";
import { cacheGetOrSet } from "../lib/aiCache";
import { computeProfileStrength, computeCommitmentScore } from "../lib/profileStrength";

const router = Router();

// ─── GET /students/:id/full-profile ──────────────────────────────────────────

router.get("/students/:id/full-profile", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student) return res.status(404).json({ error: "Not found" });
    const profileStrength = computeProfileStrength(student);
    const commitmentScore = computeCommitmentScore(student);
    await db.update(studentsTable)
      .set({ profileStrength, commitmentScore })
      .where(eq(studentsTable.id, id));
    return res.json({
      ...student,
      skills: (student.skills as Record<string, number>) || {},
      projects: Array.isArray(student.projects) ? student.projects : [],
      certifications: Array.isArray(student.certifications) ? student.certifications : [],
      experience: Array.isArray(student.experience) ? student.experience : [],
      education: Array.isArray(student.education) ? student.education : [],
      preferredLocations: Array.isArray(student.preferredLocations) ? student.preferredLocations : [],
      profileStrength,
      commitmentScore,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get full profile");
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── PATCH /students/:id/profile ─────────────────────────────────────────────

const ALLOWED_FIELDS = [
  "name", "college", "city", "year", "field", "photoUrl",
  "githubUrl", "linkedinUrl", "portfolioUrl", "phone", "bio",
  "cgpa", "targetPackage", "dreamCompany",
  "projects", "certifications", "experience", "education", "skills",
  "openToWork", "workMode", "preferredLocations", "expectedSalary",
  "targetRole", "targetBatch",
] as const;

// ─── Profile JSON field shape validation ──────────────────────────────────────
// projects/certifications/experience/education previously had zero shape
// validation on write — a client could PATCH arbitrary JSON into these jsonb
// columns. Applied to both write paths that share ALLOWED_FIELDS: the PATCH
// route below and the Kit-chat updater further down.

const str = (v: unknown, cap: number) => typeof v === "string" ? v.slice(0, cap) : "";
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function validateStringArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is string => typeof s === "string").slice(0, maxItems).map(s => s.slice(0, maxLen));
}

// Validators return null to mean "wrong shape, reject the write". `skills` is
// the one non-array member here (a {name: proficiency} map), hence the widened
// return type.
const PROFILE_JSON_FIELD_VALIDATORS: Record<string, (raw: unknown) => unknown[] | Record<string, number> | null> = {
  projects: (raw) => {
    if (!Array.isArray(raw)) return null;
    return raw.filter(isRecord).slice(0, 20).map(p => ({
      id: str(p.id, 60) || undefined,
      title: str(p.title, 150),
      description: str(p.description, 500),
      techStack: validateStringArray(p.techStack, 12, 40),
      githubUrl: str(p.githubUrl, 300) || undefined,
      liveUrl: str(p.liveUrl, 300) || undefined,
    })).filter(p => p.title);
  },
  certifications: (raw) => {
    if (!Array.isArray(raw)) return null;
    return raw.filter(isRecord).slice(0, 20).map(c => ({
      id: str(c.id, 60) || undefined,
      name: str(c.name, 150),
      issuer: str(c.issuer, 150),
      date: str(c.date, 40) || undefined,
      credentialUrl: str(c.credentialUrl, 300) || undefined,
    })).filter(c => c.name);
  },
  experience: (raw) => {
    if (!Array.isArray(raw)) return null;
    return raw.filter(isRecord).slice(0, 20).map(e => ({
      id: str(e.id, 60) || undefined,
      company: str(e.company, 150),
      role: str(e.role, 150),
      period: str(e.period, 60),
      bullets: validateStringArray(e.bullets, 6, 300),
    })).filter(e => e.company && e.role);
  },
  education: (raw) => {
    if (!Array.isArray(raw)) return null;
    return raw.filter(isRecord).slice(0, 20).map(ed => ({
      id: str(ed.id, 60) || undefined,
      degree: str(ed.degree, 150),
      institution: str(ed.institution, 200),
      field: str(ed.field, 100) || undefined,
      start: str(ed.start, 20),
      end: str(ed.end, 20),
      cgpa: str(ed.cgpa, 20) || undefined,
    })).filter(ed => ed.degree && ed.institution);
  },
  // {skillName: proficiency 0-100}. Self-rated, so the number is clamped rather
  // than trusted; a non-numeric value defaults to a neutral 50 instead of
  // rejecting the whole write.
  skills: (raw) => {
    if (!isRecord(raw)) return null;
    const out: Record<string, number> = {};
    for (const [name, value] of Object.entries(raw).slice(0, 40)) {
      const key = name.trim().slice(0, 40);
      if (!key) continue;
      const n = typeof value === "number" && Number.isFinite(value) ? value : 50;
      out[key] = Math.max(0, Math.min(100, Math.round(n)));
    }
    return out;
  },
};

/** Validates + sanitizes the JSON-array profile fields; leaves non-JSON fields untouched. */
function validateProfileJsonField(key: string, value: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const validator = PROFILE_JSON_FIELD_VALIDATORS[key];
  if (!validator) return { ok: true, value };
  const result = validator(value);
  if (result === null) return { ok: false, error: `${key} must be an array` };
  return { ok: true, value: result };
}

router.patch("/students/:id/profile", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) {
        const validated = validateProfileJsonField(key, req.body[key]);
        if (!validated.ok) return res.status(400).json({ error: validated.error });
        updates[key] = validated.value;
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    if (updates.targetRole !== undefined || updates.targetBatch !== undefined) {
      logEvent(id, "goal_changed", `Goal updated: ${updates.targetRole ?? "role unchanged"}${updates.targetBatch ? `, batch ${updates.targetBatch}` : ""}`, {
        targetRole: updates.targetRole,
        targetBatch: updates.targetBatch,
      });
    }
    await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id));
    const [updated] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    const profileStrength = computeProfileStrength(updated);
    const commitmentScore = computeCommitmentScore(updated);
    await db.update(studentsTable).set({ profileStrength, commitmentScore }).where(eq(studentsTable.id, id));
    return res.json({
      ok: true,
      profileStrength,
      commitmentScore,
      preferredLocations: Array.isArray(updated.preferredLocations) ? updated.preferredLocations : [],
      projects: Array.isArray(updated.projects) ? updated.projects : [],
      certifications: Array.isArray(updated.certifications) ? updated.certifications : [],
      experience: Array.isArray(updated.experience) ? updated.experience : [],
      education: Array.isArray(updated.education) ? updated.education : [],
      skills: (updated.skills as Record<string, number>) || {},
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    return res.status(500).json({ error: "Server error" });
  }
  return res.status(500).json({ error: "Server error" });
});

// ─── POST /students/:id/profile/import-resume ────────────────────────────────
// Parses an uploaded resume's plain text and fills in whatever profile fields
// are still empty/placeholder — effortless onboarding, never overwrites real
// data the student already entered.

const VALID_FIELDS = [
  "Computer Science", "Electronics", "Mechanical", "Civil",
  "Electrical", "Information Technology", "Data Science",
] as const;

interface ParsedResume {
  name: string | null;
  college: string | null;
  city: string | null;
  gradYear: number | null;
  field: string | null;
  cgpa: string | null;
  phone: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  bio: string | null;
  skills: string[];
  projects: { title: string; description: string; techStack: string[]; githubUrl: string | null; liveUrl: string | null }[];
  certifications: { name: string; issuer: string; date: string | null; credentialUrl: string | null }[];
  experience: { company: string; role: string; period: string; bullets: string[] }[];
}

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v) && v.length <= 300;
}

function sanitizeParsed(raw: unknown): ParsedResume {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, cap = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, cap) : null);

  const gradYearRaw = r.gradYear;
  const gradYear = typeof gradYearRaw === "number" && gradYearRaw > 2000 && gradYearRaw < 2100 ? gradYearRaw : null;

  const fieldRaw = str(r.field, 100);
  const field = fieldRaw && (VALID_FIELDS as readonly string[]).includes(fieldRaw) ? fieldRaw : fieldRaw;

  const skills = Array.isArray(r.skills)
    ? r.skills.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map(s => s.trim().slice(0, 60)).slice(0, 25)
    : [];

  const projects = Array.isArray(r.projects)
    ? (r.projects as unknown[])
        .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
        .filter(p => typeof p.title === "string" && p.title.trim())
        .slice(0, 10)
        .map(p => ({
          title: str(p.title, 150) ?? "",
          description: str(p.description, 500) ?? "",
          techStack: Array.isArray(p.techStack)
            ? (p.techStack as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 12).map(t => t.slice(0, 40))
            : [],
          githubUrl: isHttpUrl(p.githubUrl) ? p.githubUrl : null,
          liveUrl: isHttpUrl(p.liveUrl) ? p.liveUrl : null,
        }))
    : [];

  const certifications = Array.isArray(r.certifications)
    ? (r.certifications as unknown[])
        .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
        .filter(c => typeof c.name === "string" && c.name.trim())
        .slice(0, 10)
        .map(c => ({
          name: str(c.name, 150) ?? "",
          issuer: str(c.issuer, 150) ?? "",
          date: str(c.date, 40),
          credentialUrl: isHttpUrl(c.credentialUrl) ? c.credentialUrl : null,
        }))
    : [];

  const experience = Array.isArray(r.experience)
    ? (r.experience as unknown[])
        .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
        .filter(e => typeof e.company === "string" && e.company.trim() && typeof e.role === "string" && e.role.trim())
        .slice(0, 6)
        .map(e => ({
          company: str(e.company, 150) ?? "",
          role: str(e.role, 150) ?? "",
          period: str(e.period, 60) ?? "",
          bullets: Array.isArray(e.bullets)
            ? (e.bullets as unknown[]).filter((b): b is string => typeof b === "string").slice(0, 5).map(b => b.slice(0, 300))
            : [],
        }))
    : [];

  return {
    name: str(r.name, 150),
    college: str(r.college, 200),
    city: str(r.city, 100),
    gradYear,
    field,
    cgpa: str(r.cgpa, 20),
    phone: str(r.phone, 30),
    githubUrl: isHttpUrl(r.githubUrl) ? r.githubUrl : null,
    linkedinUrl: isHttpUrl(r.linkedinUrl) ? r.linkedinUrl : null,
    portfolioUrl: isHttpUrl(r.portfolioUrl) ? r.portfolioUrl : null,
    bio: str(r.bio, 500),
    skills,
    projects,
    certifications,
    experience,
  };
}

function dedupeKey(name: string) {
  return name.trim().toLowerCase();
}

router.post("/students/:id/profile/import-resume", requireStudent({ allowGuest: true }), rlAiHeavy, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const resumeText = typeof req.body?.resumeText === "string" ? req.body.resumeText.trim() : "";
  if (resumeText.length < 100 || resumeText.length > 20000) {
    return res.status(400).json({ error: "resumeText must be between 100 and 20000 characters" });
  }

  try {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const systemPrompt = `You are a resume parser. Extract ONLY information explicitly present in the resume text.
Use null for any field not clearly stated. NEVER guess, infer, or invent a value that isn't written in the resume.
Respond with valid JSON only — no markdown, no explanation.`;

    const userPrompt = `Resume text:
"""
${resumeText}
"""

Extract into this exact JSON structure:
{
  "name": string|null,
  "college": string|null,
  "city": string|null,
  "gradYear": number|null,
  "field": string|null,
  "cgpa": string|null,
  "phone": string|null,
  "githubUrl": string|null,
  "linkedinUrl": string|null,
  "portfolioUrl": string|null,
  "bio": "1-2 sentence professional summary in the resume's own words, or null",
  "skills": ["technologies/skills explicitly listed"],
  "projects": [{ "title": "", "description": "", "techStack": [""], "githubUrl": string|null, "liveUrl": string|null }],
  "certifications": [{ "name": "", "issuer": "", "date": string|null, "credentialUrl": string|null }],
  "experience": [{ "company": "", "role": "", "period": "", "bullets": [""] }]
}

Rules:
- field: map the branch/degree to one of exactly: Computer Science, Electronics, Mechanical, Civil, Electrical, Information Technology, Data Science — if it clearly doesn't match any, use the literal branch name from the resume
- gradYear: the graduation year as a 4-digit number, null if not stated
- skills, projects, certifications, experience: [] if none found — never invent an entry`;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text : "";
    let parsed: ParsedResume;
    try {
      parsed = sanitizeParsed(extractJson(rawText));
    } catch {
      req.log.error({ rawText }, "Resume import: AI did not return valid JSON");
      return res.status(500).json({ error: "Couldn't read this resume — try pasting it as plain text" });
    }

    const fieldsFilled: string[] = [];
    const updates: Record<string, unknown> = {};

    const fillIfEmpty = (col: keyof typeof studentsTable.$inferSelect, value: unknown, isEmpty: boolean) => {
      if (value !== null && value !== undefined && isEmpty) {
        updates[col] = value;
        fieldsFilled.push(col as string);
      }
    };

    fillIfEmpty("name", parsed.name, !student.name || student.name.startsWith("guest_"));
    fillIfEmpty("college", parsed.college, !student.college || student.college === "Not set");
    fillIfEmpty("city", parsed.city, !student.city || student.city === "Not set");
    fillIfEmpty("field", parsed.field, !student.field || student.field === "Not set");
    fillIfEmpty("cgpa", parsed.cgpa, !student.cgpa);
    fillIfEmpty("phone", parsed.phone, !student.phone);
    fillIfEmpty("bio", parsed.bio, !student.bio);
    fillIfEmpty("githubUrl", parsed.githubUrl, !student.githubUrl);
    fillIfEmpty("linkedinUrl", parsed.linkedinUrl, !student.linkedinUrl);
    fillIfEmpty("portfolioUrl", parsed.portfolioUrl, !student.portfolioUrl);

    if (parsed.gradYear && student.year === 1 && !student.targetBatch) {
      const inferredYear = Math.min(4, Math.max(1, 4 - (parsed.gradYear - new Date().getFullYear())));
      updates.year = inferredYear;
      updates.targetBatch = parsed.gradYear;
      fieldsFilled.push("year", "targetBatch");
    }

    const existingProjects = Array.isArray(student.projects)
      ? (student.projects as { id: string; title: string }[])
      : [];
    const existingProjectKeys = new Set(existingProjects.map(p => dedupeKey(p.title)));
    const newProjects = parsed.projects
      .filter(p => !existingProjectKeys.has(dedupeKey(p.title)))
      .map((p, i) => ({ id: `imp_p_${Date.now()}_${i}`, ...p }));
    if (newProjects.length > 0) {
      updates.projects = [...existingProjects, ...newProjects];
      fieldsFilled.push(`${newProjects.length} project(s)`);
    }

    const existingCerts = Array.isArray(student.certifications)
      ? (student.certifications as { id: string; name: string }[])
      : [];
    const existingCertKeys = new Set(existingCerts.map(c => dedupeKey(c.name)));
    const newCerts = parsed.certifications
      .filter(c => !existingCertKeys.has(dedupeKey(c.name)))
      .map((c, i) => ({ id: `imp_c_${Date.now()}_${i}`, ...c }));
    if (newCerts.length > 0) {
      updates.certifications = [...existingCerts, ...newCerts];
      fieldsFilled.push(`${newCerts.length} certification(s)`);
    }

    const existingExperience = Array.isArray(student.experience)
      ? (student.experience as { id: string; company: string; role: string }[])
      : [];
    const existingExpKeys = new Set(existingExperience.map(e => dedupeKey(`${e.company}|${e.role}`)));
    const newExperience = parsed.experience
      .filter(e => !existingExpKeys.has(dedupeKey(`${e.company}|${e.role}`)))
      .map((e, i) => ({ id: `imp_e_${Date.now()}_${i}`, ...e }));
    if (newExperience.length > 0) {
      updates.experience = [...existingExperience, ...newExperience];
      fieldsFilled.push(`${newExperience.length} experience entr${newExperience.length === 1 ? "y" : "ies"}`);
    }

    if (parsed.skills.length > 0) {
      const existingSkills = (student.skills as Record<string, number>) ?? {};
      const mergedSkills = { ...existingSkills };
      let skillsAdded = 0;
      for (const skill of parsed.skills) {
        if (!(skill in mergedSkills)) {
          mergedSkills[skill] = 60;
          skillsAdded++;
        }
      }
      if (skillsAdded > 0) {
        updates.skills = mergedSkills;
        fieldsFilled.push(`${skillsAdded} skill(s)`);
      }
    }

    let profileStrength = student.profileStrength;
    let commitmentScore = student.commitmentScore;
    if (Object.keys(updates).length > 0) {
      await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id));
      const [updated] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
      profileStrength = computeProfileStrength(updated);
      commitmentScore = computeCommitmentScore(updated);
      await db.update(studentsTable).set({ profileStrength, commitmentScore }).where(eq(studentsTable.id, id));
      logEvent(id, "profile_imported", `Resume imported: ${fieldsFilled.join(", ") || "no new fields"}`, { fieldsFilled });
    }

    return res.json({
      ok: true,
      summary: {
        fieldsFilled,
        projectsAdded: newProjects.length,
        certificationsAdded: newCerts.length,
        experienceAdded: newExperience.length,
      },
      profileStrength,
      commitmentScore,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to import resume");
    return res.status(500).json({ error: "Failed to import resume" });
  }
});

// ─── POST /students/:id/profile/github-projects ─────────────────────────────

interface GithubRepo {
  name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  fork: boolean;
}

router.post("/students/:id/profile/github-projects", requireStudent({ allowGuest: true }), rlAiMedium, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const githubUrl = student.githubUrl as string | null;
  if (!githubUrl) return res.status(400).json({ error: "No GitHub URL on profile — add one first" });

  const match = githubUrl.match(/github\.com\/([^\/\?\s]+)/);
  if (!match) return res.status(400).json({ error: "Invalid GitHub URL on profile" });
  const username = match[1];

  try {
    const { value: repos } = await cacheGetOrSet<GithubRepo[]>(
      { namespace: "github-repos-v1", keyParts: [username], ttlSeconds: 86_400 },
      async () => {
        const resp = await fetch(
          `https://api.github.com/users/${username}/repos?sort=pushed&per_page=20`,
          { headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "KodeTalent-App" } },
        );
        if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
        return (await resp.json()) as GithubRepo[];
      },
    );

    const ownRepos = repos.filter(r => !r.fork).slice(0, 10);

    const existingProjects = Array.isArray(student.projects)
      ? (student.projects as { id: string; title: string }[])
      : [];
    const existingKeys = new Set(existingProjects.map(p => dedupeKey(p.title)));

    const newProjects = ownRepos
      .filter(r => !existingKeys.has(dedupeKey(r.name)))
      .map((r, i) => ({
        id: `gh_${Date.now()}_${i}`,
        title: r.name,
        description: r.description ?? "",
        techStack: r.language ? [r.language] : [],
        githubUrl: r.html_url,
      }));

    if (newProjects.length === 0) {
      return res.json({ added: 0, projects: existingProjects });
    }

    const merged = [...existingProjects, ...newProjects];
    await db.update(studentsTable).set({ projects: merged }).where(eq(studentsTable.id, id));

    const profileStrength = computeProfileStrength({ ...student, projects: merged });
    await db.update(studentsTable).set({ profileStrength }).where(eq(studentsTable.id, id));

    logEvent(id, "profile_imported", `${newProjects.length} GitHub project(s) prefilled`);

    return res.json({ added: newProjects.length, projects: merged, profileStrength });
  } catch (err) {
    req.log.error({ err }, "GitHub projects prefill failed");
    return res.status(500).json({ error: "Failed to fetch GitHub projects" });
  }
});

// ─── POST /students/:id/analyze-github ───────────────────────────────────────

router.post("/students/:id/analyze-github", requireStudent({ allowGuest: true }), rlAiHeavy, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { githubUrl } = req.body as { githubUrl: string };
  if (!githubUrl) return res.status(400).json({ error: "githubUrl required" });

  const match = githubUrl.match(/github\.com\/([^\/\?\s]+)/);
  if (!match) return res.status(400).json({ error: "Invalid GitHub URL" });
  const username = match[1];

  try {
    const [userResp, reposResp] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, {
        headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "KodeTalent-App" },
      }),
      fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=6`, {
        headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "KodeTalent-App" },
      }),
    ]);

    if (!userResp.ok) return res.status(404).json({ error: "GitHub user not found" });

    const userData = await userResp.json() as Record<string, unknown>;
    const reposData = (await reposResp.json()) as Array<Record<string, unknown>>;

    const languageCount: Record<string, number> = {};
    if (Array.isArray(reposData)) {
      for (const repo of reposData) {
        if (repo.language && typeof repo.language === "string") {
          languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
        }
      }
    }
    const topLanguages = Object.entries(languageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang);

    const topRepos = Array.isArray(reposData)
      ? reposData.slice(0, 4).map((r) => ({
          name: r.name as string,
          stars: r.stargazers_count as number,
          language: r.language as string,
          description: r.description as string,
        }))
      : [];

    const stats = {
      username,
      publicRepos: userData.public_repos as number || 0,
      followers: userData.followers as number || 0,
      bio: userData.bio as string || "",
      topLanguages,
      topRepos,
      analyzedAt: new Date().toISOString(),
    };

    await db.update(studentsTable)
      .set({ githubUrl, githubStats: stats })
      .where(eq(studentsTable.id, id));

    const [updated] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    const profileStrength = computeProfileStrength(updated);
    await db.update(studentsTable).set({ profileStrength }).where(eq(studentsTable.id, id));

    return res.json({ ...stats, profileStrength });
  } catch (err) {
    req.log.error({ err }, "GitHub analysis failed");
    return res.status(500).json({ error: "Failed to analyze GitHub profile" });
  }
});

// ─── POST /students/:id/analyze-linkedin ─────────────────────────────────────

router.post("/students/:id/analyze-linkedin", requireStudent(), rlAiHeavy, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { linkedinUrl, headline, summary, skills: linkedinSkills, experience } = req.body as {
    linkedinUrl: string;
    headline?: string;
    summary?: string;
    skills?: string[];
    experience?: string;
  };
  if (!linkedinUrl) return res.status(400).json({ error: "linkedinUrl required" });

  try {
    const pack = await contextPack(id);
    const prompt = `You are a career advisor analyzing a student's LinkedIn profile for Indian tech recruiters.

${pack?.text ?? ""}

LinkedIn URL: ${linkedinUrl}
${headline ? `Headline: ${headline}` : ""}
${summary ? `Summary: ${summary}` : ""}
${linkedinSkills?.length ? `Skills listed: ${linkedinSkills.join(", ")}` : ""}
${experience ? `Experience: ${experience}` : ""}

Return ONLY valid JSON with this structure:
{
  "strengthScore": <0-100 integer>,
  "profileTier": "strong|average|needs-work",
  "highlights": ["string", ...],
  "improvements": ["string", ...],
  "recruitersWillNotice": "one sentence about their strongest point",
  "analyzedAt": "${new Date().toISOString()}"
}`;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0];
    if (raw.type !== "text") return res.status(500).json({ error: "AI error" });

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJson<Record<string, unknown>>(raw.text);
    } catch {
      parsed = { strengthScore: 50, profileTier: "average", highlights: [], improvements: [], recruitersWillNotice: "" };
    }

    const linkedinData = { ...parsed, linkedinUrl };
    await db.update(studentsTable)
      .set({ linkedinUrl, linkedinData })
      .where(eq(studentsTable.id, id));

    const [updated] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    const profileStrength = computeProfileStrength(updated);
    await db.update(studentsTable).set({ profileStrength }).where(eq(studentsTable.id, id));

    return res.json({ ...linkedinData, profileStrength });
  } catch (err) {
    req.log.error({ err }, "LinkedIn analysis failed");
    return res.status(500).json({ error: "Failed to analyze LinkedIn profile" });
  }
});

// ─── POST /students/:id/chat ─────────────────────────────────────────────────

router.post("/students/:id/chat", requireStudent({ allowGuest: true }), rlAiMedium, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { message } = req.body as { message: string };
  if (!message?.trim()) return res.status(400).json({ error: "message required" });

  try {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const pack = await contextPack(id);
    const profileCtx = `
Name: ${student.name}
College: ${student.college} (${student.city})
Field: ${student.field} | Year: ${student.year}
CGPA: ${student.cgpa || "not set"}
Bio: ${student.bio || "not set"}
GitHub: ${student.githubUrl || "not set"}
LinkedIn: ${student.linkedinUrl || "not set"}
Portfolio: ${student.portfolioUrl || "not set"}
Phone: ${student.phone || "not set"}
Projects (${(student.projects as unknown[])?.length ?? 0}): ${JSON.stringify(student.projects ?? [])}
Certifications (${(student.certifications as unknown[])?.length ?? 0}): ${JSON.stringify(student.certifications ?? [])}
Skills: ${JSON.stringify(student.skills ?? {})}
Work Mode: ${student.workMode || "not set"}
Preferred Locations: ${JSON.stringify(student.preferredLocations ?? [])}
Expected Salary: ${student.expectedSalary ? student.expectedSalary + " LPA" : "not set"}
Dream Company: ${student.dreamCompany || "not set"}
Profile Strength: ${student.profileStrength}/100
Overall Score: ${Math.round(student.overallScore)}/100
XP: ${student.xp} | Streak: ${student.streakCount} days
Open to Work: ${student.openToWork ? "Yes" : "No"}`.trim();

    const systemPrompt = `You are Kit — KodeTalent's AI career companion for Indian engineering students, and also a very cool cat who wears sunglasses. 😎🐱

CURRENT STUDENT PROFILE:
${profileCtx}

${pack?.text ?? ""}

YOUR PERSONALITY:
- Warm, witty, and genuinely helpful — like a brilliant friend who happens to be a career expert
- Keep replies short and interactive: usually 1-3 sentences max
- Add light sarcasm only sometimes, never mean-spirited
- Casually slip in cat puns when they fit naturally: "purrfect!", "let me pounce on that", "meow we're talking!", "claw your way up", "let's not pussyfoot around", "I've got my eyes on it 😎"
- Use emojis naturally but not excessively (1-2 per reply max)
- Ask a quick follow-up when useful instead of over-explaining
- Be direct and specific — give REAL actionable advice, not generic fluff
- Be honest: if their profile needs work, say so kindly but clearly
- Never be boring. Never be corporate. Never say "Certainly!" or "Of course!"

INDIAN PLACEMENT CONTEXT:
- Use LPA (not USD), mention FAANG/unicorn/product companies vs service companies
- Reference campus placements, off-campus drives, CGPA cutoffs, coding rounds, DSA
- Tier-1 (IIT/NIT/BITS), Tier-2 colleges context matters for strategy
- Startups, MNCs, PSUs — know the landscape

YOU CAN UPDATE THEIR PROFILE: When the student asks you to add/change profile info, include this block EXACTLY at the very end of your response (after your conversational reply):
___PROFILE_UPDATE___
{"bio":"...","workMode":"remote","preferredLocations":["Bangalore","Mumbai"],"expectedSalary":12}

VALID UPDATE FIELDS: bio, githubUrl, linkedinUrl, portfolioUrl, phone, cgpa, dreamCompany, workMode (remote/hybrid/in-office), preferredLocations (string array), expectedSalary (number in LPA), projects (array of {title,description,techStack:[],url}), certifications (array of {name,issuer,date,url})

RULES:
- Only include ___PROFILE_UPDATE___ when actually making a profile change — never for informational replies
- For projects/certs, include the COMPLETE new array (existing + new entries)
- Be Kit — not a generic AI assistant. Have personality.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = anthropic.messages.stream({
      model: AI_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    // Parse and apply profile update if present
    let profileUpdated = false;
    const marker = "___PROFILE_UPDATE___";
    const markerIdx = fullResponse.indexOf(marker);
    if (markerIdx !== -1) {
      const jsonStr = fullResponse.slice(markerIdx + marker.length).trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const updates = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
          const filtered: Record<string, unknown> = {};
          for (const key of ALLOWED_FIELDS) {
            if (updates[key] === undefined) continue;
            const validated = validateProfileJsonField(key, updates[key]);
            if (validated.ok) filtered[key] = validated.value;
          }
          if (Object.keys(filtered).length > 0) {
            await db.update(studentsTable).set(filtered).where(eq(studentsTable.id, id));
            const [updated] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
            const profileStrength = computeProfileStrength(updated);
            const commitmentScore = computeCommitmentScore(updated);
            await db.update(studentsTable).set({ profileStrength, commitmentScore }).where(eq(studentsTable.id, id));
            profileUpdated = true;
          }
        } catch { /* invalid JSON, skip */ }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, profileUpdated })}\n\n`);
    res.end();
    return;
  } catch (err) {
    req.log.error({ err }, "AI chat failed");
    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error" });
    }
    res.write(`data: ${JSON.stringify({ done: true, error: true })}\n\n`);
    res.end();
    return;
  }
});

// ─── GET /students (recruiter talent pool) ───────────────────────────────────

router.get("/talent-pool", async (req, res) => {
  try {
    const students = await db
      .select({
        id: studentsTable.id,
        name: studentsTable.name,
        college: studentsTable.college,
        city: studentsTable.city,
        year: studentsTable.year,
        field: studentsTable.field,
        cgpa: studentsTable.cgpa,
        githubUrl: studentsTable.githubUrl,
        linkedinUrl: studentsTable.linkedinUrl,
        portfolioUrl: studentsTable.portfolioUrl,
        bio: studentsTable.bio,
        projects: studentsTable.projects,
        certifications: studentsTable.certifications,
        openToWork: studentsTable.openToWork,
        workMode: studentsTable.workMode,
        preferredLocations: studentsTable.preferredLocations,
        expectedSalary: studentsTable.expectedSalary,
        githubStats: studentsTable.githubStats,
        profileStrength: studentsTable.profileStrength,
        commitmentScore: studentsTable.commitmentScore,
        overallScore: studentsTable.overallScore,
        xp: studentsTable.xp,
        level: studentsTable.level,
        skills: studentsTable.skills,
        isPro: studentsTable.isPro,
      })
      .from(studentsTable)
      .where(eq(studentsTable.openToWork, true))
      .orderBy(studentsTable.profileStrength);
    return res.json(students);
  } catch (err) {
    req.log.error({ err }, "Failed to get talent pool");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
