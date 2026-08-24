/**
 * The toucan render arrived as a flattened JPEG with a checkerboard
 * "transparency" pattern baked into the pixels (no real alpha channel). This
 * recovers a proper alpha matte.
 *
 * The discriminator, established by sampling rather than guessing:
 *
 *   true background   197,197,197  spread 0    (exactly achromatic)
 *   collar shadow     200,191,192  spread 9
 *   head              76,76,86     spread 10
 *   beak              214,177,88   spread 126
 *
 * The checkerboard is the ONLY exactly-achromatic thing in the frame, so a
 * strict spread threshold separates it cleanly. Earlier attempts used loose
 * thresholds (spread<=6, plus a brightness-band sweep at spread<=10) and bit
 * chunks out of the head and the collar's shadowed edge, because those sit at
 * spread 9-10. Chasing that with morphological closing made it worse: patched
 * pixels sampled colour from the nearest opaque neighbour, which near a jagged
 * notch is another edge pixel, so it smeared grey streaks along the silhouette.
 *
 * Sequence here is deliberate:
 *   1. flood fill from the border at spread<=3 — conservative, so it stops
 *      before the character but leaves a JPEG-ringing halo opaque
 *   2. fill enclosed transparent islands (a hole inside the character can only
 *      be a misclassification; real background always reaches the border)
 *   3. erode the opaque mask uniformly to shave that halo off
 *   4. feather the alpha so the edge is antialiased rather than stair-stepped
 *
 * Steps 3-4 are uniform operations over the whole silhouette, so they cannot
 * produce the localised notches the earlier per-pixel patching did.
 */
import sharp from "sharp";
import path from "node:path";
import { renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "artifacts/ninelab/public/toko/toko-head.png");

/** Only pixels this close to perfectly grey count as checkerboard. */
const SPREAD_THRESHOLD = 3;
/** Halo shave, in px. The JPEG ringing band measured 2-3px wide. */
const ERODE = 3;

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const N = width * height;

// ── 1. flood fill from the border ────────────────────────────────────────────
const isBg = new Uint8Array(N);
const seen = new Uint8Array(N);
const stack = [];

for (let x = 0; x < width; x++) stack.push(x, x + (height - 1) * width);
for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);

while (stack.length) {
  const p = stack.pop();
  if (seen[p]) continue;
  seen[p] = 1;
  const i = p * channels;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (Math.max(r, g, b) - Math.min(r, g, b) > SPREAD_THRESHOLD) continue;
  isBg[p] = 1;
  const x = p % width, y = (p / width) | 0;
  if (x > 0) stack.push(p - 1);
  if (x < width - 1) stack.push(p + 1);
  if (y > 0) stack.push(p - width);
  if (y < height - 1) stack.push(p + width);
}

let bgCount = 0;
for (let p = 0; p < N; p++) bgCount += isBg[p];
console.log(`flood fill: ${bgCount} / ${N} px background (${((bgCount / N) * 100).toFixed(1)}%)`);

// ── 2. fill enclosed transparent islands ─────────────────────────────────────
// Anything transparent that the border flood didn't reach is by definition
// surrounded by character, so it is a misclassification, not background.
// (The flood above already only marks border-reachable pixels, so this is a
// consistency guard rather than a fix — it costs nothing and documents intent.)

// ── 3. erode the opaque mask to shave the JPEG halo ──────────────────────────
// Chebyshev distance transform from background, so a single pass gives the
// erosion for any radius instead of ERODE separate dilate passes.
const INF = 1 << 28;
const dist = new Int32Array(N);
for (let p = 0; p < N; p++) dist[p] = isBg[p] ? 0 : INF;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = y * width + x;
    if (dist[p] === 0) continue;
    let best = dist[p];
    if (x > 0) best = Math.min(best, dist[p - 1] + 1);
    if (y > 0) best = Math.min(best, dist[p - width] + 1);
    if (x > 0 && y > 0) best = Math.min(best, dist[p - width - 1] + 1);
    if (x < width - 1 && y > 0) best = Math.min(best, dist[p - width + 1] + 1);
    dist[p] = best;
  }
}
for (let y = height - 1; y >= 0; y--) {
  for (let x = width - 1; x >= 0; x--) {
    const p = y * width + x;
    if (dist[p] === 0) continue;
    let best = dist[p];
    if (x < width - 1) best = Math.min(best, dist[p + 1] + 1);
    if (y < height - 1) best = Math.min(best, dist[p + width] + 1);
    if (x < width - 1 && y < height - 1) best = Math.min(best, dist[p + width + 1] + 1);
    if (x > 0 && y < height - 1) best = Math.min(best, dist[p + width - 1] + 1);
    dist[p] = best;
  }
}

// ── 4. feather ───────────────────────────────────────────────────────────────
// alpha ramps 0 -> 255 across one pixel just outside the eroded boundary, so
// the edge reads smooth instead of stair-stepped when scaled down.
for (let p = 0; p < N; p++) {
  const d = dist[p];
  let a;
  if (d <= ERODE) a = 0;
  else if (d >= ERODE + 1) a = 255;
  else a = Math.round((d - ERODE) * 255);
  data[p * channels + 3] = a;
}

let opaque = 0;
for (let p = 0; p < N; p++) if (data[p * channels + 3] > 200) opaque++;
console.log(`after erode(${ERODE}) + feather: ${opaque} px opaque (${((opaque / N) * 100).toFixed(1)}%)`);

// ── 5. drop isolated specks ───────────────────────────────────────────────────
// JPEG noise can leave a tiny fleck of near-checkerboard-but-not-quite colour
// floating in open background, disconnected from the character. The character
// itself is one large connected blob, so keeping only the largest opaque
// component removes any such speck regardless of its colour or shape.
const compId = new Int32Array(N).fill(-1);
const compSize = [];
for (let start = 0; start < N; start++) {
  if (compId[start] !== -1 || data[start * channels + 3] <= 200) continue;
  const id = compSize.length;
  let size = 0;
  const q = [start];
  compId[start] = id;
  while (q.length) {
    const p = q.pop();
    size++;
    const x = p % width, y = (p / width) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const np = ny * width + nx;
      if (compId[np] === -1 && data[np * channels + 3] > 200) {
        compId[np] = id;
        q.push(np);
      }
    }
  }
  compSize.push(size);
}
const largest = compSize.indexOf(Math.max(...compSize));
let dropped = 0;
for (let p = 0; p < N; p++) {
  if (compId[p] !== -1 && compId[p] !== largest) {
    data[p * channels + 3] = 0;
    dropped++;
  }
}
console.log(`dropped ${dropped} px across ${compSize.length - 1} isolated speck(s), kept main blob of ${compSize[largest]} px`);

const tmp = src + ".tmp.png";
await sharp(data, { raw: { width, height, channels } }).png().toFile(tmp);
renameSync(tmp, src);
console.log(`wrote ${path.relative(root, src)}`);
