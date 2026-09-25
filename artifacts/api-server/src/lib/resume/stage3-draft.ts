import type { studentsTable } from "@workspace/db";
import { db, courseCertificatesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import type {
  Bullet,
  CertificationEntry,
  ContactLink,
  DensityBudget,
  EducationEntry,
  EvidenceLedger,
  EvidenceMap,
  ExperienceEntry,
  JdAnalysis,
  ProjectEntry,
  ResumeDocument,
  SectionKey,
  SkillSection,
} from "@workspace/resume-core";
import { CLICHES, normTerm, renderDensityBudget, skillCategory, termVariants } from "@workspace/resume-core";
import { callJson } from "./callJson";
import { renderLedgerForPrompt } from "./ledger";
import { formatDegree, gradYearFor } from "./fallbacks";
import { logger } from "../logger";
import { asObjectArray, ShapeError } from "./shapes";

type Student = typeof studentsTable.$inferSelect;

interface ProjectRow { title: string; description?: string; techStack?: string[]; githubUrl?: string | null; liveUrl?: string | null }
interface CertRow { name: string; issuer: string; date?: string | null; credentialUrl?: string | null }
interface ExperienceRow { company: string; role: string; period?: string; bullets?: string[] }
interface EducationRow { degree: string; institution: string; field?: string; start?: string; end?: string; cgpa?: string | null }

const SYSTEM_PROMPT = `You are writing an ATS-optimized resume for an Indian engineering student.

THE ONE RULE: every noun you write must trace to a ledger ID from the evidence provided. A bullet
you cannot cite with a real ledger ID will be deleted before the student ever sees it — so never
write one. The job spec tells you what the employer WANTS; it is not a list of what this candidate
HAS. Never hedge with "familiar with" or "exposure to" for something absent from the ledger.

Bullets: verb + specific thing built + technology named as the JD names it + measurable result or
concrete scope. 14-28 words, one line preferred, two max. Never open with "Responsible for",
"Worked on", or "Helped with". Vary the opening verb. Never use "Utilised", "Leveraged",
"Spearheaded", or other filler verbs a real engineer wouldn't say. Numbers come ONLY from the
ledger — where there is none, use concrete scope ("across three microservices"), never an invented
percentage. Never use self-adjectives like robust, scalable, seamless.

Keyword tailoring that is not fabrication: where the ledger and the job description use different
words for the same real thing, use the JOB DESCRIPTION's word — that is the string an ATS parser
scans for.

Never append a benefit the ledger doesn't state ("improving efficiency", "enhancing scalability"):
where there is no real result, end the bullet with the concrete scope or technology instead.

Every bullet opens with a different past-tense action verb (Built, Designed, Automated, Reduced,
Deployed, Integrated, Analyzed, Optimized...): never the same opener more than twice in the whole
resume. Active voice only, never "was developed" or "were built". Give each entry 2-4 bullets
when the evidence supports it. Write each technology the way its makers do (JavaScript, Node.js,
PostgreSQL, AWS). Spell a well-known acronym out once where it helps a keyword scanner, e.g.
"Natural Language Processing (NLP)".

Length: recruiters and checkers expect ~300+ words on a one-page student resume. Write each
bullet as 16-26 words of concrete detail from the ledger (what, how, with which tools, for whom).

Soft skills: name one (collaborated, presented, led, mentored, coordinated) only where the ledger
shows it, e.g. "bugs reported by QA team" supports "collaborated with the QA team".

Summary: 35-45 words, no first person, no "seeking". Open with the role the student is aiming
for, then their strongest real evidence. Never use passionate, motivated, team player,
results-driven, or detail-oriented.

Headline: "<Target role> | <3-4 strongest real skills>".

Skills: 2-5 categories with plain names an ATS recognises ("Languages", "Frameworks & Libraries",
"Databases", "Tools & Platforms", "Cloud & DevOps"), ordered by relevance to the job. At least 5
skills total when the ledger has them. Never list soft skills.

Never use any of these words or phrases anywhere: ${CLICHES.join(", ")}.

Respond with valid JSON only — no markdown, no explanation.`;

/** Guest accounts carry a placeholder address; printing it would be worse
 * than printing none (the review asks the student to add a real one). */
function resumeEmail(email: string | null | undefined): string {
  if (!email || /@guest\.[a-z.]*internal$/i.test(email)) return "";
  return email;
}

function buildUserPrompt(opts: {
  ledger: EvidenceLedger;
  jd: JdAnalysis;
  map: EvidenceMap;
  budget: DensityBudget;
  experience: (ExperienceRow & { ledgerId: string })[];
  projects: (ProjectRow & { ledgerId: string })[];
}): string {
  const expList = opts.experience.map((e, i) => `experience[${i}] (${e.ledgerId}): ${e.role} at ${e.company}`).join("\n") || "(none)";
  const projList = opts.projects.map((p, i) => `projects[${i}] (${p.ledgerId}): ${p.title}`).join("\n") || "(none)";

  return `Evidence ledger:
${renderLedgerForPrompt(opts.ledger)}

Target job: ${opts.jd.roleTitle} (${opts.jd.roleFamily})
Thesis for this resume: ${opts.map.thesis}
JD's own ATS vocabulary to mirror where truthful: ${opts.jd.atsVocabulary.join(", ") || "none"}

Density budget (hard caps — never exceed):
${renderDensityBudget(opts.budget)}

Experience entries available to write bullets for (reference by array index, keep company/role/dates as given — you only write the bullets):
${expList}

Project entries available to write bullets for (reference by array index, keep title/tech as given — you only write the bullets):
${projList}

Return JSON with this exact structure:
{
  "headline": "one line under the name, e.g. 'Backend Engineer | Node.js, PostgreSQL' — built from real skills only",
  "summary": "at most 45 words",
  "experience": [{ "index": 0, "bullets": [{ "text": "...", "evidence": ["ledger IDs this bullet traces to"] }] }],
  "projects": [{ "index": 0, "bullets": [{ "text": "...", "evidence": ["ledger IDs this bullet traces to"] }] }],
  "skillSections": [{ "category": "Languages", "items": ["exact skill names from the ledger's SK/GL rows only"], "evidence": ["SK:1","GL:2"] }],
  "achievements": [{ "text": "...", "evidence": ["ledger IDs"] }]
}

Rules:
- experience/projects: only include entries you were given an index for. Skip any entry you have nothing truthful to say about rather than padding it.
- evidence arrays must contain real IDs from the ledger above — an empty array means the bullet gets deleted, so never submit a bullet with no evidence.
- If the ledger is thin, the resume is short. A short honest resume beats a padded one.`;
}

interface DraftBullet { text: string; evidence: unknown }
interface DraftIndexedEntry { index: number; bullets: DraftBullet[] }
interface DraftSkillSection { category: string; items: string[]; evidence?: unknown }
interface DraftOutput {
  headline: string;
  summary: string;
  experience: DraftIndexedEntry[];
  projects: DraftIndexedEntry[];
  skillSections: DraftSkillSection[];
  achievements: DraftBullet[];
}

function toBullets(raw: DraftBullet[] | undefined, validIds: Set<string>, maxCount: number): Bullet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b): Bullet | null => {
      if (!b || typeof b.text !== "string") return null;
      const evidence = (Array.isArray(b.evidence) ? b.evidence : []).filter((e): e is string => typeof e === "string" && validIds.has(e));
      if (evidence.length === 0) return null; // no citation → deleted before render, per the fabrication gate
      return { text: b.text.slice(0, 400), evidence };
    })
    .filter((b): b is Bullet => b !== null)
    .slice(0, maxCount);
}

export function parsePeriod(period: string | undefined): { start: string; end: string } {
  if (!period) return { start: "", end: "" };
  const parts = period.split(/[-–—]/).map((p) => p.trim());
  return { start: parts[0] ?? "", end: parts[1] ?? period };
}

function buildContactLinks(student: Student): ContactLink[] {
  const links: ContactLink[] = [];
  const shorten = (url: string) => {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return `${u.hostname}${u.pathname}`.replace(/\/$/, "");
    } catch {
      return url;
    }
  };
  if (student.githubUrl) links.push({ label: shorten(student.githubUrl), url: student.githubUrl, kind: "github" });
  if (student.linkedinUrl) links.push({ label: shorten(student.linkedinUrl), url: student.linkedinUrl, kind: "linkedin" });
  if (student.portfolioUrl) links.push({ label: shorten(student.portfolioUrl), url: student.portfolioUrl, kind: "portfolio" });
  return links;
}

function buildEducationEntries(student: Student): EducationEntry[] {
  const rows = (Array.isArray(student.education) ? student.education : []) as EducationRow[];
  if (rows.length > 0) {
    return rows.map((r) => ({
      degree: r.degree,
      institution: r.institution,
      field: r.field,
      start: r.start ?? "",
      end: r.end ?? "",
      cgpa: r.cgpa ?? null,
    }));
  }
  if (!student.field && !student.college) return [];
  const gradYear = gradYearFor(student.year);
  return [{
    degree: formatDegree(student.field),
    institution: student.college,
    start: String(gradYear - 4),
    end: String(gradYear),
    cgpa: student.cgpa ?? null,
  }];
}

function buildCertificationEntries(student: Student, courseCerts: CertificationEntry[] = []): CertificationEntry[] {
  const rows = (Array.isArray(student.certifications) ? student.certifications : []) as CertRow[];
  const manual = rows.map((c) => ({ name: c.name, issuer: c.issuer, date: c.date ?? null, link: c.credentialUrl ?? null }));
  // Verified course certificates the student opted into (includeOnResume) are
  // appended after their manually-entered certifications.
  return [...manual, ...courseCerts];
}

/**
 * Course certificates the student chose to show on their resume
 * (includeOnResume = true), newest first. Empty when none opted in. The link is
 * the relative public verify path — the app has no server-side origin to build
 * an absolute URL from, matching how the /certs/:slug route is addressed.
 */
async function fetchResumeCourseCertificates(studentId: number): Promise<CertificationEntry[]> {
  try {
    return await queryResumeCourseCertificates(studentId);
  } catch (err) {
    // Optional enrichment: a DB hiccup (or a missing column on a stale
    // schema) must not take the whole generation down with it.
    logger.warn({ err, studentId }, "resume pipeline: course certificate lookup failed, continuing without them");
    return [];
  }
}

async function queryResumeCourseCertificates(studentId: number): Promise<CertificationEntry[]> {
  const rows = await db
    .select({
      subDomainName: courseCertificatesTable.subDomainName,
      verifySlug: courseCertificatesTable.verifySlug,
      issuedAt: courseCertificatesTable.issuedAt,
    })
    .from(courseCertificatesTable)
    .where(and(eq(courseCertificatesTable.studentId, studentId), eq(courseCertificatesTable.includeOnResume, true)))
    .orderBy(desc(courseCertificatesTable.issuedAt));
  return rows.map((c) => ({
    name: `${c.subDomainName} — Verified Certificate`,
    issuer: "ninelab",
    date: c.issuedAt.toISOString().slice(0, 7), // YYYY-MM
    link: `/certs/${c.verifySlug}`,
  }));
}

function skillName(rowText: string): string {
  return rowText.replace(/^Skill: |^GitHub language: /, "").split(" (")[0];
}

/**
 * Deterministic draft for when the model is unavailable. Everything is copied
 * from the profile and cites the ledger row it came from, so the fabrication
 * gate keeps it instead of stripping the resume down to a name.
 */
function fallbackDraft(student: Student, ledger: EvidenceLedger, experienceRows: ExperienceRow[], projectRows: ProjectRow[]): {
  headline: string; summary: string; experience: ExperienceEntry[]; projects: ProjectEntry[]; skillSections: SkillSection[]; achievements: never[];
} {
  const skillRows = ledger.rows.filter((r) => r.kind === "SK" || r.kind === "GL");
  const exIds = ledger.rows.filter((r) => r.kind === "EX").map((r) => r.id);
  const prIds = ledger.rows.filter((r) => r.kind === "PR").map((r) => r.id);
  const edId = ledger.rows.find((r) => r.kind === "ED")?.id;
  const topSkills = skillRows.slice(0, 3).map((r) => skillName(r.text));
  const summaryParts = [
    student.field && student.college ? `${formatDegree(student.field)} student at ${student.college}` : "",
    topSkills.length ? `with hands-on work in ${topSkills.join(", ")}` : "",
  ].filter(Boolean);
  return {
    headline: student.targetRole ?? "",
    summary: summaryParts.length && edId ? `${summaryParts.join(" ")}.` : "",
    experience: experienceRows.map((e, i) => ({
      company: e.company,
      role: e.role,
      start: parsePeriod(e.period).start,
      end: parsePeriod(e.period).end,
      bullets: (e.bullets ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 4)
        .map((text) => ({ text, evidence: exIds[i] ? [exIds[i]] : [] })),
    })),
    projects: projectRows.map((p, i) => ({
      title: p.title,
      tech: p.techStack ?? [],
      link: p.githubUrl ?? p.liveUrl ?? null,
      bullets: p.description ? [{ text: p.description, evidence: prIds[i] ? [prIds[i]] : [] }] : [],
    })),
    skillSections: skillRows.length > 0
      ? [{ category: "Technical Skills", items: [...new Set(skillRows.map((r) => skillName(r.text)))], evidence: skillRows.map((r) => r.id) }]
      : [],
    achievements: [],
  };
}

export interface DraftResumeResult {
  doc: ResumeDocument;
  degraded: boolean;
}

/** Stage 3: drafting. Never cached — this is the creative step. */
export async function draftResume(opts: {
  student: Student;
  ledger: EvidenceLedger;
  jd: JdAnalysis;
  map: EvidenceMap;
  budget: DensityBudget;
  signal?: AbortSignal;
}): Promise<DraftResumeResult> {
  const { student, ledger, jd, map, budget } = opts;
  const validIds = new Set(ledger.rows.map((r) => r.id));

  // Opted-in verified course certificates, fetched once and appended in both
  // the AI-draft and fallback paths below.
  const courseCerts = await fetchResumeCourseCertificates(student.id);

  const experienceRows = (Array.isArray(student.experience) ? student.experience : []) as ExperienceRow[];
  const projectRows = (Array.isArray(student.projects) ? student.projects : []) as ProjectRow[];
  const exLedgerIds = ledger.rows.filter((r) => r.kind === "EX").map((r) => r.id);
  const prLedgerIds = ledger.rows.filter((r) => r.kind === "PR").map((r) => r.id);

  const order: SectionKey[] = ["summary", ...map.sectionOrder];

  let raw: DraftOutput;
  let degraded = false;
  try {
    raw = await callJson<DraftOutput>({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt({
        ledger, jd, map, budget,
        experience: experienceRows.map((e, i) => ({ ...e, ledgerId: exLedgerIds[i] ?? `EX:${i + 1}` })),
        projects: projectRows.map((p, i) => ({ ...p, ledgerId: prLedgerIds[i] ?? `PR:${i + 1}` })),
      }),
      maxTokens: 2600,
      temperature: 0.4,
      signal: opts.signal,
      stageName: "draft",
      shape: (r) => {
        if (!r || typeof r !== "object" || Array.isArray(r)) throw new ShapeError("draft was not a JSON object");
        return r as DraftOutput;
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    logger.warn({ err }, "resume pipeline: stage 3 (draft) failed, assembling verbatim from ledger");
    const fb = fallbackDraft(student, ledger, experienceRows, projectRows);
    return {
      degraded: true,
      doc: {
        schemaVersion: 2,
        contact: { name: student.name, email: resumeEmail(student.email), phone: student.phone, city: student.city, links: buildContactLinks(student) },
        headline: fb.headline,
        summary: fb.summary,
        order,
        skillSections: fb.skillSections,
        experience: fb.experience,
        projects: fb.projects,
        education: buildEducationEntries(student),
        certifications: buildCertificationEntries(student, courseCerts),
        achievements: fb.achievements,
        atsMeta: null,
      },
    };
  }

  const rawExperience = asObjectArray(raw?.experience) as unknown as DraftIndexedEntry[];
  const rawProjects = asObjectArray(raw?.projects) as unknown as DraftIndexedEntry[];
  const rawSkills = asObjectArray(raw?.skillSections) as unknown as DraftSkillSection[];
  const rawAchievements = asObjectArray(raw?.achievements) as unknown as DraftBullet[];

  const experience: ExperienceEntry[] = rawExperience
    .filter((e) => Number.isInteger(e.index) && experienceRows[e.index])
    .slice(0, budget.experienceMaxEntries)
    .map((e) => {
      const row = experienceRows[e.index];
      const { start, end } = parsePeriod(row.period);
      return {
        company: row.company,
        role: row.role,
        start,
        end,
        bullets: toBullets(e.bullets, validIds, budget.experienceMaxBulletsPerEntry),
      };
    })
    .filter((e) => e.bullets.length > 0);

  const projects: ProjectEntry[] = rawProjects
    .filter((p) => Number.isInteger(p.index) && projectRows[p.index])
    .slice(0, budget.projectsMaxEntries)
    .map((p) => {
      const row = projectRows[p.index];
      return {
        title: row.title,
        tech: row.techStack ?? [],
        link: row.githubUrl ?? row.liveUrl ?? null,
        bullets: toBullets(p.bullets, validIds, budget.projectsMaxBulletsPerEntry),
      };
    })
    .filter((p) => p.bullets.length > 0);

  // The model answered but cited nothing usable for any entry (every bullet
  // lacked evidence). Rather than ship a resume with no work on it, fall back
  // to the profile's own words for the entries.
  let rescuedExperience = experience;
  let rescuedProjects = projects;
  if (experience.length === 0 && projects.length === 0 && experienceRows.length + projectRows.length > 0) {
    const fb = fallbackDraft(student, ledger, experienceRows, projectRows);
    rescuedExperience = fb.experience.filter((e) => e.bullets.length > 0).slice(0, budget.experienceMaxEntries);
    rescuedProjects = fb.projects.filter((p) => p.bullets.length > 0).slice(0, budget.projectsMaxEntries);
    degraded = true;
  }

  // Both spellings of each profile skill ("REST API" / "REST APIs"), so a
  // plural or alias the model uses isn't dropped as if it were invented.
  const skillLedgerTerms = new Set(
    ledger.rows
      .filter((r) => r.kind === "SK" || r.kind === "GL")
      .flatMap((r) => termVariants(normTerm(skillName(r.text)))),
  );
  const isProfileSkill = (item: string) => termVariants(normTerm(item)).some((v) => skillLedgerTerms.has(v));
  const skillSections: SkillSection[] = rawSkills
    .slice(0, budget.skillsMaxCategories)
    .map((s) => ({
      category: (typeof s.category === "string" ? s.category : "").slice(0, 60),
      items: (Array.isArray(s.items) ? s.items : []).filter((i) => typeof i === "string" && isProfileSkill(i)).slice(0, budget.skillsMaxItemsPerCategory),
      evidence: (Array.isArray(s.evidence) ? s.evidence : []).filter((e): e is string => typeof e === "string" && validIds.has(e)),
    }))
    .filter((s) => s.category && s.items.length > 0);

  // Keyword scanners count every hard skill; the model often lists only a
  // subset. Any profile skill still missing goes into its standard group.
  const listed = new Set(skillSections.flatMap((s) => s.items.flatMap((i) => termVariants(normTerm(i)))));
  const skillRows = ledger.rows.filter((r) => r.kind === "SK" || r.kind === "GL");
  for (const row of skillRows) {
    const name = skillName(row.text);
    if (!name || termVariants(normTerm(name)).some((v) => listed.has(v))) continue;
    listed.add(normTerm(name));
    const category = skillCategory(name) ?? "Other Skills";
    const target = skillSections.find((s) => s.category.toLowerCase() === category.toLowerCase());
    if (target) target.items.push(name);
    else skillSections.push({ category, items: [name], evidence: [row.id] });
  }

  const achievements = rawAchievements
    .slice(0, budget.achievementsMaxItems)
    .map((a) => {
      const evidence = (Array.isArray(a.evidence) ? a.evidence : []).filter((e): e is string => typeof e === "string" && validIds.has(e));
      return evidence.length > 0 && typeof a.text === "string" ? { text: a.text.slice(0, 300), evidence } : null;
    })
    .filter((a): a is { text: string; evidence: string[] } => a !== null);

  return {
    degraded,
    doc: {
      schemaVersion: 2,
      contact: { name: student.name, email: resumeEmail(student.email), phone: student.phone, city: student.city, links: buildContactLinks(student) },
      headline: typeof raw?.headline === "string" ? raw.headline.slice(0, 120) : "",
      summary: typeof raw?.summary === "string" ? raw.summary.slice(0, 400) : "",
      order,
      skillSections,
      experience: rescuedExperience,
      projects: rescuedProjects,
      education: buildEducationEntries(student),
      certifications: buildCertificationEntries(student, courseCerts),
      achievements,
      atsMeta: null,
    },
  };
}
