import type { LayoutEstimate, ResumeDocument, SectionKey } from "./types";
import type { TemplateDensity } from "./budget";

// A4 geometry, matching artifacts/ninelab/src/lib/resume-pdf/geometry.ts exactly —
// keep these two files in sync if the page geometry ever changes.
const CW = 493.28; // usable content width, pt
const CH = 751.89; // usable content height, pt

const TYPE_SCALE = {
  name: { size: 21, leading: 25.5 },
  section: { size: 9, leading: 12 },
  entry: { size: 11, leading: 15 },
  body: { size: 10, leading: 13.5 },
  meta: { size: 8.25, leading: 10.5 },
};

const SPACING = { xs: 3, sm: 4.5, md: 7.5, lg: 12, xl: 18, xxl: 24 };

const DENSITY_SPACING_MULT: Record<TemplateDensity, number> = { compact: 0.85, normal: 1.0, airy: 1.2 };

/**
 * Estimates how many characters fit per line at a given font size in the
 * usable content width. This is a coarse average-glyph-width heuristic
 * (~0.5em for a humanist sans at these sizes) — NOT real font metrics. It
 * exists so the server (which has no jsPDF, no embedded fonts, no `public/`
 * asset access) can still predict page count/fill for the critic's density
 * axis. The client-side typeset engine in resume-pdf/measure.ts does the
 * precise version with actual glyph widths for painting; the two will agree
 * closely but not pixel-for-pixel, which is fine for a "will this fit one
 * page" signal.
 */
function charsPerLine(fontSize: number, width = CW): number {
  const avgCharWidth = fontSize * 0.5;
  return Math.max(1, Math.floor(width / avgCharWidth));
}

function linesFor(text: string, fontSize: number, width = CW): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / charsPerLine(fontSize, width)));
}

function sectionHeadingHeight(density: TemplateDensity): number {
  const mult = DENSITY_SPACING_MULT[density];
  return SPACING.xl * mult + TYPE_SCALE.section.leading + SPACING.md * mult;
}

/**
 * Pure, deterministic estimate of page count and last-page fill percentage —
 * no font loading, no jsPDF, runs identically on the server and the client.
 * Used by Stage 4's critic (densityFit axis) and, before the real engine has
 * run, by the preview's initial skeleton.
 */
export function estimateLayout(doc: ResumeDocument, density: TemplateDensity = "normal"): LayoutEstimate {
  const spacingMult = DENSITY_SPACING_MULT[density];
  let height = 0;

  // Header block: name + headline + contact line + rule.
  height += TYPE_SCALE.name.leading;
  if (doc.headline) height += TYPE_SCALE.body.leading;
  height += TYPE_SCALE.meta.leading;
  height += SPACING.lg * spacingMult;

  const addSection = (lineCount: number, entryGap = SPACING.md) => {
    if (lineCount <= 0) return;
    height += sectionHeadingHeight(density);
    height += lineCount * TYPE_SCALE.body.leading;
    height += entryGap * spacingMult;
  };

  const sectionLines: Record<SectionKey, number> = {
    summary: 0,
    experience: 0,
    projects: 0,
    skills: 0,
    education: 0,
    certifications: 0,
    achievements: 0,
  };

  sectionLines.summary = linesFor(doc.summary, TYPE_SCALE.body.size);

  for (const e of doc.experience) {
    sectionLines.experience += 1; // entry header line
    for (const b of e.bullets) sectionLines.experience += linesFor(b.text, TYPE_SCALE.body.size, CW - 20);
  }

  for (const p of doc.projects) {
    sectionLines.projects += 1;
    for (const b of p.bullets) sectionLines.projects += linesFor(b.text, TYPE_SCALE.body.size, CW - 20);
  }

  for (const s of doc.skillSections) {
    sectionLines.skills += linesFor(`${s.category}: ${s.items.join(", ")}`, TYPE_SCALE.body.size);
  }

  for (const ed of doc.education) {
    sectionLines.education += 2; // degree/institution line + dates/cgpa line
  }

  sectionLines.certifications = doc.certifications.length;
  sectionLines.achievements = doc.achievements.length;

  for (const key of doc.order) {
    addSection(sectionLines[key]);
  }

  const pages = Math.max(1, Math.ceil(height / CH));
  const lastPageHeight = height - (pages - 1) * CH;
  const fillPct = Math.min(100, Math.round((lastPageHeight / CH) * 100));

  return { pages, fillPct };
}
