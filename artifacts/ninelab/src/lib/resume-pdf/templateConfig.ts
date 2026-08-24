import type { SectionKey } from "@workspace/resume-core";
import type { RGB } from "./tokens";
import type { FontFamily } from "./fonts";
import type { TemplateDensity } from "./tokens";

export type TemplateId = "ats" | "classic" | "tech" | "minimal";

export interface TemplateConfig {
  id: TemplateId;
  label: string;
  description: string;
  fontFamily: FontFamily;
  density: TemplateDensity;
  accent: RGB | null;
  header: {
    align: "left" | "center";
    nameCase: "upper" | "title";
    showHeadline: boolean;
    accentBar: false | { height: number };
  };
  sectionHeading: {
    rule: "full" | "short" | "none";
    ruleWeight: number;
    useAccent: boolean;
  };
  bullet: {
    glyph: string;
  };
  headingLabels: Partial<Record<SectionKey, string>>;
}

export const DEFAULT_HEADING_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
};
