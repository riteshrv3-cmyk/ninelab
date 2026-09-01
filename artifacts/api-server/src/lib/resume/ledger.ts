import { createHash } from "node:crypto";
import type { studentsTable } from "@workspace/db";
import type { EvidenceLedger, LedgerRow, QuantFact } from "@workspace/resume-core";
import { normTerm } from "@workspace/resume-core";
import { formatDegree } from "./fallbacks";

type Student = typeof studentsTable.$inferSelect;

interface ProjectRow { id?: string; title: string; description?: string; techStack?: string[]; githubUrl?: string | null; liveUrl?: string | null }
interface CertRow { id?: string; name: string; issuer: string; date?: string | null }
interface ExperienceRow { id?: string; company: string; role: string; period?: string; bullets?: string[] }
interface EducationRow { id?: string; degree: string; institution: string; field?: string; start?: string; end?: string; cgpa?: string | null }
interface GithubStats {
  username?: string;
  topLanguages?: string[];
  topRepos?: { name: string; stars: number; language: string; description: string }[];
}

/**
 * Builds the deterministic, pre-LLM evidence ledger — a numbered table of
 * everything verifiably true about the student. Every downstream stage cites
 * ledger IDs instead of writing free-form claims, which is what makes
 * anti-fabrication structural rather than a post-hoc filter.
 */
export function buildLedger(student: Student): EvidenceLedger {
  const rows: LedgerRow[] = [];
  let n = 0;

  const skills = (student.skills as Record<string, number>) ?? {};
  for (const [name, proficiency] of Object.entries(skills)) {
    rows.push({ id: `SK:${++n}`, kind: "SK", text: `Skill: ${name} (self-rated proficiency ${proficiency}/100)` });
  }

  const githubStats = student.githubStats as GithubStats | null;
  n = 0;
  for (const lang of githubStats?.topLanguages ?? []) {
    rows.push({ id: `GL:${++n}`, kind: "GL", text: `GitHub language: ${lang}` });
  }
  n = 0;
  for (const repo of githubStats?.topRepos ?? []) {
    rows.push({ id: `GR:${++n}`, kind: "GR", text: `GitHub repo: ${repo.name} (${repo.language}, ${repo.stars} stars)${repo.description ? ` — ${repo.description}` : ""}` });
  }

  n = 0;
  const projects = (Array.isArray(student.projects) ? student.projects : []) as ProjectRow[];
  for (const p of projects) {
    const tech = (p.techStack ?? []).join(", ");
    rows.push({
      id: `PR:${++n}`,
      kind: "PR",
      text: `Project: "${p.title}"${tech ? ` — tech: ${tech}` : ""}${p.description ? ` — ${p.description}` : ""}`,
    });
  }

  n = 0;
  const experience = (Array.isArray(student.experience) ? student.experience : []) as ExperienceRow[];
  for (const e of experience) {
    const bullets = (e.bullets ?? []).join(" | ");
    rows.push({
      id: `EX:${++n}`,
      kind: "EX",
      text: `Experience: ${e.role} at ${e.company}${e.period ? ` (${e.period})` : ""}${bullets ? ` — ${bullets}` : ""}`,
    });
  }

  n = 0;
  const certifications = (Array.isArray(student.certifications) ? student.certifications : []) as CertRow[];
  for (const c of certifications) {
    rows.push({ id: `CE:${++n}`, kind: "CE", text: `Certification: ${c.name} — ${c.issuer}${c.date ? ` (${c.date})` : ""}` });
  }

  n = 0;
  const education = (Array.isArray(student.education) ? student.education : []) as EducationRow[];
  if (education.length > 0) {
    for (const ed of education) {
      rows.push({
        id: `ED:${++n}`,
        kind: "ED",
        text: `Education: ${ed.degree} at ${ed.institution}${ed.field ? ` (${ed.field})` : ""}${ed.start || ed.end ? ` — ${[ed.start, ed.end].filter(Boolean).join(" to ")}` : ""}${ed.cgpa ? ` — CGPA ${ed.cgpa}` : ""}`,
      });
    }
  } else {
    // Flat onboarding fields are the only education signal until the student
    // fills the structured Education card — still real, still citable.
    rows.push({ id: "ED:1", kind: "ED", text: `Education: ${formatDegree(student.field)} at ${student.college}${student.cgpa ? ` — CGPA ${student.cgpa}` : ""}` });
  }

  n = 0;
  if (student.bio) rows.push({ id: `BI:${++n}`, kind: "BI", text: `Bio (student's own words): ${student.bio}` });

  n = 0;
  if (student.dreamCompany) rows.push({ id: `GO:${++n}`, kind: "GO", text: `Dream company: ${student.dreamCompany}` });
  if (student.targetPackage) rows.push({ id: `GO:${++n}`, kind: "GO", text: `Target package: ${student.targetPackage}` });
  if (student.targetRole) rows.push({ id: `GO:${++n}`, kind: "GO", text: `Target role: ${student.targetRole}` });

  const allowedTerms = new Set<string>();
  for (const row of rows) {
    for (const term of extractCandidateTerms(row.text)) allowedTerms.add(term);
  }

  return { rows, allowedTerms };
}

// Pulls out normalized word/phrase candidates from ledger text so ATS-style
// technology names (react, node.js, aws) are matchable regardless of casing
// or punctuation — a light heuristic, not the full lexicon scan (that lives
// in resume-core and is reserved for JD-side extraction).
function extractCandidateTerms(text: string): string[] {
  const terms: string[] = [];
  const tokens = text
    .toLowerCase()
    .split(/[,;:()|]|(?:\s-\s)|—/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const t of tokens) {
    const norm = normTerm(t);
    if (norm) terms.push(norm);
    for (const word of t.split(/\s+/)) {
      const wn = normTerm(word);
      if (wn) terms.push(wn);
    }
  }
  return terms;
}

/**
 * Extends a ledger with user-attested metrics from the quantification coach.
 * Each fact becomes a "UA" row whose id ("UA:1") bullets can cite, and its
 * numeric value joins allowedTerms so the forbidden-term scan never trips on
 * a number the student personally typed. Every gate check on a resume with
 * quantFacts must use this, or old UA citations would start failing.
 */
export function withQuantFacts(ledger: EvidenceLedger, facts: QuantFact[]): EvidenceLedger {
  if (!facts.length) return ledger;
  const rows = [...ledger.rows];
  const allowedTerms = new Set(ledger.allowedTerms);
  for (const f of facts) {
    if (!f || typeof f.id !== "string") continue;
    rows.push({ id: f.id, kind: "UA", text: `User-confirmed metric: ${f.question} → ${f.value} ${f.unit}`.trim() });
    const v = normTerm(String(f.value));
    if (v) allowedTerms.add(v);
  }
  return { rows, allowedTerms };
}

/** Defensive parse of the quant_facts jsonb column. */
export function parseQuantFacts(raw: unknown): QuantFact[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is QuantFact =>
    Boolean(f && typeof f === "object"
      && typeof (f as QuantFact).id === "string"
      && typeof (f as QuantFact).value === "string"),
  );
}

export function ledgerVolume(ledger: EvidenceLedger) {
  return {
    experienceCount: ledger.rows.filter((r) => r.kind === "EX").length,
    projectCount: ledger.rows.filter((r) => r.kind === "PR").length,
    certificationCount: ledger.rows.filter((r) => r.kind === "CE").length,
    skillCount: ledger.rows.filter((r) => r.kind === "SK").length,
  };
}

export function renderLedgerForPrompt(ledger: EvidenceLedger): string {
  if (ledger.rows.length === 0) return "(empty — no verified facts on file yet)";
  return ledger.rows.map((r) => `${r.id}. ${r.text}`).join("\n");
}

/** Stable hash of the ledger's content — busts stage-2's cache when the profile changes. */
export function ledgerHash(ledger: EvidenceLedger): string {
  const raw = ledger.rows.map((r) => `${r.id}:${r.text}`).join("\n");
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}
