import type { EvidenceLedger, RemovedByGate, ResumeDocument } from "@workspace/resume-core";
import { normTerm, scanLexicon } from "@workspace/resume-core";

/** True if `text` names a lexicon technology term the ledger never mentions.
 * Exported for free-prose acceptance checks (section improve's summary/headline
 * path) — bullets should use bulletPassesGate instead. */
export function suspiciousText(text: string, ledger: EvidenceLedger): boolean {
  return scanLexicon(text).some((term) => !ledger.allowedTerms.has(normTerm(term)));
}

/**
 * Single-item version of the fabrication gate — used for one-off rewrites
 * (e.g. the per-bullet AI actions) where there's no full document to
 * re-gate, just one candidate string plus its claimed evidence IDs.
 */
export function bulletPassesGate(text: string, evidence: string[], ledger: EvidenceLedger): boolean {
  const validIds = new Set(ledger.rows.map((r) => r.id));
  const hasValidEvidence = evidence.some((id) => validIds.has(id));
  if (!hasValidEvidence) return false;
  if (suspiciousText(text, ledger)) return false;
  return true;
}

/**
 * The fabrication gate: runs after drafting and after every critic patch.
 * Any bullet/skill-item/achievement with an empty (or fully-unresolvable)
 * evidence array is deleted. Then the forbidden-term scan removes any
 * container whose text uses a term the ledger never mentions. This makes
 * anti-fabrication structural — a container survives only if it is both
 * cited AND doesn't introduce vocabulary the ledger can't support.
 */
export function fabricationGate(doc: ResumeDocument, ledger: EvidenceLedger): { doc: ResumeDocument; removed: RemovedByGate[] } {
  const validIds = new Set(ledger.rows.map((r) => r.id));
  const removed: RemovedByGate[] = [];

  const hasValidEvidence = (evidence: string[]) => evidence.some((id) => validIds.has(id));

  const experience = doc.experience
    .map((e, ei) => ({
      ...e,
      bullets: e.bullets.filter((b) => {
        const ok = hasValidEvidence(b.evidence);
        if (!ok) removed.push({ path: `experience[${ei}].bullets`, term: b.text.slice(0, 60), reason: "no valid evidence citation" });
        return ok;
      }),
    }))
    .filter((e) => e.bullets.length > 0);

  const projects = doc.projects
    .map((p, pi) => ({
      ...p,
      bullets: p.bullets.filter((b) => {
        const ok = hasValidEvidence(b.evidence);
        if (!ok) removed.push({ path: `projects[${pi}].bullets`, term: b.text.slice(0, 60), reason: "no valid evidence citation" });
        return ok;
      }),
    }))
    .filter((p) => p.bullets.length > 0);

  const skillSections = doc.skillSections
    .filter((s) => {
      const ok = hasValidEvidence(s.evidence) || s.items.length > 0; // deterministically-copied skill items (no LLM evidence) are pre-validated by stage3's ledger allowlist
      if (!ok) removed.push({ path: "skillSections", term: s.category, reason: "no valid evidence citation" });
      return ok;
    });

  const achievements = doc.achievements.filter((a) => {
    const ok = hasValidEvidence(a.evidence);
    if (!ok) removed.push({ path: "achievements", term: a.text.slice(0, 60), reason: "no valid evidence citation" });
    return ok;
  });

  let gated: ResumeDocument = { ...doc, experience, projects, skillSections, achievements };

  // Forbidden-term scan: summary/headline are free prose (not per-word cited
  // like bullets), so this is the one place an invented technology name could
  // slip through. Scan for known tech terms and strip the field back to empty
  // if it names one the ledger never mentions — free text is otherwise
  // impossible to cite word-for-word, so removal is the safe default.
  if (gated.summary && suspiciousText(gated.summary, ledger)) {
    removed.push({ path: "summary", term: gated.summary.slice(0, 60), reason: "names a technology not present in the evidence ledger" });
    gated = { ...gated, summary: "" };
  }
  if (gated.headline && suspiciousText(gated.headline, ledger)) {
    removed.push({ path: "headline", term: gated.headline.slice(0, 60), reason: "names a technology not present in the evidence ledger" });
    gated = { ...gated, headline: "" };
  }

  return { doc: gated, removed };
}
