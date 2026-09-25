import { existsSync } from "node:fs";
import type { Browser } from "puppeteer-core";
import type { ResumeDocument } from "@workspace/resume-core";
// Resolved by esbuild (build.mjs alias) to the student app's own print-document
// builder, so the server PDF uses the exact markup the preview shows.
import { buildPrintDocument } from "@resume-render";
import { logger } from "../logger";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((p): p is string => !!p);

export class PdfUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfUnavailableError";
  }
}

function findChrome(): string | null {
  return CHROME_CANDIDATES.find((p) => existsSync(p)) ?? null;
}

let browserPromise: Promise<Browser> | null = null;
async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.connected) return b;
    browserPromise = null;
  }
  const executablePath = findChrome();
  if (!executablePath) throw new PdfUnavailableError("No Chrome/Chromium found on this server");
  const { launch } = await import("puppeteer-core");
  browserPromise = launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--font-render-hinting=none"],
  });
  const browser = await browserPromise;
  browser.on("disconnected", () => { browserPromise = null; });
  return browser;
}

// One page at a time per slot: Chromium on a small container runs out of
// memory long before it runs out of CPU.
const MAX_CONCURRENT = 2;
let active = 0;
const waiters: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

/** Professional file name recruiters and checkers expect: First-Last-Resume.pdf */
export function resumeFileName(name: string): string {
  const clean = name.normalize("NFKD").replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean).slice(0, 3);
  return `${clean.length ? clean.join("-") : "Resume"}-Resume.pdf`;
}

/**
 * Renders a resume to a text-layer PDF with headless Chromium. The document is
 * built from stored content (never from client HTML), scripts are off and
 * every network request is refused, so the page can only draw what we gave it.
 */
// Tighter spacing (not smaller type: sizes must stay whole pixels, see
// tokens.ts) for a resume that spills a few lines onto page 2.
const FIT_CSS = `.rz-page{--r-space-xl:10pt !important;--r-space-lg:8pt !important;--r-space-md:5pt !important;--r-space-sm:3pt !important;--r-space-xs:1.5pt !important}
@page{margin:34pt 51pt 34pt 51pt}`;

function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

export async function renderResumePdf(doc: ResumeDocument, templateId: string, title: string): Promise<Buffer> {
  const html = buildPrintDocument(doc, templateId, title);
  const first = await renderHtml(html);
  if (pageCount(first) <= 1) return first;
  const fitted = await renderHtml(html.replace("</style>", `${FIT_CSS}</style>`));
  return pageCount(fitted) < pageCount(first) ? fitted : first;
}

async function renderHtml(html: string): Promise<Buffer> {
  return withSlot(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const url = req.url();
        if (url.startsWith("data:") || url === "about:blank") void req.continue();
        else void req.abort();
      });
      await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
      await page.emulateMediaType("print");
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        tagged: true,
        timeout: 30_000,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  });
}
