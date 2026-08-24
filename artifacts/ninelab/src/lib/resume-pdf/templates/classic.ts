import type { TemplateConfig } from "../templateConfig";

export const classicTemplate: TemplateConfig = {
  id: "classic",
  label: "Non-tech and business roles",
  description: "Centered header, serif body — professional and polished",
  fontFamily: "serif",
  density: "airy",
  accent: null,
  header: {
    align: "center",
    nameCase: "upper",
    showHeadline: true,
    accentBar: false,
  },
  sectionHeading: {
    rule: "full",
    ruleWeight: 0.5,
    useAccent: false,
  },
  bullet: { glyph: "•" },
  headingLabels: {
    experience: "Professional Experience",
  },
};
