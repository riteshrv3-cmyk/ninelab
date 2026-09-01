// Mechanical fixes for rule failures that need no AI and no judgment call:
// punctuation, date formats, tech-name casing, whitespace, duplicate skills,
// link labels, section order. Pure and idempotent — running it twice returns
// zero applied fixes the second time (unit-tested), so the UI can offer a
// one-tap "Fix formatting" without fear of drift.

import { normalizeDate } from "./dates";
import { CANONICAL_CASE } from "./lexicon";
import { normTerm } from "./normalize";
import { shortenUrl } from "./upgrade";
import type { ResumeDocument, SectionKey } from "./types";

export { normalizeDate } from "./dates";

export interface AppliedFix {
  ruleId: string;
  path: string;
  before: string;
  after: string;
}

// Everything outside printable ASCII + en/em-dash + curly quotes + bullet is
// stripped (matches quality.ts ATS-03's safe class exactly).
const ATS_UNSAFE_CHAR = /[^\x20-\x7E–—‘’“”•\n\r\t]/gu;

function cleanWhitespace(s: string): string {
  return s.replace(/\s{2,}/g, " ").trim();
}

function recase(s: string): string {
  let out = s;
  for (const [key, display] of Object.entries(CANONICAL_CASE)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "gi");
    out = out.replace(re, display);
  }
  return out;
}

function isSectionEmpty(doc: ResumeDocument, key: SectionKey): boolean {
  switch (key) {
    case "summary": return !doc.summary.trim();
    case "experience": return doc.experience.length === 0;
    case "projects": return doc.projects.length === 0;
    case "skills": return doc.skillSections.length === 0;
    case "education": return doc.education.length === 0;
    case "certifications": return doc.certifications.length === 0;
    case "achievements": return doc.achievements.length === 0;
  }
}

export function applyAutoFixes(input: ResumeDocument): { doc: ResumeDocument; applied: AppliedFix[] } {
  const doc: ResumeDocument = JSON.parse(JSON.stringify(input));
  const applied: AppliedFix[] = [];

  const record = (ruleId: string, path: string, before: string, after: string): boolean => {
    if (before === after) return false;
    applied.push({ ruleId, path, before, after });
    return true;
  };

  type FieldRef = { get: () => string; set: (v: string) => void; path: string; isBullet: boolean };
  const fields: FieldRef[] = [];

  fields.push({ get: () => doc.summary, set: (v) => { doc.summary = v; }, path: "summary", isBullet: false });
  fields.push({ get: () => doc.headline, set: (v) => { doc.headline = v; }, path: "headline", isBullet: false });
  doc.experience.forEach((e, ei) => {
    e.bullets.forEach((b, bi) => {
      fields.push({ get: () => b.text, set: (v) => { b.text = v; }, path: `experience[${ei}].bullets[${bi}]`, isBullet: true });
    });
  });
  doc.projects.forEach((p, pi) => {
    p.bullets.forEach((b, bi) => {
      fields.push({ get: () => b.text, set: (v) => { b.text = v; }, path: `projects[${pi}].bullets[${bi}]`, isBullet: true });
    });
    p.tech.forEach((_, ti) => {
      fields.push({ get: () => p.tech[ti], set: (v) => { p.tech[ti] = v; }, path: `projects[${pi}].tech[${ti}]`, isBullet: false });
    });
  });
  doc.skillSections.forEach((s, si) => {
    s.items.forEach((_, ii) => {
      fields.push({ get: () => s.items[ii], set: (v) => { s.items[ii] = v; }, path: `skillSections[${si}].items[${ii}]`, isBullet: false });
    });
  });
  doc.achievements.forEach((a, ai) => {
    fields.push({ get: () => a.text, set: (v) => { a.text = v; }, path: `achievements[${ai}]`, isBullet: false });
  });

  // 1. STY-07: whitespace.
  for (const f of fields) {
    const after = cleanWhitespace(f.get());
    if (record("STY-07", f.path, f.get(), after)) f.set(after);
  }

  // 2. ATS-06: tabs/pipes inside bullets.
  for (const f of fields.filter((x) => x.isBullet)) {
    const after = cleanWhitespace(f.get().replace(/\t/g, " ").replace(/\s*\|\s*/g, ", "));
    if (record("ATS-06", f.path, f.get(), after)) f.set(after);
  }

  // 3. ATS-03: strip parser-hostile characters (contact.name deliberately untouched).
  for (const f of fields) {
    const after = cleanWhitespace(f.get().replace(ATS_UNSAFE_CHAR, ""));
    if (record("ATS-03", f.path, f.get(), after)) f.set(after);
  }

  // 4. STY-02: bullet end punctuation — convention is no trailing period.
  //    Multi-sentence bullets (interior ". ") are left alone.
  for (const f of fields.filter((x) => x.isBullet)) {
    const text = f.get();
    if (text.endsWith(".") && !text.slice(0, -1).includes(". ")) {
      const after = text.slice(0, -1);
      if (record("STY-02", f.path, text, after)) f.set(after);
    }
  }

  // 5. STY-03: date format normalization.
  doc.experience.forEach((e, ei) => {
    const ns = normalizeDate(e.start);
    if (record("STY-03", `experience[${ei}].start`, e.start, ns)) e.start = ns;
    const ne = normalizeDate(e.end);
    if (record("STY-03", `experience[${ei}].end`, e.end, ne)) e.end = ne;
  });

  // 6. STY-04: canonical tech casing — only mapped terms, never anything else.
  for (const f of fields) {
    const after = recase(f.get());
    if (record("STY-04", f.path, f.get(), after)) f.set(after);
  }

  // 7. STY-08: dedupe skills (first occurrence wins), drop emptied sections.
  {
    const seen = new Set<string>();
    let changed = false;
    for (const s of doc.skillSections) {
      const kept: string[] = [];
      for (const item of s.items) {
        const norm = normTerm(item);
        if (seen.has(norm)) {
          applied.push({ ruleId: "STY-08", path: "skillSections", before: item, after: "" });
          changed = true;
        } else {
          seen.add(norm);
          kept.push(item);
        }
      }
      s.items = kept;
    }
    if (changed) {
      doc.skillSections = doc.skillSections.filter((s) => s.items.length > 0);
    }
  }

  // 8. CMP-03: Indian phone reformat.
  if (doc.contact.phone) {
    const digits = doc.contact.phone.replace(/\D/g, "");
    const m = digits.match(/^(91)?([6-9]\d{9})$/);
    if (m) {
      const ten = m[2];
      const after = `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
      if (record("CMP-03", "contact.phone", doc.contact.phone, after)) doc.contact.phone = after;
    }
  }

  // 9. ATS-05: recompute link labels via the shared shortenUrl convention.
  doc.contact.links.forEach((l, i) => {
    const after = shortenUrl(l.url);
    if (record("ATS-05", `contact.links[${i}].label`, l.label, after)) l.label = after;
  });

  // 10. ATS-02 + ATS-01: order repair, then student-friendly reorder.
  {
    const before = doc.order.join(",");
    const seen = new Set<SectionKey>();
    let order = doc.order.filter((k) => {
      if (seen.has(k) || isSectionEmpty(doc, k)) return false;
      seen.add(k);
      return true;
    });
    const allKeys: SectionKey[] = ["summary", "experience", "projects", "skills", "education", "certifications", "achievements"];
    for (const k of allKeys) {
      if (!isSectionEmpty(doc, k) && !seen.has(k)) order.push(k);
    }
    // summary first
    if (order.includes("summary")) {
      order = ["summary", ...order.filter((k) => k !== "summary")];
    }
    // experience before projects
    const ei = order.indexOf("experience");
    const pi = order.indexOf("projects");
    if (ei !== -1 && pi !== -1 && ei > pi) {
      order.splice(ei, 1);
      order.splice(order.indexOf("projects"), 0, "experience");
    }
    // education within the top 4 slots
    const di = order.indexOf("education");
    if (di > 3) {
      order.splice(di, 1);
      order.splice(3, 0, "education");
    }
    const after = order.join(",");
    if (before !== after) {
      applied.push({ ruleId: "ATS-01", path: "order", before, after });
      doc.order = order;
    }
  }

  return { doc, applied };
}
