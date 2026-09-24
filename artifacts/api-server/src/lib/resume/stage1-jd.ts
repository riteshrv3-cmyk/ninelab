import type { JdAnalysis } from "@workspace/resume-core";
import { scanLexicon } from "@workspace/resume-core";
import { cacheGetOrSet } from "../aiCache";
import { callJson } from "./callJson";
import { logger } from "../logger";
import { normalizeJd } from "./shapes";

const SYSTEM_PROMPT = `You are a senior technical recruiter analyzing a job posting for an Indian
engineering student's placement season. Extract a machine-usable target spec — respond with
valid JSON only, no markdown, no explanation.`;

function buildUserPrompt(jdText: string, roleTitle: string, jobTags: string[]): string {
  const source = jdText || `Role: ${roleTitle}\nTags: ${jobTags.join(", ")}`;
  return `Job posting / target role:
"""
${source}
"""

Return JSON with this exact structure:
{
  "roleTitle": "normalized role title",
  "roleFamily": "e.g. Backend, Frontend, Full Stack, Data/ML, DevOps, Mobile, QA",
  "seniority": "intern" | "entry" | "mid" | "senior" | "unclear",
  "domainContext": "1 sentence — what the company/team actually does",
  "hardSkills": [{ "term": "exact skill/tech name as written", "importance": "must"|"strong"|"nice", "aliases": ["common alternate spellings/names"] }],
  "responsibilities": ["what the role actually does day to day"],
  "successSignals": ["what a strong candidate for this role demonstrates"],
  "screeningFilters": ["hard requirements that would filter out a candidate, e.g. CGPA cutoff, specific degree"],
  "atsVocabulary": ["exact phrases/keywords an ATS parser would scan for from this posting"],
  "toneGuidance": "1 sentence on the register — formal/startup/technical-heavy/etc",
  "redFlags": ["anything suspicious or unusually vague about this posting, [] if none"]
}

Rules:
- hardSkills: every specific technology, language, framework or tool named, graded by how central it is to the role. must = explicitly required, strong = clearly important, nice = mentioned as a bonus
- Do not invent skills the posting doesn't mention
- If the input is just a role title and tags (no full JD), infer conservatively from the tags only`;
}

function fallbackAnalysis(jdText: string, roleTitle: string, jobTags: string[]): JdAnalysis {
  const source = jdText || jobTags.join(" ");
  const terms = scanLexicon(source);
  return {
    roleTitle: roleTitle || "Software Engineer",
    roleFamily: "General",
    seniority: "unclear",
    domainContext: "",
    hardSkills: terms.map((term) => ({ term, importance: "strong" as const, aliases: [] })),
    responsibilities: [],
    successSignals: [],
    screeningFilters: [],
    atsVocabulary: terms,
    toneGuidance: "",
    redFlags: [],
    inferredFrom: jdText ? "jd" : "tags",
  };
}

export interface AnalyzeJdResult {
  analysis: JdAnalysis;
  cached: boolean;
  degraded: boolean;
}

/**
 * Stage 1: JD analysis. Cached 30 days, student-independent — the same
 * posting analyzed once serves every student who applies to it.
 */
export async function analyzeJd(opts: { jdText?: string; roleTitle?: string; jobTags?: string[]; signal?: AbortSignal }): Promise<AnalyzeJdResult> {
  const jdText = (opts.jdText ?? "").trim();
  const roleTitle = (opts.roleTitle ?? "").trim();
  const jobTags = opts.jobTags ?? [];

  if (!jdText && !roleTitle && jobTags.length === 0) {
    return { analysis: fallbackAnalysis("", "", []), cached: false, degraded: true };
  }

  try {
    const { value, cached } = await cacheGetOrSet<JdAnalysis>(
      { namespace: "resume-jd-v2", keyParts: [jdText, roleTitle, jobTags], ttlSeconds: 30 * 24 * 60 * 60 },
      () =>
        callJson<JdAnalysis>({
          system: SYSTEM_PROMPT,
          user: buildUserPrompt(jdText, roleTitle, jobTags),
          maxTokens: 1400,
          temperature: 0.15,
          signal: opts.signal,
          stageName: "jd",
          shape: (raw) => normalizeJd(raw, jdText ? "jd" : "tags"),
        }),
    );
    // Re-normalize on read too: a row written by an older build may predate
    // the shape check.
    return { analysis: normalizeJd(value, jdText ? "jd" : "tags"), cached, degraded: false };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    logger.warn({ err }, "resume pipeline: stage 1 (JD analysis) failed, using lexicon fallback");
    return { analysis: fallbackAnalysis(jdText, roleTitle, jobTags), cached: false, degraded: true };
  }
}
