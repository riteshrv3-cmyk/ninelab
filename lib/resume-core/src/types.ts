// Shared types for the resume pipeline, PDF engine, and preview. Both the API
// server and the frontend import from this package so the ATS score, the
// rendered text, and the persisted content all agree with each other.

export type SectionKey =
  | "summary"
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "certifications"
  | "achievements";

export interface ContactLink {
  label: string; // display text, e.g. "github.com/rahul"
  url: string; // full href, e.g. "https://github.com/rahul"
  kind: "github" | "linkedin" | "portfolio" | "email" | "phone";
}

export interface Bullet {
  text: string;
  /** Ledger IDs (e.g. "PR:2", "EX:1") this bullet traces back to. Empty means
   * the fabrication gate could not verify it and it should not be rendered. */
  evidence: string[];
}

export interface SkillSection {
  category: string;
  items: string[];
  evidence: string[];
}

export interface ExperienceEntry {
  company: string;
  role: string;
  employmentType?: string;
  location?: string;
  start: string; // "Mon YYYY" or "YYYY"
  end: string; // "Mon YYYY" | "Present"
  bullets: Bullet[];
}

export interface ProjectEntry {
  title: string;
  tech: string[];
  link?: string | null;
  bullets: Bullet[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  field?: string;
  location?: string;
  start: string; // "YYYY"
  end: string; // "YYYY" | "Present"
  cgpa?: string | null;
  coursework?: string[];
}

export interface CertificationEntry {
  name: string;
  issuer: string;
  date?: string | null;
  link?: string | null;
}

export interface AchievementEntry {
  text: string;
  evidence: string[];
}

export interface AtsMatchedTerm {
  term: string;
  weight: number;
  where: "skills" | "projects" | "experience" | "summary" | "education" | "certifications" | "achievements";
}

export interface AtsMissingTerm {
  term: string;
  weight: number;
  importance: "must" | "strong" | "nice";
}

export interface AtsReport {
  version: "ats-v1" | "ats-v0-legacy";
  scorePct: number;
  mustCoverage: { matched: number; total: number };
  matched: AtsMatchedTerm[];
  missing: AtsMissingTerm[];
  extractedFrom: "jd" | "tags";
  keywordCount: number;
}

/** Current (v2) shape of a resume's `content` jsonb column. */
export interface ResumeDocument {
  schemaVersion: 2;
  contact: {
    name: string;
    email: string;
    phone?: string | null;
    city?: string | null;
    links: ContactLink[];
  };
  headline: string;
  summary: string;
  order: SectionKey[];
  skillSections: SkillSection[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  achievements: AchievementEntry[];
  atsMeta?: AtsReport | null;
}

// ─── Evidence ledger (deterministic, built before any LLM call) ──────────────

export type LedgerRowKind = "SK" | "GL" | "GR" | "PR" | "EX" | "CE" | "ED" | "CT" | "BI" | "GO" | "UA";

/** A metric the student personally attested to via the quantification coach.
 * Stored on the resume row (quant_facts) and appended to the evidence ledger
 * as a "UA" row so bullets citing it always pass the fabrication gate. */
export interface QuantFact {
  id: string; // "UA:1"
  question: string;
  value: string; // plain number as typed, e.g. "120"
  unit: string; // "users", "%", "hours"
  bulletPath: string; // e.g. "projects[0].bullets[1]"
  answeredAt: string; // ISO timestamp
}

export interface LedgerRow {
  id: string; // e.g. "PR:2"
  kind: LedgerRowKind;
  text: string; // full text serialization for the prompt
}

export interface EvidenceLedger {
  rows: LedgerRow[];
  /** Every technical term appearing anywhere in the ledger's source text, normalized. */
  allowedTerms: Set<string>;
}

// ─── Stage 1: JD analysis ────────────────────────────────────────────────────

export interface HardSkill {
  term: string;
  importance: "must" | "strong" | "nice";
  aliases: string[];
}

export interface JdAnalysis {
  roleTitle: string;
  roleFamily: string;
  seniority: "intern" | "entry" | "mid" | "senior" | "unclear";
  domainContext: string;
  hardSkills: HardSkill[];
  responsibilities: string[];
  successSignals: string[];
  screeningFilters: string[];
  atsVocabulary: string[];
  toneGuidance: string;
  redFlags: string[];
  inferredFrom: "jd" | "tags";
}

// ─── Stage 2: evidence mapping ───────────────────────────────────────────────

export interface CoverageRow {
  jdTerm: string;
  status: "strong" | "partial" | "absent";
  evidenceIds: string[];
  rationale: string;
}

export interface Highlight {
  id: string;
  angle: string;
  quantifiable: string | null;
}

export interface HonestGap {
  term: string;
  whyItMatters: string;
}

export interface EvidenceMap {
  coverage: CoverageRow[];
  thesis: string;
  sectionOrder: SectionKey[];
  highlights: Highlight[];
  deprioritize: string[];
  honestGaps: HonestGap[];
}

// ─── Stage 4: critic ──────────────────────────────────────────────────────────

export interface CriticScores {
  keywordCoverage: number;
  evidenceStrength: number;
  impactLanguage: number;
  parseSafety: number;
  densityFit: number;
  truthfulness: number;
}

export interface CriticViolation {
  axis: string;
  path: string;
  quote: string;
  why: string;
}

export interface CriticPatch {
  path: string;
  value: string;
  reason: string;
}

export interface CriticReport {
  scores: CriticScores;
  overall: number;
  verdict: "ship" | "revise" | "reject";
  violations: CriticViolation[];
  patches: CriticPatch[];
  recruiterSevenSecondRead: string;
  topThreeFixes: string[];
}

// ─── Generation telemetry, persisted alongside content ───────────────────────

export interface StageTelemetry {
  name: "jd" | "map" | "draft" | "critic";
  ms: number;
  cached: boolean;
  ok: boolean;
}

export interface RemovedByGate {
  path: string;
  term: string;
  reason: string;
}

export interface GenerationMeta {
  pipelineVersion: "v2";
  model: string;
  degraded: boolean;
  stages: StageTelemetry[];
  critic: {
    scores: CriticScores;
    overall: number;
    iterations: 1 | 2;
    recruiterSevenSecondRead: string;
    topThreeFixes: string[];
  } | null;
  removedByGate: RemovedByGate[];
  totalMs: number;
  fontFallback?: boolean;
}

// ─── Undo history ─────────────────────────────────────────────────────────────

/** One prior state of a resume's content, pushed by PATCH when snapshot:true. */
export interface ResumeVersion {
  content: ResumeDocument;
  templateId: string;
  atsScore: number | null;
  savedAt: string; // ISO timestamp
}

export const MAX_RESUME_VERSIONS = 5;

// ─── Layout prediction, shared between server-safe estimate and the real engine ─

export interface LayoutEstimate {
  pages: number;
  fillPct: number;
}
