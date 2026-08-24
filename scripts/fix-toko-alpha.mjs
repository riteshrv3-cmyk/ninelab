/**
 * Clean the alpha channel on every Toko pose PNG.
 *
 * The existing PNGs already have proper transparency (the dechecker ran), but
 * there is a JPEG-ringing halo of semi-transparent gray pixels just outside
 * the silhouette. On a white background these are invisible; on the blue
 * landing-page background they show as a ghostly rectangle.
 *
 * Fix: clamp alpha so anything below 20 becomes 0 (kills the halo), apply a
 * one-step taper from 20-180, then crop tight to the actual character bounds
 * and re-centre in the same canvas with 24px padding.
 *
 * Run: node scripts/fix-toko-alpha.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "artifacts/ninelab/public/toko");

const POSES = ["toko-head", "toko-hero", "toko-shrug", "toko-think", "toko-cheer"];
const PAD = 24;

for (const name of POSES) {
  const file = path.join(dir, `${name}.png`);

  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const N = width * height;

  // 1. Clamp alpha: below 20 → 0; 20-180 → linear ramp to 255; above 180 → 255.
  //    This kills the halo (near-zero alpha) without touching real character pixels.
  for (let p = 0; p < N; p++) {
    const ai = p * channels + 3;
    const a = data[ai];
    if (a < 20) {
      data[ai] = 0;
    } else if (a < 180) {
      data[ai] = Math.round(((a - 20) / 160) * 255);
    } else {
      data[ai] = 255;
    }
  }

  // 2. Find tight bounding box of pixels with alpha > 10 after clamping.
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let p = 0; p < N; p++) {
    if (data[p * channels + 3] > 10) {
      const x = p % width;
      const y = (p / width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    console.log(`${name}: no opaque pixels found, skipping`);
    continue;
  }

  // 3. Crop to bounds + PAD, clamped to image edges.
  const left = Math.max(0, minX - PAD);
  const top  = Math.max(0, minY - PAD);
  const cw   = Math.min(width  - left, (maxX - minX + 1) + PAD * 2);
  const ch   = Math.min(height - top,  (maxY - minY + 1) + PAD * 2);

  // 4. Write cleaned file in place.
  const tmp = file + ".tmp.png";
  await sharp(data, { raw: { width, height, channels } })
    .extract({ left, top, width: cw, height: ch })
    .png({ compressionLevel: 9 })
    .toFile(tmp);

  const { rename } = await import("node:fs/promises");
  await rename(tmp, file);

  console.log(`${name}: cleaned (${width}x${height} → ${cw}x${ch}, halo removed)`);
}

console.log("done");
