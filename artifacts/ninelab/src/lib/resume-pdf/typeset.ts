import type { RGB } from "./tokens";
import type { TypeRole } from "./tokens";
import type { FontFamily } from "./fonts";
import { PAGE, CONTENT_HEIGHT } from "./geometry";
import type { SectionKey } from "@workspace/resume-core";

export interface ChunkSource {
  section: SectionKey;
  entryIndex?: number;
  bulletIndex?: number;
  field: "summary" | "bulletText" | "achievementText";
}

export type Atom =
  | { kind: "text"; x: number; dy: number; text: string; role: TypeRole; family: FontFamily; styleOverride?: "normal" | "bold" | "italic"; color?: RGB; extraTracking?: number; align?: "left" | "right" | "center" }
  | { kind: "rule"; x1: number; x2: number; dy: number; weight: number; color: RGB }
  | { kind: "rect"; x: number; dy: number; w: number; h: number; color: RGB }
  | { kind: "link"; x: number; dy: number; w: number; h: number; url: string };

/**
 * One indivisible unit of layout. A bullet is always exactly one chunk (never
 * split across a page break); a section heading and an entry header are each
 * one chunk with `keepWithNextHeight` set so they can never be stranded alone
 * at a page foot.
 */
export interface Chunk {
  id: string;
  /** Groups bullet chunks belonging to the same experience/project entry, for the "≥2 per side" orphan rule. */
  entryId?: string;
  kind: "header" | "sectionHeading" | "entryHeader" | "bullet" | "line";
  height: number;
  /** Vertical space required before this chunk, relative to the previous chunk's bottom edge. */
  gapBefore: number;
  /** Extra height (of the immediately-following chunk) that must also fit on this page. 0 if none. */
  keepWithNextHeight: number;
  atoms: Atom[];
  /** Which part of the ResumeDocument this chunk represents — used for inline edit hit-testing. */
  source?: ChunkSource;
}

export interface PlacedChunk {
  chunk: Chunk;
  y: number;
}

export interface Page {
  chunks: PlacedChunk[];
}

/**
 * Places chunks onto pages. A chunk (plus its keepWithNextHeight) that
 * doesn't fit the remaining space starts a new page instead of splitting.
 * Bullets belonging to the same entry are backtracked onto the next page
 * together if fewer than 2 would otherwise land alone at a page foot —
 * a lone bullet under an entry header reads as a mistake, not a design.
 */
export function paginate(chunks: Chunk[]): Page[] {
  const pages: Page[] = [{ chunks: [] }];
  let y = 0; // relative to top of usable content area
  let currentEntryId: string | undefined;
  let entryBulletsOnPage = 0;

  const bottomLimit = CONTENT_HEIGHT;

  const startNewPage = () => {
    pages.push({ chunks: [] });
    y = 0;
    entryBulletsOnPage = 0;
  };

  for (const chunk of chunks) {
    if (chunk.entryId !== currentEntryId) {
      currentEntryId = chunk.entryId;
      entryBulletsOnPage = 0;
    }

    const needed = chunk.gapBefore + chunk.height + chunk.keepWithNextHeight;
    const wouldOverflow = y > 0 && y + needed > bottomLimit;

    if (wouldOverflow) {
      // Orphan guard: if this is a bullet and fewer than 2 bullets of this
      // entry landed on the current page, pull those already-placed bullets
      // back onto the next page too, rather than leaving 0-1 stranded above
      // an otherwise-empty page.
      if (chunk.kind === "bullet" && entryBulletsOnPage > 0 && entryBulletsOnPage < 2) {
        const page = pages[pages.length - 1];
        const pulled: Chunk[] = [];
        while (page.chunks.length > 0 && page.chunks[page.chunks.length - 1].chunk.entryId === currentEntryId && page.chunks[page.chunks.length - 1].chunk.kind === "bullet") {
          pulled.unshift(page.chunks.pop()!.chunk);
        }
        startNewPage();
        for (const c of pulled) {
          pages[pages.length - 1].chunks.push({ chunk: c, y });
          y += c.height;
          entryBulletsOnPage++;
        }
      } else {
        startNewPage();
      }
    }

    y += chunk.gapBefore;
    pages[pages.length - 1].chunks.push({ chunk, y });
    y += chunk.height;
    if (chunk.kind === "bullet") entryBulletsOnPage++;
  }

  return pages;
}

export interface LayoutPrediction {
  pages: number;
  fillPct: number;
}

/** Precise client-side equivalent of resume-core's estimateLayout(), using real chunk heights. */
export function predictLayout(pages: Page[]): LayoutPrediction {
  const lastPage = pages[pages.length - 1];
  const lastPageBottom = lastPage.chunks.length > 0
    ? lastPage.chunks[lastPage.chunks.length - 1].y + lastPage.chunks[lastPage.chunks.length - 1].chunk.height
    : 0;
  return {
    pages: pages.length,
    fillPct: Math.min(100, Math.round((lastPageBottom / CONTENT_HEIGHT) * 100)),
  };
}

export interface CompressionStep {
  leadingMultiplier: number;
  spacingMultiplier: number;
  bodySize: number;
}

/**
 * The fit-pass compression ladder. Whitespace-only rungs (0-3) apply
 * automatically; rung 4 (dropping a deprioritized item) is the caller's
 * responsibility to surface as a one-tap suggestion, never applied silently.
 */
export const COMPRESSION_LADDER: CompressionStep[] = [
  { leadingMultiplier: 1.0, spacingMultiplier: 1.0, bodySize: 10 },
  { leadingMultiplier: 0.94, spacingMultiplier: 0.75, bodySize: 10 },
  { leadingMultiplier: 0.94, spacingMultiplier: 0.6, bodySize: 10 },
  { leadingMultiplier: 0.9, spacingMultiplier: 0.5, bodySize: 9.75 },
];

export const EXPANSION_STEP: CompressionStep = { leadingMultiplier: 1.15, spacingMultiplier: 1.3, bodySize: 10 };

export { PAGE };
