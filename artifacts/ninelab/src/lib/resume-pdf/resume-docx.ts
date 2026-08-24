import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  AlignmentType,
  BorderStyle,
  TabStopPosition,
  TabStopType,
} from "docx";
import type { ResumeDocument, SectionKey } from "@workspace/resume-core";
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, "_").replace(/\.+$/, "").slice(0, 80);
}

// Half-points (docx unit for font size)
const PT = (pt: number) => pt * 2;

function name_paragraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [
      new TextRun({ text, bold: true, size: PT(18), font: "Calibri" }),
    ],
  });
}

function contact_paragraph(parts: string[]): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [
      new TextRun({ text: parts.filter(Boolean).join("  |  "), size: PT(10), font: "Calibri" }),
    ],
  });
}

function section_heading(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 40 },
    border: {
      bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 4 },
    },
    children: [
      new TextRun({ text: label.toUpperCase(), bold: true, size: PT(10.5), font: "Calibri" }),
    ],
  });
}

function entry_header(left: string, right: string): Paragraph {
  return new Paragraph({
    spacing: { after: 0 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: left, bold: true, size: PT(10.5), font: "Calibri" }),
      new TextRun({ text: "\t" + right, size: PT(10), font: "Calibri" }),
    ],
  });
}

function entry_sub(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 20 },
    children: [
      new TextRun({ text, italics: true, size: PT(10), font: "Calibri", color: "444444" }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 20 },
    children: [
      new TextRun({ text, size: PT(10), font: "Calibri" }),
    ],
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text, size: PT(10), font: "Calibri" }),
    ],
  });
}

function buildSections(doc: ResumeDocument): Paragraph[] {
  const out: Paragraph[] = [];

  // Header
  out.push(name_paragraph(doc.contact.name));
  const contactParts: string[] = [
    doc.contact.email,
    doc.contact.phone ?? "",
    doc.contact.city ?? "",
    ...doc.contact.links.map(l => l.label),
  ].filter(Boolean);
  if (contactParts.length) out.push(contact_paragraph(contactParts));

  const renderers: Record<SectionKey, () => void> = {
    summary: () => {
      if (!doc.summary) return;
      out.push(section_heading("Summary"));
      out.push(body(doc.summary));
    },
    experience: () => {
      if (!doc.experience.length) return;
      out.push(section_heading("Experience"));
      for (const e of doc.experience) {
        out.push(entry_header(`${e.role} — ${e.company}`, `${e.start} – ${e.end}`));
        if (e.employmentType || e.location) {
          out.push(entry_sub([e.employmentType, e.location].filter(Boolean).join(" · ")));
        }
        for (const b of e.bullets) out.push(bullet(b.text));
      }
    },
    projects: () => {
      if (!doc.projects.length) return;
      out.push(section_heading("Projects"));
      for (const p of doc.projects) {
        out.push(entry_header(p.title, p.tech.length ? p.tech.join(", ") : ""));
        for (const b of p.bullets) out.push(bullet(b.text));
      }
    },
    skills: () => {
      if (!doc.skillSections.length) return;
      out.push(section_heading("Skills"));
      for (const s of doc.skillSections) {
        out.push(new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({ text: s.category + ": ", bold: true, size: PT(10), font: "Calibri" }),
            new TextRun({ text: s.items.join(", "), size: PT(10), font: "Calibri" }),
          ],
        }));
      }
    },
    education: () => {
      if (!doc.education.length) return;
      out.push(section_heading("Education"));
      for (const e of doc.education) {
        out.push(entry_header(`${e.degree}${e.field ? ", " + e.field : ""}`, `${e.start} – ${e.end}`));
        out.push(entry_sub([e.institution, e.cgpa ? `CGPA ${e.cgpa}` : ""].filter(Boolean).join("  ·  ")));
        if (e.coursework?.length) {
          out.push(body("Relevant coursework: " + e.coursework.join(", ")));
        }
      }
    },
    certifications: () => {
      if (!doc.certifications.length) return;
      out.push(section_heading("Certifications"));
      for (const c of doc.certifications) {
        out.push(body(`${c.name} — ${c.issuer}${c.date ? ` (${c.date})` : ""}`));
      }
    },
    achievements: () => {
      if (!doc.achievements.length) return;
      out.push(section_heading("Achievements"));
      for (const a of doc.achievements) out.push(bullet(a.text));
    },
  };

  for (const key of doc.order) {
    renderers[key]?.();
  }

  return out;
}

export async function renderResumeDocx(doc: ResumeDocument, resumeName: string): Promise<{ blob: Blob; filename: string }> {
  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: PT(10) },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
          },
        },
        children: buildSections(doc),
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const filename = sanitizeFilename(resumeName || doc.contact.name) + ".docx";
  return { blob, filename };
}
