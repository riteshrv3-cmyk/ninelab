import { jsPDF } from "jspdf";
import type { ResumeDocument } from "@workspace/resume-core";
import { PAGE } from "./geometry";
import { setStyle, resetTracking } from "./measure";
import { PALETTE, TYPE_SCALE } from "./tokens";
import type { Page } from "./typeset";
import type { TemplateConfig } from "./templateConfig";
import { ensureFonts } from "./fonts";

const ML = PAGE.marginLeft;
const MT = PAGE.marginTop;

function drawPageNumber(doc: jsPDF, pageIndex: number, totalPages: number, family: TemplateConfig["fontFamily"]) {
  setStyle(doc, "micro", family, { color: PALETTE.muted });
  const text = `Page ${pageIndex + 1} of ${totalPages}`;
  doc.text(text, PAGE.width / 2, PAGE.height - PAGE.marginBottom / 2, { align: "center" });
  resetTracking(doc);
}

/** Paints already-paginated chunks onto a jsPDF document. Two phases (measure/paginate, then paint) never interleave. */
export function paint(doc: jsPDF, pages: Page[], config: TemplateConfig): void {
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage();

    for (const { chunk, y } of page.chunks) {
      const top = MT + y;
      for (const atom of chunk.atoms) {
        const absY = top + atom.dy;
        switch (atom.kind) {
          case "text": {
            setStyle(doc, atom.role, atom.family, {
              styleOverride: atom.styleOverride,
              color: atom.color,
              extraTracking: atom.extraTracking,
            });
            const baseline = absY + TYPE_SCALE[atom.role].size * 0.8;
            doc.text(atom.text, atom.x, baseline, { align: atom.align ?? "left" });
            resetTracking(doc);
            break;
          }
          case "rule": {
            doc.setDrawColor(atom.color.r, atom.color.g, atom.color.b);
            doc.setLineWidth(atom.weight);
            doc.line(atom.x1, absY, atom.x2, absY);
            break;
          }
          case "rect": {
            doc.setFillColor(atom.color.r, atom.color.g, atom.color.b);
            doc.rect(atom.x, absY, atom.w, atom.h, "F");
            break;
          }
          case "link": {
            doc.link(atom.x, absY, atom.w, atom.h, { url: atom.url });
            break;
          }
        }
      }
    }

    if (pages.length > 1) drawPageNumber(doc, pageIndex, pages.length, config.fontFamily);
  });
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .replace(/\.+$/, "")
    .slice(0, 80);
}

export function buildFilename(resume: ResumeDocument, resumeName: string): string {
  return `${sanitizeFilename(resume.contact.name)}_${sanitizeFilename(resumeName)}.pdf`;
}

export function applyDocumentMetadata(doc: jsPDF, resume: ResumeDocument, roleTitle: string | null, companyName: string | null): void {
  const keywords = resume.atsMeta?.matched.map((m) => m.term).join(", ") ?? "";
  doc.setProperties({
    title: `${resume.contact.name} — ${roleTitle || "Resume"}`,
    subject: companyName && roleTitle ? `Resume for ${roleTitle} at ${companyName}` : "Resume",
    author: resume.contact.name,
    keywords,
    creator: "ninelab Resume Builder",
  });
  // jsPDF's typed setLanguage isn't declared on the base type in v4; call it defensively.
  const withLang = doc as jsPDF & { setLanguage?: (lang: string) => void };
  withLang.setLanguage?.("en-IN");
}

export async function createDocument(config: TemplateConfig): Promise<{ doc: jsPDF; fontsLoaded: boolean }> {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const fontsLoaded = await ensureFonts(doc, config.fontFamily);
  return { doc, fontsLoaded };
}
