import type { CoverageRow, EvidenceMap, HardSkill, HonestGap, Highlight, JdAnalysis, SectionKey } from "@workspace/resume-core";

// The model is asked for JSON of a fixed shape, but JSON mode only guarantees
// valid JSON, not the shape. These coerce whatever came back into the shape the
// pipeline indexes into, so a missing array can never throw outside a stage's
// fallback. A result with nothing usable throws instead, which makes callJson
// retry and keeps the bad answer out of the cache.

export class ShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShapeError";
  }
}

const str = (v: unknown, max = 500): string => (typeof v === "string" ? v.slice(0, max) : "");
const strArr = (v: unknown, maxItems = 40): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, maxItems) : [];
const objArr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : [];

const SENIORITY = ["intern", "entry", "mid", "senior", "unclear"] as const;
const IMPORTANCE = ["must", "strong", "nice"] as const;
const SECTIONS: SectionKey[] = ["experience", "projects", "skills", "education", "certifications", "achievements"];

export function normalizeJd(raw: unknown, inferredFrom: JdAnalysis["inferredFrom"]): JdAnalysis {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hardSkills: HardSkill[] = objArr(r.hardSkills)
    .map((h) => ({
      term: str(h.term, 80).trim(),
      importance: (IMPORTANCE as readonly string[]).includes(h.importance as string) ? (h.importance as HardSkill["importance"]) : "strong",
      aliases: strArr(h.aliases, 8),
    }))
    .filter((h) => h.term.length > 0)
    .slice(0, 40);
  const responsibilities = strArr(r.responsibilities, 20);
  if (hardSkills.length === 0 && responsibilities.length === 0) {
    throw new ShapeError("JD analysis had no hardSkills and no responsibilities");
  }
  return {
    roleTitle: str(r.roleTitle, 120),
    roleFamily: str(r.roleFamily, 60) || "General",
    seniority: (SENIORITY as readonly string[]).includes(r.seniority as string) ? (r.seniority as JdAnalysis["seniority"]) : "unclear",
    domainContext: str(r.domainContext, 300),
    hardSkills,
    responsibilities,
    successSignals: strArr(r.successSignals, 20),
    screeningFilters: strArr(r.screeningFilters, 20),
    atsVocabulary: strArr(r.atsVocabulary, 60),
    toneGuidance: str(r.toneGuidance, 300),
    redFlags: strArr(r.redFlags, 10),
    inferredFrom,
  };
}

export function normalizeMap(raw: unknown): EvidenceMap {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const coverage: CoverageRow[] = objArr(r.coverage)
    .map((c) => ({
      jdTerm: str(c.jdTerm, 80),
      status: (["strong", "partial", "absent"] as const).includes(c.status as "strong") ? (c.status as CoverageRow["status"]) : "absent",
      evidenceIds: strArr(c.evidenceIds, 12),
      rationale: str(c.rationale, 200),
    }))
    .filter((c) => c.jdTerm.length > 0);
  const highlights: Highlight[] = objArr(r.highlights)
    .map((h) => ({ id: str(h.id, 20), angle: str(h.angle, 200), quantifiable: typeof h.quantifiable === "string" ? h.quantifiable.slice(0, 120) : null }))
    .filter((h) => h.id.length > 0);
  const honestGaps: HonestGap[] = objArr(r.honestGaps)
    .map((g) => ({ term: str(g.term, 80), whyItMatters: str(g.whyItMatters, 200) }))
    .filter((g) => g.term.length > 0);
  const sectionOrder = strArr(r.sectionOrder, 10).filter((s): s is SectionKey => (SECTIONS as string[]).includes(s));
  if (coverage.length === 0 && highlights.length === 0 && !str(r.thesis)) {
    throw new ShapeError("Evidence map had no coverage, highlights or thesis");
  }
  return {
    coverage,
    thesis: str(r.thesis, 400),
    sectionOrder,
    highlights,
    deprioritize: strArr(r.deprioritize, 40),
    honestGaps,
  };
}

/** Returns an array of plain objects, whatever the model sent for this key. */
export function asObjectArray(v: unknown): Record<string, unknown>[] {
  return objArr(v);
}
