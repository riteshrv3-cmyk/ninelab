import type { jsPDF } from "jspdf";

export type FontFamily = "sans" | "serif";

interface FaceSpec {
  file: string;
  jsPdfName: string;
  style: "normal" | "bold" | "italic";
}

const FAMILY_FACES: Record<FontFamily, FaceSpec[]> = {
  sans: [
    { file: "SourceSans3-Regular.ttf", jsPdfName: "ResumeSans", style: "normal" },
    { file: "SourceSans3-SemiBold.ttf", jsPdfName: "ResumeSans", style: "bold" },
    { file: "SourceSans3-Italic.ttf", jsPdfName: "ResumeSans", style: "italic" },
  ],
  serif: [
    { file: "SourceSerif4-Regular.ttf", jsPdfName: "ResumeSerif", style: "normal" },
    { file: "SourceSerif4-SemiBold.ttf", jsPdfName: "ResumeSerif", style: "bold" },
    { file: "SourceSerif4-Italic.ttf", jsPdfName: "ResumeSerif", style: "italic" },
  ],
};

export const JSPDF_FONT_NAME: Record<FontFamily, string> = {
  sans: "ResumeSans",
  serif: "ResumeSerif",
};

const FONT_BASE_URL = "/fonts/resume/";

// Module-level cache of fetched font bytes, base64-encoded, keyed by file
// name. Survives across multiple renderResumePdf() calls in the same session
// so a font is only fetched and encoded once.
const base64Cache = new Map<string, string>();
const loadedFamilies = new Set<FontFamily>();

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadFace(face: FaceSpec): Promise<string> {
  const cached = base64Cache.get(face.file);
  if (cached) return cached;
  const res = await fetch(`${FONT_BASE_URL}${face.file}`);
  if (!res.ok) throw new Error(`Font fetch failed: ${face.file} (${res.status})`);
  const buffer = await res.arrayBuffer();
  const b64 = bufferToBase64(buffer);
  base64Cache.set(face.file, b64);
  return b64;
}

/**
 * Registers a font family's three faces (Regular/SemiBold/Italic) into a
 * jsPDF document's virtual file system. Returns true on success, false if
 * any face failed to fetch — the caller should fall back to Helvetica
 * (jsPDF's built-in standard-14 font) rather than block the download.
 *
 * addFont/addFileToVFS must be called on EVERY jsPDF instance (they're not
 * shared across documents), but the base64 bytes themselves are cached at
 * module scope so repeat renders in the same session don't re-fetch.
 */
export async function ensureFonts(doc: jsPDF, family: FontFamily): Promise<boolean> {
  try {
    for (const face of FAMILY_FACES[family]) {
      const b64 = await loadFace(face);
      doc.addFileToVFS(face.file, b64);
      doc.addFont(face.file, face.jsPdfName, face.style);
    }
    loadedFamilies.add(family);
    return true;
  } catch {
    return false;
  }
}

export function isFamilyLoaded(family: FontFamily): boolean {
  return loadedFamilies.has(family);
}

/** Warms the font cache ahead of the first real render — call on Resume-page mount. */
export function preloadFonts(): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => {
      void Promise.all([
        Promise.all(FAMILY_FACES.sans.map(loadFace)).catch(() => undefined),
        Promise.all(FAMILY_FACES.serif.map(loadFace)).catch(() => undefined),
      ]);
    });
  }
}
