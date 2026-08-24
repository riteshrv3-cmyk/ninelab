import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "artifacts/ninelab/public/toko");

// How far does the light-background contamination reach inward from the
// silhouette edge? Walk inward along the top of the black head, where the true
// colour is dark and uniform, so any elevated luminance is contamination.
const { data, info } = await sharp(path.join(dir, "toko-hero.png"))
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const A = (p) => data[p * channels + 3];
const lum = (p) => (data[p * channels] + data[p * channels + 1] + data[p * channels + 2]) / 3;

// Scan columns across the top of the head; for each, walk down from the first
// opaque pixel and record luminance at each depth.
const depths = new Map();
for (let x = 380; x < 700; x += 2) {
  let firstOpaque = -1;
  for (let y = 0; y < height; y++) {
    const p = y * width + x;
    if (A(p) > 200) { firstOpaque = y; break; }
  }
  if (firstOpaque < 0) continue;
  for (let d = 0; d < 12; d++) {
    const p = (firstOpaque + d) * width + x;
    if (A(p) <= 200) break;
    if (!depths.has(d)) depths.set(d, []);
    depths.get(d).push(lum(p));
  }
}
console.log("depth from edge -> mean luminance on the BLACK head (true value ~60-80)");
for (let d = 0; d < 12; d++) {
  const a = depths.get(d) || [];
  if (!a.length) continue;
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  console.log("  depth", String(d).padStart(2), "n=" + String(a.length).padStart(4), "mean lum", mean.toFixed(1));
}
