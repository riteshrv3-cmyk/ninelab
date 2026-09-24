import type { AtsMatchedTerm, AtsMissingTerm, AtsReport, HardSkill, JdAnalysis, ResumeDocument, SectionKey } from "./types";
import { normTerm, termVariants, tokenizeToNgrams } from "./normalize";
import { scanLexicon } from "./lexicon";
import { renderPlainText } from "./plainText";

const IMPORTANCE_WEIGHT: Record<HardSkill["importance"], number> = {
  must: 3,
  strong: 2,
  nice: 1,
};

interface WeightedTerm {
  term: string;
  weight: number;
  importance: HardSkill["importance"];
}

/**
 * Deterministic keyword extraction from three unioned sources: the JD
 * analysis's own graded hard skills (if available), a lexicon scan of the
 * raw JD text (catches anything stage 1 missed), and — when there is no JD
 * text at all — a lexicon scan of the role/tags. This never asks an LLM to
 * self-report its own keyword list; the report can only claim terms that are
 * verifiably present in the input.
 */
export function extractJdKeywords(opts: { jdAnalysis?: JdAnalysis | null; jdText?: string; jobTags?: string[] }): WeightedTerm[] {
  const seen = new Map<string, WeightedTerm>();

  const add = (term: string, importance: HardSkill["importance"]) => {
    const key = normTerm(term);
    if (!key) return;
    const existing = seen.get(key);
    const weight = IMPORTANCE_WEIGHT[importance];
    if (!existing || weight > existing.weight) {
      seen.set(key, { term: key, weight, importance });
    }
  };

  if (opts.jdAnalysis) {
    for (const hs of opts.jdAnalysis.hardSkills) {
      add(hs.term, hs.importance);
      for (const alias of hs.aliases) add(alias, hs.importance);
    }
  }

  const scanText = opts.jdText ?? (opts.jobTags ?? []).join(" ");
  if (scanText) {
    for (const term of scanLexicon(scanText)) {
      add(term, "strong");
    }
  }

  return [...seen.values()];
}

/**
 * Exact set-membership matching on normalized n-grams of the resume's
 * rendered plain text — never a substring test, never against a JSON blob.
 * This is what makes "C" not match "Scala", and "summary"/"experience" not
 * match JSON key names (they're never serialized to JSON here at all).
 */
export function scoreCoverage(
  doc: ResumeDocument,
  keywords: WeightedTerm[],
): { matched: AtsMatchedTerm[]; missing: AtsMissingTerm[] } {
  const sectionText: Partial<Record<SectionKey, Set<string>>> = {};
  for (const key of doc.order) {
    sectionText[key] = tokenizeToNgrams(sectionOnlyText(doc, key));
  }
  const fullHaystack = tokenizeToNgrams(renderPlainText(doc));

  const matched: AtsMatchedTerm[] = [];
  const missing: AtsMissingTerm[] = [];

  const has = (set: Set<string>, term: string) => termVariants(term).some((v) => set.has(v));

  for (const kw of keywords) {
    if (!has(fullHaystack, kw.term)) {
      missing.push({ term: kw.term, weight: kw.weight, importance: kw.importance });
      continue;
    }
    let where: AtsMatchedTerm["where"] = "summary";
    for (const [key, set] of Object.entries(sectionText) as [SectionKey, Set<string>][]) {
      if (has(set, kw.term)) {
        where = key as AtsMatchedTerm["where"];
        break;
      }
    }
    matched.push({ term: kw.term, weight: kw.weight, where });
  }

  return { matched, missing };
}

function sectionOnlyText(doc: ResumeDocument, key: SectionKey): string {
  const single: ResumeDocument = { ...doc, order: [key] };
  return renderPlainText(single);
}

export function buildAtsReport(opts: {
  doc: ResumeDocument;
  jdAnalysis?: JdAnalysis | null;
  jdText?: string;
  jobTags?: string[];
}): AtsReport | null {
  const hasSignal = Boolean(opts.jdAnalysis || opts.jdText || (opts.jobTags && opts.jobTags.length > 0));
  if (!hasSignal) return null;

  const keywords = extractJdKeywords(opts);
  if (keywords.length === 0) return null;

  const { matched, missing } = scoreCoverage(opts.doc, keywords);

  const totalWeight = keywords.reduce((sum, k) => sum + k.weight, 0);
  const matchedWeight = matched.reduce((sum, m) => sum + m.weight, 0);
  const scorePct = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  const mustTotal = keywords.filter((k) => k.importance === "must").length;
  const mustMatched = matched.filter((m) => keywords.find((k) => k.term === m.term)?.importance === "must").length;

  return {
    version: "ats-v1",
    scorePct,
    mustCoverage: { matched: mustMatched, total: mustTotal },
    matched,
    missing,
    extractedFrom: opts.jdText ? "jd" : "tags",
    keywordCount: keywords.length,
  };
}
