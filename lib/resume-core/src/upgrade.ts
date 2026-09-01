import type {
  AchievementEntry,
  AtsReport,
  Bullet,
  CertificationEntry,
  ContactLink,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  ResumeDocument,
  SectionKey,
  SkillSection,
} from "./types";

const DEFAULT_ORDER: SectionKey[] = ["summary", "education", "skills", "experience", "projects", "certifications", "achievements"];

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function toBullets(v: unknown): Bullet[] {
  // v1 bullets were plain strings; v2 bullets are {text, evidence}. Accept both.
  return arr(v).map((b): Bullet | null => {
    if (typeof b === "string") return { text: b, evidence: [] };
    if (b && typeof b === "object" && typeof (b as { text?: unknown }).text === "string") {
      const obj = b as { text: string; evidence?: unknown };
      return { text: obj.text, evidence: Array.isArray(obj.evidence) ? obj.evidence.filter((e) => typeof e === "string") : [] };
    }
    return null;
  }).filter((b): b is Bullet => b !== null);
}

function toContactLinks(v1: Record<string, unknown>): ContactLink[] {
  const links: ContactLink[] = [];
  const github = strOrNull(v1.githubUrl);
  const linkedin = strOrNull(v1.linkedinUrl);
  const portfolio = strOrNull(v1.portfolioUrl);
  if (github) links.push({ label: shortenUrl(github), url: github, kind: "github" });
  if (linkedin) links.push({ label: shortenUrl(linkedin), url: linkedin, kind: "linkedin" });
  if (portfolio) links.push({ label: shortenUrl(portfolio), url: portfolio, kind: "portfolio" });
  return links;
}

export function shortenUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function toSkillSections(v: unknown): SkillSection[] {
  return arr(v).map((s): SkillSection | null => {
    if (!s || typeof s !== "object") return null;
    const obj = s as { category?: unknown; items?: unknown; evidence?: unknown };
    const category = str(obj.category);
    if (!category) return null;
    // v1 `items` was a comma-joined string; v2 is already a string[].
    const items = typeof obj.items === "string"
      ? obj.items.split(",").map((i) => i.trim()).filter(Boolean)
      : arr(obj.items).filter((i): i is string => typeof i === "string");
    return { category, items, evidence: Array.isArray(obj.evidence) ? obj.evidence.filter((e) => typeof e === "string") : [] };
  }).filter((s): s is SkillSection => s !== null);
}

function toExperience(v: unknown): ExperienceEntry[] {
  return arr(v).map((e): ExperienceEntry | null => {
    if (!e || typeof e !== "object") return null;
    const obj = e as Record<string, unknown>;
    const company = str(obj.company);
    const role = str(obj.role);
    if (!company && !role) return null;
    // v1 had a single "period" string like "Jun 2024 - Aug 2024"; v2 has start/end.
    let start = str(obj.start);
    let end = str(obj.end);
    if (!start && typeof obj.period === "string") {
      const parts = obj.period.split(/[-–—]/).map((p) => p.trim());
      start = parts[0] ?? "";
      end = parts[1] ?? "";
    }
    return {
      company,
      role,
      employmentType: strOrNull(obj.employmentType) ?? undefined,
      location: strOrNull(obj.location) ?? undefined,
      start,
      end,
      bullets: toBullets(obj.bullets),
    };
  }).filter((e): e is ExperienceEntry => e !== null);
}

function toProjects(v: unknown): ProjectEntry[] {
  return arr(v).map((p): ProjectEntry | null => {
    if (!p || typeof p !== "object") return null;
    const obj = p as Record<string, unknown>;
    const title = str(obj.title);
    if (!title) return null;
    // v1 `tech` was a free-text string; v2 is a string[].
    const tech = typeof obj.tech === "string"
      ? obj.tech.split(",").map((t) => t.trim()).filter(Boolean)
      : arr(obj.tech).filter((t): t is string => typeof t === "string");
    return {
      title,
      tech,
      link: strOrNull(obj.link),
      bullets: toBullets(obj.bullets),
    };
  }).filter((p): p is ProjectEntry => p !== null);
}

function toEducation(v1: Record<string, unknown>): EducationEntry[] {
  // v2 rows, if already present, win.
  if (Array.isArray(v1.education) && v1.education.length > 0) {
    return v1.education.map((e): EducationEntry | null => {
      if (!e || typeof e !== "object") return null;
      const obj = e as Record<string, unknown>;
      const degree = str(obj.degree);
      const institution = str(obj.institution);
      if (!degree && !institution) return null;
      return {
        degree,
        institution,
        field: strOrNull(obj.field) ?? undefined,
        location: strOrNull(obj.location) ?? undefined,
        start: str(obj.start),
        end: str(obj.end),
        cgpa: strOrNull(obj.cgpa),
        coursework: arr(obj.coursework).filter((c): c is string => typeof c === "string"),
      };
    }).filter((e): e is EducationEntry => e !== null);
  }

  // v1 only had flat degree/college/startYear/gradYear/cgpa on the document root.
  const degree = str(v1.degree);
  const college = str(v1.college);
  if (!degree && !college) return [];
  return [{
    degree,
    institution: college,
    start: v1.startYear != null ? String(v1.startYear) : "",
    end: v1.gradYear != null ? String(v1.gradYear) : "",
    cgpa: strOrNull(v1.cgpa),
  }];
}

function toCertifications(v: unknown): CertificationEntry[] {
  return arr(v).map((c): CertificationEntry | null => {
    if (!c || typeof c !== "object") return null;
    const obj = c as Record<string, unknown>;
    const name = str(obj.name);
    if (!name) return null;
    return {
      name,
      issuer: str(obj.issuer),
      date: strOrNull(obj.date),
      link: strOrNull(obj.link),
    };
  }).filter((c): c is CertificationEntry => c !== null);
}

function toAchievements(v: unknown): AchievementEntry[] {
  return arr(v).map((a): AchievementEntry | null => {
    if (typeof a === "string") return { text: a, evidence: [] };
    if (a && typeof a === "object" && typeof (a as { text?: unknown }).text === "string") {
      const obj = a as { text: string; evidence?: unknown };
      return { text: obj.text, evidence: Array.isArray(obj.evidence) ? obj.evidence.filter((e) => typeof e === "string") : [] };
    }
    return null;
  }).filter((a): a is AchievementEntry => a !== null);
}

function toLegacyAtsReport(v1: Record<string, unknown>): AtsReport | null {
  const meta = v1.atsMeta;
  if (!meta || typeof meta !== "object") return null;
  const obj = meta as { jdKeywords?: unknown; matched?: unknown; coveragePct?: unknown };
  const jdKeywords = arr(obj.jdKeywords).filter((k): k is string => typeof k === "string");
  const matchedTerms = new Set(arr(obj.matched).filter((k): k is string => typeof k === "string"));
  if (jdKeywords.length === 0) return null;
  return {
    version: "ats-v0-legacy",
    scorePct: typeof obj.coveragePct === "number" ? obj.coveragePct : 0,
    mustCoverage: { matched: 0, total: 0 },
    matched: jdKeywords.filter((k) => matchedTerms.has(k)).map((term) => ({ term, weight: 1, where: "summary" as const })),
    missing: jdKeywords.filter((k) => !matchedTerms.has(k)).map((term) => ({ term, weight: 1, importance: "strong" as const })),
    extractedFrom: "jd",
    keywordCount: jdKeywords.length,
  };
}

/**
 * Upgrades any persisted `content` blob (v1's flat shape, or an already-v2
 * document, or something malformed/partial) to the current ResumeDocument
 * shape. Pure, read-time, defensive — never throws, so an old or partial row
 * always renders something rather than 500ing.
 */
export function upgradeContent(raw: unknown): ResumeDocument {
  const v1 = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  if (v1.schemaVersion === 2 && v1.contact) {
    // Already v2 — still run through the same defensive coercion in case a
    // partial write slipped through (e.g. an interrupted PATCH).
    const contact = v1.contact as Record<string, unknown>;
    return {
      schemaVersion: 2,
      contact: {
        name: str(contact.name),
        email: str(contact.email),
        phone: strOrNull(contact.phone),
        city: strOrNull(contact.city),
        links: arr(contact.links).filter((l): l is ContactLink => Boolean(l && typeof l === "object")),
      },
      headline: str(v1.headline),
      summary: str(v1.summary),
      order: (arr(v1.order).filter((o): o is SectionKey => typeof o === "string") as SectionKey[]).length > 0
        ? (v1.order as SectionKey[])
        : DEFAULT_ORDER,
      skillSections: toSkillSections(v1.skillSections),
      experience: toExperience(v1.experience),
      projects: toProjects(v1.projects),
      education: toEducation(v1),
      certifications: toCertifications(v1.certifications),
      achievements: toAchievements(v1.achievements),
      atsMeta: (v1.atsMeta as AtsReport | null) ?? null,
    };
  }

  return {
    schemaVersion: 2,
    contact: {
      name: str(v1.name),
      email: str(v1.email),
      phone: strOrNull(v1.phone),
      city: strOrNull(v1.city),
      links: toContactLinks(v1),
    },
    headline: "",
    summary: str(v1.summary),
    order: DEFAULT_ORDER,
    skillSections: toSkillSections(v1.skillSections),
    experience: toExperience(v1.experience),
    projects: toProjects(v1.projects),
    education: toEducation(v1),
    certifications: toCertifications(v1.certifications),
    achievements: toAchievements(v1.achievements),
    atsMeta: toLegacyAtsReport(v1),
  };
}
