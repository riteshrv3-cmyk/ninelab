let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/**
 * Loads pdf.js configured with our polyfilled worker (see lib/pdfWorker.ts) so
 * pdf.js's Math.sumPrecise call works on older browsers and budget Android
 * webviews. Shared by every pdf.js entry point (preview, inline editor, resume
 * text extraction) so the worker is created and cached exactly once.
 */
export function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      // workerPort overrides workerSrc; the wrapper installs the polyfill into
      // the worker scope before pdf.js worker code evaluates.
      const { default: PdfWorker } = await import("@/lib/pdfWorker?worker");
      pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
}
