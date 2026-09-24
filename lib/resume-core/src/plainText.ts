import type { ResumeDocument, SectionKey } from "./types";
import { confirmedOnly } from "./suggestions";

/**
 * Renders exactly the visible text the PDF prints, section by section, in the
 * document's own render order. Used for: ATS keyword scoring (never scored
 * against JSON), the fabrication gate's forbidden-term scan, the parse-back
 * verification test, and the preview's visually-hidden accessible text.
 *
 * Anything not printed on the page (evidence IDs, internal metadata) never
 * appears here — that's what makes scoring against this text meaningful.
 */
export function renderPlainText(input: ResumeDocument): string {
  const doc = confirmedOnly(input);
  const lines: string[] = [];

  lines.push(doc.contact.name);
  if (doc.headline) lines.push(doc.headline);
  const contactBits = [doc.contact.email, doc.contact.phone, doc.contact.city, ...doc.contact.links.map((l) => l.label)].filter(Boolean);
  if (contactBits.length) lines.push(contactBits.join(" | "));

  const renderers: Record<SectionKey, () => void> = {
    summary: () => {
      if (doc.summary) lines.push(doc.summary);
    },
    experience: () => {
      for (const e of doc.experience) {
        lines.push(e.role);
        lines.push([e.start, e.end].map((s) => s.trim()).filter(Boolean).join(" - "));
        const org = [e.company, e.employmentType, e.location].filter(Boolean).join(" | ");
        if (org) lines.push(org);
        for (const b of e.bullets) lines.push(b.text);
      }
    },
    projects: () => {
      for (const p of doc.projects) {
        lines.push(p.title);
        if (p.tech.length) lines.push(p.tech.join(", "));
        if (p.link) lines.push(p.link.replace(/^https?:\/\//, ""));
        for (const b of p.bullets) lines.push(b.text);
      }
    },
    skills: () => {
      for (const s of doc.skillSections) {
        lines.push(`${s.category}: ${s.items.join(", ")}`);
      }
    },
    education: () => {
      for (const ed of doc.education) {
        lines.push(ed.degree);
        lines.push([ed.start, ed.end].map((s) => s.trim()).filter(Boolean).join(" - "));
        if (ed.institution) lines.push(ed.institution);
        const sub = [ed.field, ed.cgpa ? `CGPA: ${ed.cgpa}` : null].filter(Boolean).join(" | ");
        if (sub) lines.push(sub);
      }
    },
    certifications: () => {
      for (const c of doc.certifications) {
        lines.push(`${c.name}${c.issuer ? `, ${c.issuer}` : ""}${c.date ? ` (${c.date})` : ""}`);
      }
    },
    achievements: () => {
      for (const a of doc.achievements) lines.push(a.text);
    },
  };

  for (const key of doc.order) {
    renderers[key]?.();
  }

  return lines.filter(Boolean).join("\n");
}
