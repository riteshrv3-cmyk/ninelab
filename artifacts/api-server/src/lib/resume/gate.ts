import type { EvidenceLedger, RemovedByGate, ResumeDocument } from "@workspace/resume-core";
import { normTerm, scanClaimedTech } from "@workspace/resume-core";
import { introducesNewNumbers, numberTokens } from "./numbers";

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

/** Drops only the pieces of free prose that claim unsupported tech or a
 * number the ledger never states. */
function keepSupportedParts(parts: string[], ledger: EvidenceLedger): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  const ledgerNumbers = numberTokens(ledger.rows.map((r) => r.text).join(" "));
  for (const p of parts) (suspiciousText(p, ledger) || introducesNewNumbers(p, ledgerNumbers) ? dropped : kept).push(p);
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
    // Metrics are the easiest thing for a model to invent and the hardest for
    // a recruiter to forgive: every number must already be in the rows the
    // bullet cites (user-confirmed coach answers are ledger rows too).
    const citedNumbers = numberTokens(ledger.rows.filter((r) => evidence.includes(r.id)).map((r) => r.text).join(" "));
    if (introducesNewNumbers(text, citedNumbers)) {
      removed.push({ path, term: text.slice(0, 60), reason: suggested ? "suggested bullet contained a number" : "number not present in the cited evidence" });
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

  // An achievement that just restates a certification wastes a line and
  // reads as padding.
  const certNames = doc.certifications.map((c) => normTerm(c.name));
  const achievements = doc.achievements
    .filter((a, ai) => checkBullet(a.text, a.evidence, `achievements[${ai}]`))
    .filter((a) => {
      const t = normTerm(a.text);
      const dup = certNames.some((c) => c.length > 6 && t.includes(c));
      if (dup) removed.push({ path: "achievements", term: a.text.slice(0, 60), reason: "repeats a certification" });
      return !dup;
    });

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

/**
 * Critic patches may only reword. A patched bullet (or summary/headline) that
 * now carries a number or technology the evidence doesn't support is put back
 * to its pre-patch text, so one bad rewrite never costs the original bullet.
 */
export function revertUnsafePatches(before: ResumeDocument, after: ResumeDocument, ledger: EvidenceLedger): { doc: ResumeDocument; reverted: number } {
  let reverted = 0;
  const ledgerNumbers = numberTokens(ledger.rows.map((r) => r.text).join(" "));
  const safeBullet = (oldText: string, newText: string, evidence: string[]) => {
    if (oldText === newText) return newText;
    const allowed = numberTokens(`${oldText} ${ledger.rows.filter((r) => evidence.includes(r.id)).map((r) => r.text).join(" ")}`);
    if (introducesNewNumbers(newText, allowed) || unsupportedTech(newText, ledger).length > 0) {
      reverted++;
      return oldText;
    }
    return newText;
  };
  const safeProse = (oldText: string, newText: string) => {
    if (oldText === newText) return newText;
    if (introducesNewNumbers(newText, new Set([...ledgerNumbers, ...numberTokens(oldText)])) || suspiciousText(newText, ledger)) {
      reverted++;
      return oldText;
    }
    return newText;
  };
  const doc: ResumeDocument = {
    ...after,
    summary: safeProse(before.summary, after.summary),
    headline: safeProse(before.headline, after.headline),
    experience: after.experience.map((e, ei) => ({
      ...e,
      bullets: e.bullets.map((b, bi) => ({ ...b, text: safeBullet(before.experience[ei]?.bullets[bi]?.text ?? b.text, b.text, b.evidence) })),
    })),
    projects: after.projects.map((p, pi) => ({
      ...p,
      bullets: p.bullets.map((b, bi) => ({ ...b, text: safeBullet(before.projects[pi]?.bullets[bi]?.text ?? b.text, b.text, b.evidence) })),
    })),
    achievements: after.achievements.map((a, ai) => ({ ...a, text: safeBullet(before.achievements[ai]?.text ?? a.text, a.text, a.evidence) })),
  };
  return { doc, reverted };
}
