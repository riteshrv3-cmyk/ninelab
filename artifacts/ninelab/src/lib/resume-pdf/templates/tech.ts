import type { TemplateConfig } from "../templateConfig";

export const techTemplate: TemplateConfig = {
  id: "tech",
  label: "Software / product roles",
  description: "Compact, accent bar — highlights your tech stack",
  fontFamily: "sans",
  density: "compact",
  accent: { r: 74, g: 85, b: 199 }, // brand indigo, an inset accent bar/rule — never full-bleed
  header: {
    align: "left",
    nameCase: "title",
    showHeadline: true,
    accentBar: { height: 3 },
  },
  sectionHeading: {
    rule: "short",
    ruleWeight: 2,
    useAccent: true,
  },
  bullet: { glyph: "▪" },
  headingLabels: {},
};
