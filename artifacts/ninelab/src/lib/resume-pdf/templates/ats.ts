import type { TemplateConfig } from "../templateConfig";

// Maximum parse safety: no rects, no accent color, parser-canonical section
// headings. This is the template to recommend when a student doesn't know
// which to pick.
export const atsTemplate: TemplateConfig = {
  id: "ats",
  label: "Campus placement (standard format)",
  description: "Parser-safe layout — recommended for campus drives and bulk applications",
  fontFamily: "sans",
  density: "normal",
  accent: null,
  header: {
    align: "left",
    nameCase: "title",
    showHeadline: true,
    accentBar: false,
  },
  sectionHeading: {
    rule: "full",
    ruleWeight: 0.5,
    useAccent: false,
  },
  bullet: { glyph: "-" },
  headingLabels: {
    experience: "Work Experience",
    education: "Education",
    skills: "Skills",
  },
};
