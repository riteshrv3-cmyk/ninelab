// Number attestation shared by the section-improve and quantification-coach
// acceptance gates. The forbidden-term scan catches invented technologies but
// not invented metrics ("served 10,000 users") — deterministic rule: every
// number token in an AI rewrite must already exist in its allowed sources
// (current text, evidence ledger, user-attested answers). Models may reword
// numbers, never mint them.

// Standalone numbers only, mirroring resume-core's isQuantifiedBullet: a digit
// glued to letters ("S3", "OAuth2", "2FA") or to a colon (evidence IDs like
// "PR:3", "UA:1") is a name fragment, not a numeric claim — on BOTH sides of
// the gate. Excluding them from allowlists stops a model from laundering a
// citation suffix or tech-name digit into a standalone metric; excluding them
// from candidates stops false rejections for merely mentioning S3.
const NUMBER_TOKEN_RE = /(?<![A-Za-z0-9:])\d[\d,.]*(?![A-Za-z])/g;

/** Extracts normalized number tokens ("12,000" → "12000", "10." → "10"). */
export function numberTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.match(NUMBER_TOKEN_RE) ?? []) {
    out.add(m.replace(/[,.]+$/, "").replace(/,/g, ""));
  }
  return out;
}

/** True when `candidate` contains a number token absent from every source. */
export function introducesNewNumbers(candidate: string, allowed: Set<string>): boolean {
  for (const tok of numberTokens(candidate)) {
    if (!allowed.has(tok)) return true;
  }
  return false;
}
