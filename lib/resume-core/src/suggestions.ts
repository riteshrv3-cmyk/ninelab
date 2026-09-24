import type { ResumeDocument } from "./types";

/**
 * The resume as it may be printed or scored: AI-suggested bullets the student
 * hasn't confirmed yet are removed. Everything that leaves review (PDF, DOCX,
 * plain text, quality and ATS scores) goes through this.
 */
export function confirmedOnly(doc: ResumeDocument): ResumeDocument {
  if (!hasSuggestions(doc)) return doc;
  // An entry that exists only because of suggestions disappears with them;
  // one the student wrote themselves stays even if it has no bullets.
  const onlySuggested = (bullets: { suggested?: boolean }[]) => bullets.length > 0 && bullets.every((b) => b.suggested);
  return {
    ...doc,
    experience: doc.experience.filter((e) => !onlySuggested(e.bullets)).map((e) => ({ ...e, bullets: e.bullets.filter((b) => !b.suggested) })),
    projects: doc.projects.filter((p) => !onlySuggested(p.bullets)).map((p) => ({ ...p, bullets: p.bullets.filter((b) => !b.suggested) })),
  };
}

export function countSuggestions(doc: ResumeDocument): number {
  let n = 0;
  for (const e of doc.experience) for (const b of e.bullets) if (b.suggested) n++;
  for (const p of doc.projects) for (const b of p.bullets) if (b.suggested) n++;
  return n;
}

export function hasSuggestions(doc: ResumeDocument): boolean {
  return countSuggestions(doc) > 0;
}
