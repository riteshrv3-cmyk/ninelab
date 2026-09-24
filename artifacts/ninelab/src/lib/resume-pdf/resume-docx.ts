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
import { confirmedOnly } from "@workspace/resume-core";
import { DEFAULT_HEADING_LABELS } from "./templateConfig";

/** First-Last-Resume: the professional file name checkers look for. */
function resumeFileName(name: string): string {
  const parts = name.normalize("NFKD").replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean).slice(0, 3);
  return `${parts.length ? parts.join("-") : "Resume"}-Resume`;
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

function centered(text: string, size: number, after: number): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after },
    children: [new TextRun({ text, size: PT(size), font: "Calibri" })],
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
      new TextRun({ text, size: PT(10), font: "Calibri", color: "444444" }),
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

const joinDates = (start: string, end: string) => [start, end].map((s) => s.trim()).filter(Boolean).join(" - ");

// Same headings, separators and content as the PDF (ResumeHtml), so the Word
// file and the PDF parse identically.
function buildSections(doc: ResumeDocument): Paragraph[] {
  const out: Paragraph[] = [];

  out.push(name_paragraph(doc.contact.name));
  if (doc.headline.trim()) out.push(centered(doc.headline, 11, 20));
  const contactParts: string[] = [
    doc.contact.email,
    doc.contact.phone ?? "",
    doc.contact.city ?? "",
    ...doc.contact.links.map(l => l.label),
  ].filter(Boolean);
  if (contactParts.length) out.push(centered(contactParts.join(" | "), 10, 80));

  const renderers: Record<SectionKey, () => void> = {
    summary: () => {
      if (!doc.summary) return;
      out.push(section_heading(DEFAULT_HEADING_LABELS.summary));
      out.push(body(doc.summary));
    },
    experience: () => {
      if (!doc.experience.length) return;
      out.push(section_heading(DEFAULT_HEADING_LABELS.experience));
      for (const e of doc.experience) {
        out.push(entry_header([e.role, e.company].filter(Boolean).join(" | "), joinDates(e.start, e.end)));
        if (e.employmentType || e.location) {
          out.push(entry_sub([e.employmentType, e.location].filter(Boolean).join(" | ")));
        }
        for (const b of e.bullets) out.push(bullet(b.text));
      }
    },
    projects: () => {
      if (!doc.projects.length) return;
      out.push(section_heading(DEFAULT_HEADING_LABELS.projects));
      for (const p of doc.projects) {
        out.push(entry_header(p.title, p.tech.length ? p.tech.join(", ") : ""));
        if (p.link) out.push(entry_sub(p.link.replace(/^https?:\/\//, "")));
        for (const b of p.bullets) out.push(bullet(b.text));
      }
    },
    skills: () => {
      if (!doc.skillSections.length) return;
      out.push(section_heading(DEFAULT_HEADING_LABELS.skills));
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
      out.push(section_heading(DEFAULT_HEADING_LABELS.education));
      for (const e of doc.education) {
        out.push(entry_header([e.degree, e.institution].filter(Boolean).join(" | "), joinDates(e.start, e.end)));
        const sub = [e.field, e.cgpa ? `CGPA ${e.cgpa}` : ""].filter(Boolean).join(" | ");
        if (sub) out.push(entry_sub(sub));
        if (e.coursework?.length) {
          out.push(body("Relevant coursework: " + e.coursework.join(", ")));
        }
      }
    },
    certifications: () => {
      if (!doc.certifications.length) return;
      out.push(section_heading(DEFAULT_HEADING_LABELS.certifications));
      for (const c of doc.certifications) {
        out.push(bullet(`${c.name}${c.issuer ? `, ${c.issuer}` : ""}${c.date ? ` (${c.date})` : ""}`));
      }
    },
    achievements: () => {
      if (!doc.achievements.length) return;
      out.push(section_heading(DEFAULT_HEADING_LABELS.achievements));
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
        children: buildSections(confirmedOnly(doc)),
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const filename = resumeFileName(doc.contact.name || resumeName) + ".docx";
  return { blob, filename };
}
