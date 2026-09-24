const FILLER = new Set(["using", "with", "from", "that", "this", "into", "their", "which", "across", "through", "over", "for", "and", "the"]);

// Four-letter prefixes are a crude stem ("issuance"/"issuing", "returns"/
// "returning" collapse), good enough to catch a bullet restated in other words.
const contentStems = (s: string) =>
  new Set((s.toLowerCase().match(/[a-z][a-z0-9.+#]{3,}/g) ?? []).filter((w) => !FILLER.has(w)).map((w) => w.slice(0, 4)));

/** Share of the shorter text's content stems that the other text also uses. */
export function overlap(a: string, b: string): number {
  const A = contentStems(a);
  const B = contentStems(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}
