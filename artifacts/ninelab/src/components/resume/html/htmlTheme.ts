// TemplateConfig → CSS custom properties. The design tokens come verbatim from
// lib/resume-pdf/tokens.ts (one type scale, one spacing scale, one palette) so
// the HTML render can never drift from the registry the DOCX path also reads.

import type { TemplateConfig } from "@/lib/resume-pdf/templateConfig";
import { DENSITY_MULTIPLIER, PALETTE, SPACING, TYPE_SCALE, UPPERCASE_NAME_EXTRA_TRACKING, type RGB } from "@/lib/resume-pdf/tokens";

export const FONT_STACKS = {
  sans: `"Source Sans 3", "Segoe UI", Arial, sans-serif`,
  serif: `"Source Serif 4", Georgia, "Times New Roman", serif`,
} as const;

function rgb(c: RGB): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

/** All values in pt — CSS understands pt natively and print output stays exact. */
export function themeFor(config: TemplateConfig): Record<string, string> {
  const mult = DENSITY_MULTIPLIER[config.density];
  const nameTracking = TYPE_SCALE.name.tracking + (config.header.nameCase === "upper" ? UPPERCASE_NAME_EXTRA_TRACKING : 0);
  return {
    "--r-font": FONT_STACKS[config.fontFamily],
    "--r-ink": rgb(PALETTE.ink),
    "--r-body-color": rgb(PALETTE.body),
    "--r-muted": rgb(PALETTE.muted),
    "--r-rule": rgb(PALETTE.rule),
    "--r-accent": config.accent ? rgb(config.accent) : rgb(PALETTE.ink),

    "--r-name-size": `${TYPE_SCALE.name.size}pt`,
    "--r-name-leading": `${TYPE_SCALE.name.leading}pt`,
    "--r-name-tracking": `${nameTracking}pt`,
    "--r-headline-size": `${TYPE_SCALE.headline.size}pt`,
    "--r-headline-leading": `${TYPE_SCALE.headline.leading}pt`,
    "--r-contact-size": `${TYPE_SCALE.contact.size}pt`,
    "--r-contact-leading": `${TYPE_SCALE.contact.leading}pt`,
    "--r-section-size": `${TYPE_SCALE.section.size}pt`,
    "--r-section-leading": `${TYPE_SCALE.section.leading}pt`,
    "--r-section-tracking": `${TYPE_SCALE.section.tracking}pt`,
    "--r-entry-size": `${TYPE_SCALE.entry.size}pt`,
    "--r-entry-leading": `${TYPE_SCALE.entry.leading}pt`,
    "--r-body-size": `${TYPE_SCALE.body.size}pt`,
    "--r-body-leading": `${TYPE_SCALE.body.leading}pt`,
    "--r-meta-size": `${TYPE_SCALE.meta.size}pt`,
    "--r-meta-leading": `${TYPE_SCALE.meta.leading}pt`,
    "--r-meta-tracking": `${TYPE_SCALE.meta.tracking}pt`,

    "--r-space-xs": `${SPACING.xs * mult}pt`,
    "--r-space-sm": `${SPACING.sm * mult}pt`,
    "--r-space-md": `${SPACING.md * mult}pt`,
    "--r-space-lg": `${SPACING.lg * mult}pt`,
    "--r-space-xl": `${SPACING.xl * mult}pt`,

    "--r-bullet-glyph": `"${config.bullet.glyph}"`,
    "--r-header-align": config.header.align,
  };
}
