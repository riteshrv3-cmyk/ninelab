// Builds the standalone print document for a resume: the same ResumeHtml
// markup as the live preview, with fonts and print CSS inlined. Pure (no
// window/document), so the API server bundles this exact function to render
// PDFs, and the preview, the browser print path and the server PDF share one
// layout.

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { ResumeDocument } from "@workspace/resume-core";
import { CONTENT_WIDTH, PAGE } from "@/lib/resume-pdf/geometry";
import { ResumeHtml, RESUME_FONT_CSS, RESUME_HTML_CSS } from "./ResumeHtml";

// Margins live on @page (repeated on EVERY printed page), not as .rz-page
// padding — padding applies only at the outer box edges, so a resume that
// fragments onto a second page would otherwise print flush to the paper edge.
const PRINT_CSS = `
@page { size: A4; margin: ${PAGE.marginTop}pt ${PAGE.marginRight}pt ${PAGE.marginBottom}pt ${PAGE.marginLeft}pt; }
html, body { margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rz-page { width: ${CONTENT_WIDTH}pt; min-height: 0; padding: 0; margin: 0 auto; }
`;

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, "_").replace(/\.+$/, "").slice(0, 80) || "Resume";
}

export function buildPrintDocument(doc: ResumeDocument, templateId: string, title: string): string {
  const markup = renderToStaticMarkup(createElement(ResumeHtml, { doc, templateId }));
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${sanitizeFilename(title)}</title>
<style>${RESUME_FONT_CSS}${RESUME_HTML_CSS}${PRINT_CSS}</style>
</head>
<body>${markup}</body>
</html>`;
}

