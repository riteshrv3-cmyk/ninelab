// The template registry — the single source of truth for template
// id/label/description and design config, shared by the HTML renderer
// (components/resume/html/), the DOCX exporter (resume-docx.ts), and the
// server's density mapping (kept in sync manually — see routes/resume.ts).
//
// The jsPDF typeset engine that used to live alongside this (blocks/typeset/
// paint/measure) is gone: rendering now happens in real HTML/CSS via
// ResumeHtml, and PDFs come from the browser's print engine — one layout
// engine for preview and download, with clickable links in the output.

import type { TemplateConfig, TemplateId } from "./templateConfig";
import { atsTemplate } from "./templates/ats";
import { classicTemplate } from "./templates/classic";
import { techTemplate } from "./templates/tech";
import { minimalTemplate } from "./templates/minimal";

export * from "./templateConfig";

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
