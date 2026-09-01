// PDF via the browser's print engine: the same ResumeHtml markup as the live
// preview is rendered into a standalone document and printed. "Save as PDF"
// output is therefore pixel-identical to the on-screen preview, links stay
// clickable in the PDF (jsPDF never managed that), and there is no second
// layout engine to drift.

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

function sanitizeFilename(name: string): string {
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

function isMobileLike(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iOS || /Android/i.test(ua);
}

/**
 * Opens the browser's print dialog on the standalone resume document.
 * Desktop: hidden same-origin iframe (no visible navigation). Mobile/iOS:
 * a new tab (iframe printing is unreliable in iOS Safari) — the tab doubles
 * as a visible preview, and the DOCX button remains the guaranteed-file path.
 */
export async function printResume(doc: ResumeDocument, templateId: string, resumeName: string): Promise<void> {
  const html = buildPrintDocument(doc, templateId, resumeName);

  if (isMobileLike()) {
    const win = window.open("", "_blank");
    if (!win) throw new Error("Popup blocked — allow popups to download the PDF");
    win.document.open();
    win.document.write(html);
    win.document.close();
    const tryPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        // The tab is still open showing the resume — the user can print manually.
      }
    };
    // Give fonts a moment; document.fonts.ready is unreliable across writes.
    win.addEventListener("load", () => setTimeout(tryPrint, 350));
    setTimeout(tryPrint, 1200); // fallback if load already fired
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.srcdoc = html;

    const cleanup = () => {
      // Delay removal — Chrome cancels the print job if the frame disappears
      // while the dialog is still open.
      setTimeout(() => iframe.remove(), 60_000);
    };

    iframe.onload = () => {
      void (async () => {
        try {
          const frameDoc = iframe.contentDocument;
          const frameWin = iframe.contentWindow;
          if (!frameDoc || !frameWin) throw new Error("Print frame unavailable");
          try {
            await frameDoc.fonts.ready;
          } catch {
            // Fonts API unavailable — print with fallback faces rather than never.
          }
          frameWin.addEventListener("afterprint", cleanup, { once: true });
          frameWin.focus();
          frameWin.print();
          cleanup();
          resolve();
        } catch (e) {
          iframe.remove();
          reject(e as Error);
        }
      })();
    };

    document.body.appendChild(iframe);
  });
}
