// One type scale, one spacing scale, one print palette — shared by all four
// templates. This replaces the old per-template magic numbers (ten distinct
// font sizes, four body grays, two blacks used interchangeably).

export type TypeRole = "name" | "headline" | "contact" | "section" | "entry" | "meta" | "body" | "micro";

export interface TypeStyle {
  size: number;
  leading: number;
  /** jsPDF setCharSpace value, in points. 0 = no extra tracking. */
  tracking: number;
  weight: "normal" | "bold" | "italic" | "bolditalic";
}

export const TYPE_SCALE: Record<TypeRole, TypeStyle> = {
  name: { size: 21, leading: 25.5, tracking: 0.6, weight: "bold" },
  headline: { size: 10.5, leading: 13.5, tracking: 0, weight: "normal" },
  contact: { size: 9, leading: 12, tracking: 0, weight: "normal" },
  section: { size: 9, leading: 12, tracking: 0.9, weight: "bold" },
  entry: { size: 11, leading: 15, tracking: 0, weight: "bold" },
  meta: { size: 8.25, leading: 10.5, tracking: 0.15, weight: "normal" },
  body: { size: 10, leading: 13.5, tracking: 0, weight: "normal" },
  micro: { size: 7.5, leading: 9, tracking: 0.3, weight: "normal" },
};

/** Extra tracking applied to `name` when the template renders it uppercase. */
export const UPPERCASE_NAME_EXTRA_TRACKING = 0.6;

export type SpacingRole = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

export const SPACING: Record<SpacingRole, number> = {
  xs: 3,
  sm: 4.5,
  md: 7.5,
  lg: 12,
  xl: 18,
  xxl: 24,
};

export type TemplateDensity = "compact" | "normal" | "airy";

export const DENSITY_MULTIPLIER: Record<TemplateDensity, number> = {
  compact: 0.85,
  normal: 1.0,
  airy: 1.2,
};

/** Applies a template's density multiplier to a spacing value. Leading is never scaled. */
export function spacing(role: SpacingRole, density: TemplateDensity): number {
  return SPACING[role] * DENSITY_MULTIPLIER[density];
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** One print palette. No green/amber/red — the design system reserves that ramp
 * for completed/error states, never a continuous score, and a resume isn't an
 * app screen anyway. */
export const PALETTE = {
  ink: { r: 26, g: 29, b: 46 } as RGB,
  body: { r: 58, g: 62, b: 82 } as RGB,
  muted: { r: 120, g: 126, b: 145 } as RGB,
  rule: { r: 206, g: 209, b: 222 } as RGB,
  brand: { r: 74, g: 85, b: 199 } as RGB,
  white: { r: 255, g: 255, b: 255 } as RGB,
};
