/**
 * Generates the PWA icon set for artifacts/ninelab from a single source mark.
 *
 * Run: node scripts/generate-icons.mjs
 *
 * The mark is Toko, the ninelab toucan, composited onto brand indigo. The
 * source is the real 3D render at public/toko/toko-head.png (cropped to the
 * neckline, alpha recovered by scripts/dechecker.mjs) — the same file the
 * React <Toko> component renders, so the icon and the in-app avatar can never
 * drift apart.
 *
 * Three compositions, because each platform masks icons differently:
 *
 *   pwa-192 / pwa-512     rounded-rect background, drawn by us. Used where the
 *                         platform shows the icon as-authored.
 *   pwa-maskable-512      full-bleed square with Toko shrunk into the centre.
 *                         Android crops maskable icons to a shape of its
 *                         choosing (circle, squircle, teardrop) and only
 *                         guarantees the middle 80% survives, so the beak has
 *                         to clear that margin or it gets sliced off — and the
 *                         beak is the entire reason the mark is recognisable.
 *   apple-touch-icon      full-bleed square, square corners, no alpha. iOS
 *                         applies its own squircle mask and renders any
 *                         transparency as black.
 *   favicon               small rounded plate, same treatment as pwa-192.
 */
import sharp from "sharp";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "artifacts/ninelab/public");
const markPath = path.join(publicDir, "toko/toko-head.png");

/** Brand indigo — must stay in sync with --color-brand in src/index.css. */
const BRAND = "#4A55C7";

/** Solid brand background at `size`, with optional corner rounding. */
function background(size, radius) {
  const rect =
    radius > 0
      ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>`
      : `<rect width="${size}" height="${size}" fill="${BRAND}"/>`;
  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${rect}</svg>`,
  );
}

/**
 * Renders Toko at `markSize` and centres him on a brand plate.
 *
 * `markRatio` is the fraction of the plate the character occupies. The
 * maskable variant uses a smaller ratio so the beak stays inside Android's
 * 80% safe circle; the others can run larger because nothing crops them.
 */
async function compose({ file, size, radius, markRatio, flatten }) {
  const markSize = Math.round(size * markRatio);
  const mark = await sharp(readFileSync(markPath))
    .resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  let pipeline = sharp(background(size, radius)).composite([
    { input: mark, gravity: "centre" },
  ]);
  // iOS renders an alpha channel as black, so that one icon must be flattened.
  // The others keep transparency so the rounded corners we drew survive.
  if (flatten) pipeline = pipeline.flatten({ background: BRAND });

  const out = path.join(publicDir, file);
  await pipeline.png().toFile(out);
  console.log(`wrote ${path.relative(root, out)} (${size}x${size})`);
}

const targets = [
  { file: "pwa-192x192.png", size: 192, radius: 43, markRatio: 0.78, flatten: false },
  { file: "pwa-512x512.png", size: 512, radius: 114, markRatio: 0.78, flatten: false },
  // 0.62 keeps the beak tip well inside the 80% safe circle Android guarantees.
  { file: "pwa-maskable-512x512.png", size: 512, radius: 0, markRatio: 0.62, flatten: false },
  { file: "apple-touch-icon.png", size: 180, radius: 0, markRatio: 0.78, flatten: true },
  { file: "favicon.png", size: 64, radius: 14, markRatio: 0.78, flatten: false },
];

for (const t of targets) {
  await compose(t);
}
