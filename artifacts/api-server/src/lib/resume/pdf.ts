import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
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

// Fonts are inlined as data URIs so the page never needs the network.
let fontCssCache: Map<string, string> | null = null;
function fontDataUris(): Map<string, string> {
  if (fontCssCache) return fontCssCache;
  const here = typeof __dirname === "string" ? __dirname : process.cwd();
  const dirs = [
    path.resolve(here, "public/fonts/resume"),
    path.resolve(here, "../../ninelab/public/fonts/resume"),
    path.resolve(process.cwd(), "artifacts/ninelab/public/fonts/resume"),
    path.resolve(process.cwd(), "../ninelab/public/fonts/resume"),
  ];
  const dir = dirs.find((d) => existsSync(path.join(d, "SourceSans3-Regular.ttf")));
  const map = new Map<string, string>();
  if (dir) {
    for (const f of ["SourceSans3-Regular.ttf", "SourceSans3-SemiBold.ttf", "SourceSans3-Italic.ttf", "SourceSerif4-Regular.ttf", "SourceSerif4-SemiBold.ttf", "SourceSerif4-Italic.ttf"]) {
      const file = path.join(dir, f);
      if (existsSync(file)) map.set(`/fonts/resume/${f}`, `data:font/ttf;base64,${readFileSync(file).toString("base64")}`);
    }
  } else {
    logger.warn({ dirs }, "resume pdf: font directory not found, PDFs will use fallback fonts");
  }
  fontCssCache = map;
  return map;
}

function inlineFonts(html: string): string {
  let out = html;
  for (const [url, data] of fontDataUris()) out = out.split(`url("${url}")`).join(`url("${data}")`);
  return out;
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
export async function renderResumePdf(doc: ResumeDocument, templateId: string, title: string): Promise<Buffer> {
  const html = inlineFonts(buildPrintDocument(doc, templateId, title));
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
