/**
 * Toko — the ninelab toucan.
 *
 * Every render of the character goes through here, so replacing the artwork
 * later is a one-file change rather than a hunt through six components.
 *
 * `head` is the real 3D render (`/toko/toko-head.png`), the full head+collar
 * bust cleaned of the checkerboard the source export baked in as flattened
 * pixels rather than real alpha — see scripts/dechecker.mjs for how. Keeps
 * the neck and collar rather than cropping to head+beak alone: an earlier
 * crop cut straight through the neck to save space at small render sizes,
 * which read as the character being decapitated rather than compact.
 *
 * `hero`/`shrug`/`think`/`cheer` are all real busts too, sliced from one
 * generated 2x2 pose sheet (scripts/dechecker-grid.mjs) and put through the
 * same alpha recovery. Gesture on each is carried only by head tilt, eyes,
 * mouth and a gloved arm — this character has no established full body, so
 * asking a generator for one (crossed arms, standing full-figure) just
 * regenerates the familiar head shot instead of inventing new anatomy.
 *
 * Poses are still optional assets: if a PNG is ever missing, the component
 * falls back to the head rather than rendering a broken image.
 */
import { useState } from "react";

export type TokoPose = "head" | "hero" | "shrug" | "think" | "cheer";

const POSE_SRC: Record<TokoPose, string> = {
  head: "/toko/toko-head.png",
  hero: "/toko/toko-hero.png",
  shrug: "/toko/toko-shrug.png",
  think: "/toko/toko-think.png",
  cheer: "/toko/toko-cheer.png",
};

interface TokoProps {
  pose?: TokoPose;
  /** Rendered width in px. Height follows the asset's own aspect ratio. */
  size?: number;
  className?: string;
  /**
   * Only pass this when Toko is the sole carrier of meaning. In every current
   * usage he sits beside a text label, so the default empty alt is correct and
   * keeps screen readers from announcing him twice.
   */
  alt?: string;
  /** The landing hero is above the fold; everything else can defer. */
  priority?: boolean;
}

export function Toko({ pose = "head", size = 32, className, alt = "", priority = false }: TokoProps) {
  const [failed, setFailed] = useState(false);
  const src = failed ? POSE_SRC.head : POSE_SRC[pose];

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      // Width is authoritative; height:auto lets a full-body pose keep its own
      // ratio instead of being squashed into the square the head assumes.
      style={{ width: size, height: "auto" }}
    />
  );
}
