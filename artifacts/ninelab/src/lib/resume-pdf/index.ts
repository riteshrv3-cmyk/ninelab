import { jsPDF } from "jspdf";
import type { ResumeDocument } from "@workspace/resume-core";
import { buildChunks } from "./blocks";
import { paginate, predictLayout as predictFromPages, COMPRESSION_LADDER, EXPANSION_STEP, type LayoutPrediction, type Page } from "./typeset";
import { paint, createDocument, applyDocumentMetadata, buildFilename } from "./paint";
import type { TemplateConfig, TemplateId } from "./templateConfig";
import { atsTemplate } from "./templates/ats";
import { classicTemplate } from "./templates/classic";
import { techTemplate } from "./templates/tech";
import { minimalTemplate } from "./templates/minimal";

export * from "./templateConfig";
export { preloadFonts } from "./fonts";

export const TEMPLATE_REGISTRY: Record<TemplateId, TemplateConfig> = {
  ats: atsTemplate,
  classic: classicTemplate,
  tech: techTemplate,
  minimal: minimalTemplate,
};

export const DEFAULT_TEMPLATE_ID: TemplateId = "classic";

export function resolveTemplateConfig(templateId: string): TemplateConfig {
  return TEMPLATE_REGISTRY[templateId as TemplateId] ?? TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_ID];
}

export interface RenderOptions {
  roleTitle?: string | null;
  companyName?: string | null;
  resumeName?: string;
}

export interface RenderResult {
  doc: jsPDF;
  filename: string;
  layout: LayoutPrediction;
  fontsLoaded: boolean;
  pages: Page[];
}

export type { Page } from "./typeset";
export type { ChunkSource } from "./typeset";

/**
 * Runs the fit pass: if the content spills onto a near-empty second page,
 * shrink whitespace (section/entry gaps) rung by rung — never leading, never
 * content — and re-paginate at each rung until it fits one page or the
 * ladder is exhausted. If a single page is sparse, expand whitespace instead.
 * Dropping a deprioritized item (the ladder's most aggressive rung) is
 * deliberately NOT applied here — that's surfaced to the student as a one-tap
 * suggestion in the preview, never applied silently.
 */
function buildAndPaginateWithFitPass(doc: import("jspdf").jsPDF, resume: ResumeDocument, config: ReturnType<typeof resolveTemplateConfig>) {
  let pages = paginate(buildChunks(doc, resume, config));
  if (pages.length === 1) {
    const fill = predictFromPages(pages).fillPct;
    if (fill < 60) {
      pages = paginate(buildChunks(doc, resume, config, { compressionMultiplier: EXPANSION_STEP.spacingMultiplier }));
    }
    return pages;
  }

  for (const rung of COMPRESSION_LADDER) {
    const candidate = paginate(buildChunks(doc, resume, config, { compressionMultiplier: rung.spacingMultiplier }));
    if (candidate.length === 1) return candidate;
    pages = candidate; // keep the most-compressed attempt even if it still spills, so at least fill improves
  }
  return pages;
}

export async function renderResumePdf(
  resume: ResumeDocument,
  templateId: string,
  opts: RenderOptions = {},
): Promise<RenderResult> {
  const config = resolveTemplateConfig(templateId);
  const { doc, fontsLoaded } = await createDocument(config);

  const pages = buildAndPaginateWithFitPass(doc, resume, config);
  paint(doc, pages, config);
  applyDocumentMetadata(doc, resume, opts.roleTitle ?? null, opts.companyName ?? null);

  const filename = buildFilename(resume, opts.resumeName || `${config.label} Resume`);
  const layout = predictFromPages(pages);

  return { doc, filename, layout, fontsLoaded, pages };
}

/**
 * Predicts page count/fill using the same fit pass renderResumePdf() runs,
 * so the preview's "runs to 2 pages" warning never disagrees with what the
 * download actually produces. Skips the font fetch — Helvetica's metrics are
 * close enough for pagination even before the real embedded font loads.
 */
export function predictLayoutFor(resume: ResumeDocument, templateId: string): LayoutPrediction {
  const config = resolveTemplateConfig(templateId);
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pages = buildAndPaginateWithFitPass(doc, resume, config);
  return predictFromPages(pages);
}
