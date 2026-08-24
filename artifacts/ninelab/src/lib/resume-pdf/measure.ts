import type { jsPDF } from "jspdf";
import { TYPE_SCALE, PALETTE, type TypeRole, type RGB } from "./tokens";
import { JSPDF_FONT_NAME, isFamilyLoaded, type FontFamily } from "./fonts";

export interface StyleOptions {
  /** Overrides the role's default weight (e.g. italic project tech in one template). */
  styleOverride?: "normal" | "bold" | "italic";
  color?: RGB;
  /** Extra tracking on top of the role's own, e.g. +0.6 more when a name is uppercased. */
  extraTracking?: number;
}

/**
 * Applies a TypeRole's font, size, color, and tracking to the jsPDF document.
 * Falls back to Helvetica (jsPDF's built-in standard-14 font) if the embedded
 * family failed to load — a font failure never blocks rendering, it just
 * looks like Helvetica instead of Source Sans/Serif.
 */
export function setStyle(doc: jsPDF, role: TypeRole, family: FontFamily, opts: StyleOptions = {}): void {
  const style = TYPE_SCALE[role];
  const fontName = isFamilyLoaded(family) ? JSPDF_FONT_NAME[family] : "helvetica";
  const weight = opts.styleOverride ?? style.weight;
  // Our embedded faces only register normal/bold/italic — jsPDF's Helvetica
  // fallback supports bolditalic too, but no TypeRole needs it.
  doc.setFont(fontName, weight === "bolditalic" ? "bold" : weight);
  doc.setFontSize(style.size);
  const color = opts.color ?? PALETTE.body;
  doc.setTextColor(color.r, color.g, color.b);
  doc.setCharSpace(style.tracking + (opts.extraTracking ?? 0));
}

/** Resets tracking to 0 — call after any block that set custom tracking, so it never leaks. */
export function resetTracking(doc: jsPDF): void {
  doc.setCharSpace(0);
}

/** Measures the rendered width of `text` in the document's CURRENT font/size. */
export function measureText(doc: jsPDF, text: string): number {
  return doc.getTextWidth(text);
}

/** Wraps `text` to `maxWidth` in the document's CURRENT font/size, returning one string per line. */
export function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/** Height in points that `n` lines occupy at a role's leading. */
export function linesHeight(role: TypeRole, lineCount: number): number {
  return TYPE_SCALE[role].leading * lineCount;
}
