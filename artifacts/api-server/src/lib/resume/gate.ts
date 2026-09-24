import type { EvidenceLedger, RemovedByGate, ResumeDocument } from "@workspace/resume-core";
import { normTerm, scanClaimedTech } from "@workspace/resume-core";

/** Specific technologies `text` names that the ledger never mentions. */
export function unsupportedTech(text: string, ledger: EvidenceLedger): string[] {
  return scanClaimedTech(text).filter((term) => !ledger.allowedTerms.has(normTerm(term)));
}

/** True if `text` names a technology the ledger never mentions. Everyday
 * words that double as tech names ("go live", "render", "security") and
 * general practices don't count. */
export function suspiciousText(text: string, ledger: EvidenceLedger): boolean {
  return unsupportedTech(text, ledger).length > 0;
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

/** Drops only the pieces of free prose that claim unsupported tech. */
function keepSupportedParts(parts: string[], ledger: EvidenceLedger): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const p of parts) (suspiciousText(p, ledger) ? dropped : kept).push(p);
  return { kept, dropped };
}

/**
 * The fabrication gate: runs after drafting and after every critic patch.
 * A bullet or achievement survives only if it cites a real ledger row AND
 * names no technology the ledger can't support. Free prose (summary,
 * headline) can't be cited word by word, so only the sentence or segment
 * that makes an unsupported tech claim is removed, not the whole field.
 */
export function fabricationGate(doc: ResumeDocument, ledger: EvidenceLedger): { doc: ResumeDocument; removed: RemovedByGate[] } {
  const validIds = new Set(ledger.rows.map((r) => r.id));
  const removed: RemovedByGate[] = [];

  const hasValidEvidence = (evidence: string[]) => evidence.some((id) => validIds.has(id));
  const checkBullet = (text: string, evidence: string[], path: string, suggested = false): boolean => {
    // A suggestion is a draft the student must confirm, but it still may not
    // invent a number: metrics come only from the student (quant coach).
    if (suggested && /\d/.test(text)) {
      removed.push({ path, term: text.slice(0, 60), reason: "suggested bullet contained a number" });
      return false;
    }
    if (!hasValidEvidence(evidence)) {
      removed.push({ path, term: text.slice(0, 60), reason: "no valid evidence citation" });
      return false;
    }
    const invented = unsupportedTech(text, ledger);
    if (invented.length > 0) {
      removed.push({ path, term: invented.join(", "), reason: "names a technology not present in the evidence ledger" });
      return false;
    }
    return true;
  };

  const experience = doc.experience
    .map((e, ei) => ({ ...e, bullets: e.bullets.filter((b) => checkBullet(b.text, b.evidence, `experience[${ei}].bullets`, b.suggested)) }))
    .filter((e) => e.bullets.length > 0);

  const projects = doc.projects
    .map((p, pi) => ({ ...p, bullets: p.bullets.filter((b) => checkBullet(b.text, b.evidence, `projects[${pi}].bullets`, b.suggested)) }))
    .filter((p) => p.bullets.length > 0);

  const skillSections = doc.skillSections
    .filter((s) => {
      const ok = hasValidEvidence(s.evidence) || s.items.length > 0; // deterministically-copied skill items (no LLM evidence) are pre-validated by stage3's ledger allowlist
      if (!ok) removed.push({ path: "skillSections", term: s.category, reason: "no valid evidence citation" });
      return ok;
    });

  const achievements = doc.achievements.filter((a, ai) => checkBullet(a.text, a.evidence, `achievements[${ai}]`));

  let gated: ResumeDocument = { ...doc, experience, projects, skillSections, achievements };

  if (gated.summary) {
    const sentences = gated.summary.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((x) => x.trim()).filter(Boolean) ?? [gated.summary];
    const { kept, dropped } = keepSupportedParts(sentences, ledger);
    if (dropped.length > 0) {
      removed.push({ path: "summary", term: dropped.join(" ").slice(0, 60), reason: "names a technology not present in the evidence ledger" });
      gated = { ...gated, summary: kept.join(" ") };
    }
  }
  if (gated.headline) {
    const segments = gated.headline.split(/\s*\|\s*/);
    const { kept, dropped } = keepSupportedParts(segments, ledger);
    if (dropped.length > 0) {
      removed.push({ path: "headline", term: dropped.join(" | ").slice(0, 60), reason: "names a technology not present in the evidence ledger" });
      gated = { ...gated, headline: kept.join(" | ") };
    }
  }

  return { doc: gated, removed };
}
