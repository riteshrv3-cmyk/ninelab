// Shared types for the resume feature — extracted from the old monolithic
// pages/Resume.tsx so the page shell, the sheets, and the ReviewFlow all agree.

// Raw shape of the `content` jsonb column as read from the API — a union of
// the legacy v1 flat shape and the pipeline/editor v2 shape (see
// upgradeContent() in @workspace/resume-core for the authoritative
// normalizer). Always run content through upgradeContent before rendering or
// editing; this loose type only documents what may show up.
type LooseBullet = string | { text: string };
export interface ResumeContent {
  // v1 flat fields
  name?: string;
  email?: string;
  phone?: string | null;
  city?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  degree?: string;
  college?: string;
  startYear?: number;
  gradYear?: number;
  cgpa?: string | null;
  // v2 fields
  schemaVersion?: number;
  contact?: { name: string; email: string; phone?: string | null; city?: string | null; links?: unknown[] };
  headline?: string;
  order?: string[];
  education?: unknown[];
  // shared
  summary?: string;
  skillSections?: { category: string; items: string | string[] }[];
  experience?: { company: string; role: string; period?: string; start?: string; end?: string; bullets?: LooseBullet[] }[];
  projects?: { title: string; tech: string | string[]; link?: string | null; bullets?: LooseBullet[] }[];
  certifications?: { name: string; issuer: string; date?: string }[];
  achievements?: LooseBullet[];
  atsMeta?: unknown;
}

export function toCommaString(v: string | string[] | undefined | null): string {
  return Array.isArray(v) ? v.join(", ") : v ?? "";
}

export function toBulletString(b: LooseBullet): string {
  return typeof b === "string" ? b : b.text;
}

/** No skills, projects, or experience at all — the "Not set Engineering"
 * rejection-shaped output that comes from generating off an empty profile. */
export function isContentEmpty(content: ResumeContent): boolean {
  const hasSkills = (content.skillSections ?? []).some(s => toCommaString(s.items).trim().length > 0);
  const hasProjects = (content.projects ?? []).length > 0;
  const hasExperience = (content.experience ?? []).length > 0;
  return !hasSkills && !hasProjects && !hasExperience;
}

export interface SavedResume {
  id: number;
  studentId: number;
  name: string;
  templateId: string;
  jdText?: string | null;
  companyName?: string | null;
  content: ResumeContent;
  createdAt: string;
  evidenceMap?: { thesis?: string; honestGaps?: { term: string; whyItMatters: string }[]; coverage?: { jdTerm: string; status: string }[] } | null;
  generation?: { degraded?: boolean } | null;
  atsReport?: { scorePct: number; matched: { term: string; where: string }[]; missing: { term: string; importance: string }[] } | null;
  qualityScore?: number | null;
  aiReview?: unknown;
  quantFacts?: unknown[];
  shareSlug?: string | null;
  shareViews?: number | null;
  versions?: { content: ResumeContent; templateId: string; atsScore: number | null; savedAt: string }[] | null;
}
