// A4 page geometry, in points (jsPDF's "pt" unit). Keep in sync with
// lib/resume-core/src/layoutEstimate.ts's CW/CH constants — that module
// estimates layout on the server without loading this file (no jsPDF there).

export const PAGE = {
  width: 595.28,
  height: 841.89,
  marginLeft: 51,
  marginRight: 51,
  marginTop: 45,
  marginBottom: 45,
  /** Reserved for the page number footer, multi-page documents only. */
  footerBand: 18,
} as const;

export const CONTENT_WIDTH = PAGE.width - PAGE.marginLeft - PAGE.marginRight;
export const CONTENT_HEIGHT = PAGE.height - PAGE.marginTop - PAGE.marginBottom;

export const GRID = 1.5;

/** Rounds a value to the nearest baseline-grid increment, so vertical rhythm stays consistent. */
export function toGrid(value: number): number {
  return Math.round(value / GRID) * GRID;
}
