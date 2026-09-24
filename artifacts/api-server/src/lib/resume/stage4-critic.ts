import type { CriticReport, CriticScores, EvidenceLedger, JdAnalysis, LayoutEstimate, ResumeDocument } from "@workspace/resume-core";
import { renderPlainText } from "@workspace/resume-core";
import { callJson } from "./callJson";
import { renderLedgerForPrompt } from "./ledger";
import { logger } from "../logger";

const SYSTEM_PROMPT = `You are three readers at once, adversarially reviewing a resume draft: an ATS
parser, a recruiter giving it a 7-second skim, and an engineer who will interview this candidate.
Score harshly against the rubrics given — do not be generous. Respond with valid JSON only, no
markdown, no explanation.`;

function buildUserPrompt(opts: { doc: ResumeDocument; jd: JdAnalysis; ledger: EvidenceLedger }): string {
  return `Evidence ledger (the only facts that may appear in the resume):
${renderLedgerForPrompt(opts.ledger)}

Target job: ${opts.jd.roleTitle} (${opts.jd.roleFamily}, ${opts.jd.seniority})
Must-have skills: ${opts.jd.hardSkills.filter((h) => h.importance === "must").map((h) => h.term).join(", ") || "none"}

Resume draft (exactly what will be printed):
"""
${renderPlainText(opts.doc)}
"""

Score each axis 0-100 against these rubrics (deduct, don't just vibe-check):
- evidenceStrength: does every claim read as concrete and specific, or vague/generic? Deduct heavily for filler.
- impactLanguage: strong verbs, no banned openers (Responsible for/Worked on/Helped with), no filler verbs (Utilised/Leveraged/Spearheaded), no self-adjectives (robust/scalable/seamless), no passive voice ("was developed"), no opening verb used more than twice, no spelling mistakes?
- parseSafety: plain text only, no special characters an ATS parser would choke on, standard section vocabulary?
- truthfulness: does ANY claim go beyond what the evidence ledger actually supports — a skill, a number, a scope not present in the ledger? NO PARTIAL CREDIT: if you find even one such claim, this must be 0. Otherwise 100.

Return JSON with this exact structure:
{
  "scores": { "evidenceStrength": 0-100, "impactLanguage": 0-100, "parseSafety": 0-100, "truthfulness": 0-100 },
  "violations": [{ "axis": "which score this affects", "path": "e.g. experience[0].bullets[1]", "quote": "the exact problematic text", "why": "1 short phrase" }],
  "patches": [{ "path": "summary" | "headline" | "experience[i].bullets[j].text" | "projects[i].bullets[j].text" | "skillSections[i].category" | "achievements[i].text", "value": "the full replacement string", "reason": "1 short phrase" }],
  "recruiterSevenSecondRead": "1 sentence — what a recruiter would conclude in 7 seconds",
  "topThreeFixes": ["the 3 highest-leverage changes, most important first"]
}

Rules:
- patches may ONLY replace an existing string at one of the allowed paths above — never add a new array entry, never touch a path outside that list.
- Do not invent a fix that would add a technology or claim not in the evidence ledger. You are forbidden from adding a technology to raise coverage.
- If truthfulness is 100, patches should be empty or only stylistic (impact/parse fixes), never fabrication additions.`;
}

interface CriticModelOutput {
  scores: Omit<CriticScores, "keywordCoverage" | "densityFit">;
  violations: CriticReport["violations"];
  patches: CriticReport["patches"];
  recruiterSevenSecondRead: string;
  topThreeFixes: string[];
}

const ALLOWED_PATCH_PATH = /^(summary|headline|experience\[\d+\]\.bullets\[\d+\]\.text|projects\[\d+\]\.bullets\[\d+\]\.text|skillSections\[\d+\]\.category|achievements\[\d+\]\.text)$/;

function densityFitScore(layout: LayoutEstimate): number {
  if (layout.pages > 1) return Math.max(0, 60 - (layout.pages - 1) * 30);
  if (layout.fillPct < 40) return 60; // sparse — readable but thin
  if (layout.fillPct > 100) return 50; // would overflow before the client's fit-pass compresses it
  return 100;
}

function recomputeOverall(scores: CriticScores): number {
  return Math.round(
    scores.truthfulness * 0.3 +
    scores.keywordCoverage * 0.2 +
    scores.evidenceStrength * 0.2 +
    scores.impactLanguage * 0.15 +
    scores.parseSafety * 0.1 +
    scores.densityFit * 0.05,
  );
}

function fallbackReport(keywordCoverage: number, densityFit: number): CriticReport {
  const scores: CriticScores = { keywordCoverage, evidenceStrength: 60, impactLanguage: 60, parseSafety: 80, densityFit, truthfulness: 100 };
  return {
    scores,
    overall: recomputeOverall(scores),
    verdict: "ship",
    violations: [],
    patches: [],
    recruiterSevenSecondRead: "",
    topThreeFixes: [],
  };
}

export interface CritiqueResult {
  report: CriticReport;
  degraded: boolean;
}

/** Stage 4: adversarial critic. Never cached — scores this specific draft. */
export async function critique(opts: {
  doc: ResumeDocument;
  jd: JdAnalysis;
  ledger: EvidenceLedger;
  keywordCoveragePct: number;
  layout: LayoutEstimate;
  signal?: AbortSignal;
}): Promise<CritiqueResult> {
  const densityFit = densityFitScore(opts.layout);

  try {
    const raw = await callJson<CriticModelOutput>({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(opts),
      maxTokens: 1600,
      temperature: 0.2,
      signal: opts.signal,
      stageName: "critic",
    });

    const scores: CriticScores = {
      keywordCoverage: opts.keywordCoveragePct, // copied from the deterministic ATS report, never recounted by the model
      densityFit,
      evidenceStrength: clamp(raw.scores?.evidenceStrength),
      impactLanguage: clamp(raw.scores?.impactLanguage),
      parseSafety: clamp(raw.scores?.parseSafety),
      truthfulness: clamp(raw.scores?.truthfulness),
    };

    const patches = (Array.isArray(raw?.patches) ? raw.patches : [])
      .filter((p) => p && typeof p.path === "string" && ALLOWED_PATCH_PATH.test(p.path) && typeof p.value === "string");
    const overall = recomputeOverall(scores);

    const report: CriticReport = {
      scores,
      overall,
      verdict: overall >= 82 && scores.truthfulness === 100 ? "ship" : overall >= 60 ? "revise" : "reject",
      violations: Array.isArray(raw?.violations) ? raw.violations.filter((v) => v && typeof v === "object") : [],
      patches,
      recruiterSevenSecondRead: typeof raw?.recruiterSevenSecondRead === "string" ? raw.recruiterSevenSecondRead : "",
      topThreeFixes: Array.isArray(raw?.topThreeFixes) ? raw.topThreeFixes.filter((t): t is string => typeof t === "string").slice(0, 3) : [],
    };
    return { report, degraded: false };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    logger.warn({ err }, "resume pipeline: stage 4 (critic) failed, shipping unpatched with a deterministic score");
    return { report: fallbackReport(opts.keywordCoveragePct, densityFit), degraded: true };
  }
}

function clamp(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
}
