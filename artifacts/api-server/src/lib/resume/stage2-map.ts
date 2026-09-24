import type { EvidenceLedger, EvidenceMap, JdAnalysis, SectionKey } from "@workspace/resume-core";
import { cacheGetOrSet } from "../aiCache";
import { callJson } from "./callJson";
import { ledgerHash, renderLedgerForPrompt } from "./ledger";
import { logger } from "../logger";
import { normalizeMap } from "./shapes";

const SYSTEM_PROMPT = `You are planning a resume BEFORE writing it. Decide which of the candidate's
real, verified facts (the evidence ledger) actually answer this job — with citations. Respond
with valid JSON only, no markdown, no explanation.`;

function buildUserPrompt(ledger: EvidenceLedger, jd: JdAnalysis): string {
  return `Evidence ledger (every row is a verified fact; cite by ID, never invent a new ID):
${renderLedgerForPrompt(ledger)}

Target job:
- Role: ${jd.roleTitle} (${jd.roleFamily}, ${jd.seniority})
- Must-have skills: ${jd.hardSkills.filter((h) => h.importance === "must").map((h) => h.term).join(", ") || "none specified"}
- Strong skills: ${jd.hardSkills.filter((h) => h.importance === "strong").map((h) => h.term).join(", ") || "none specified"}
- Responsibilities: ${jd.responsibilities.join("; ") || "not specified"}
- Success signals: ${jd.successSignals.join("; ") || "not specified"}

Return JSON with this exact structure:
{
  "coverage": [{ "jdTerm": "exact term from the job's skill list", "status": "strong"|"partial"|"absent", "evidenceIds": ["ledger IDs that support this, [] if absent"], "rationale": "1 short phrase" }],
  "thesis": "1 sentence — the single strongest honest angle this resume should take for this job",
  "sectionOrder": ["experience","projects","skills","education","certifications","achievements"] in the best order for THIS candidate and THIS job — omit "summary" (always first),
  "highlights": [{ "id": "ledger ID of the single best-fitting piece of evidence", "angle": "why it matters for this job", "quantifiable": "a number/metric from that evidence, or null if none exists" }],
  "deprioritize": ["ledger IDs that are real but weakest fit for this job — candidates for trimming if space is tight"],
  "honestGaps": [{ "term": "a must/strong JD skill the candidate genuinely lacks", "whyItMatters": "1 short phrase" }]
}

Rules:
- coverage: every hardSkill from the job, marked strong only if a ledger row directly demonstrates it, partial if adjacent/related evidence exists, absent otherwise. evidenceIds MUST be real IDs from the ledger above — never invent one.
- Do not mark anything "strong" or "partial" without a real, cited ledger row. A wrong claim here would let a lie into the resume.
- honestGaps: be honest — this is not a place to spin a gap as a strength.`;
}

/** Any coverage claiming strong/partial with unresolvable evidence IDs is forced to absent — the model cannot claim coverage it cannot cite. */
function enforceCitations(map: EvidenceMap, ledger: EvidenceLedger): EvidenceMap {
  const validIds = new Set(ledger.rows.map((r) => r.id));
  const coverage = (map.coverage ?? []).map((row) => {
    const resolvedIds = (row.evidenceIds ?? []).filter((id) => validIds.has(id));
    if (row.status !== "absent" && resolvedIds.length === 0) {
      return { ...row, status: "absent" as const, evidenceIds: [] };
    }
    return { ...row, evidenceIds: resolvedIds };
  });
  const highlights = (map.highlights ?? []).filter((h) => validIds.has(h.id));
  const deprioritize = (map.deprioritize ?? []).filter((id) => validIds.has(id));
  const sectionOrder = (map.sectionOrder ?? []).filter(
    (s): s is SectionKey => s !== "summary" && ["experience", "projects", "skills", "education", "certifications", "achievements"].includes(s),
  );
  return { ...map, coverage, highlights, deprioritize, sectionOrder };
}

function fallbackMap(ledger: EvidenceLedger, jd: JdAnalysis): EvidenceMap {
  const ledgerText = ledger.rows.map((r) => r.text.toLowerCase()).join(" | ");
  const coverage = jd.hardSkills.map((h) => {
    const term = h.term.toLowerCase();
    const row = ledger.rows.find((r) => r.text.toLowerCase().includes(term));
    return {
      jdTerm: h.term,
      status: (row ? "strong" : "absent") as "strong" | "absent",
      evidenceIds: row ? [row.id] : [],
      rationale: row ? "exact-match fallback" : "not found in profile",
    };
  });
  return {
    coverage,
    thesis: "Highlighting the candidate's real, verified experience relevant to this role.",
    sectionOrder: ["experience", "projects", "skills", "education", "certifications", "achievements"],
    highlights: ledger.rows.slice(0, 3).map((r) => ({ id: r.id, angle: "relevant experience", quantifiable: null })),
    deprioritize: [],
    honestGaps: jd.hardSkills
      .filter((h) => h.importance === "must" && !ledgerText.includes(h.term.toLowerCase()))
      .map((h) => ({ term: h.term, whyItMatters: "required by the job posting" })),
  };
}

export interface BuildEvidenceMapResult {
  map: EvidenceMap;
  cached: boolean;
  degraded: boolean;
}

/** Stage 2: evidence mapping. Cached 7 days, keyed on ledgerHash so a profile edit busts it. */
export async function buildEvidenceMap(ledger: EvidenceLedger, jd: JdAnalysis, signal?: AbortSignal): Promise<BuildEvidenceMapResult> {
  try {
    const { value, cached } = await cacheGetOrSet<EvidenceMap>(
      { namespace: "resume-map-v2", keyParts: [ledgerHash(ledger), jd], ttlSeconds: 7 * 24 * 60 * 60 },
      () =>
        callJson<EvidenceMap>({
          system: SYSTEM_PROMPT,
          user: buildUserPrompt(ledger, jd),
          maxTokens: 2000,
          temperature: 0.1,
          signal,
          stageName: "map",
          shape: normalizeMap,
        }),
    );
    return { map: enforceCitations(normalizeMap(value), ledger), cached, degraded: false };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    logger.warn({ err }, "resume pipeline: stage 2 (evidence map) failed, using exact-match fallback");
    return { map: fallbackMap(ledger, jd), cached: false, degraded: true };
  }
}
