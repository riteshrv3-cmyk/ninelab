/**
 * Alpha recovery for the four single-pose renders. Same core pipeline as
 * dechecker.mjs (strict achromatic threshold -> flood fill -> uniform erode ->
 * feather -> keep main blob), plus enclosed-hole handling for open mouths.
 *
 * Enclosed islands (background-coloured but not border-reachable) are real
 * holes only if they contain the checkerboard PATTERN — alternating light and
 * dark squares, i.e. a bimodal luminance mix. An eye's white highlight is also
 * achromatic and enclosed, but it is uniformly bright. So: fill an island as
 * background only when it holds a meaningful share of BOTH dark (<215) and
 * light (>240) pixels. That classifies by what the checkerboard actually looks
 * like instead of by size, which broke on the grid pass.
 *
 * Run: node scripts/dechecker-batch.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "artifacts/ninelab/public/toko");

// Background needs BOTH tests, measured across all four files:
//
//                      spread            luminance
//   checkerboard bg    0-17              147-255
//   black head/gloves  low (achromatic)  0-110
//   cream jacket       24-29             ~230
//
// Spread alone is not enough. The first toucan export had a spread-0 background
// and a spread-10 head, so dechecker.mjs could separate them on spread alone.
// These four compress harder: the background reaches spread 17, which overlaps
// the black head — raising the spread threshold to cover the background erased
// the entire head. Luminance is what actually separates those two, since the
// background never goes below 147 and the dark head never exceeds 110.
// Meanwhile the cream jacket is bright like the background, so spread is what
// separates THAT pair. Hence both, not either.
// The spread threshold is measured per file, not fixed. These four renders
// compress differently: the true background tops out at spread 9 in
// toko-hero but 17 in toko-cheer. A single value tuned for the worst file
// cuts into the others — at 18, toko-hero lost the shadowed jacket around the
// glove, which sits at spread 9-17. So each file derives its own threshold
// from its own border ring, which is background by definition.
const LUM_MIN = 130;
// Lower than dechecker.mjs's 3: the looser spread threshold already catches
// most of the light-blended edge pixels, so less shaving is needed.
const ERODE = 2;
const HOLE_MIN = 200;
/**
 * Silhouette bays narrower than 2x this get filled back in. 12 covers the
 * widest shadowed-jacket notch seen (toko-cheer's left side) while staying
 * well under the real gaps between a raised arm and the body, which run 50px+.
 */
const CLOSE = 12;
/** How many outer pixel layers get their colour pulled in from inside. */
const DEFRINGE = 3;

async function process(name) {
  const src = path.join(dir, name);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const N = width * height;

  const spreadOf = (p) => {
    const i = p * channels;
    return Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
  };
  const lumOf = (p) => {
    const i = p * channels;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };

  // Derive this file's spread threshold from its own outer ring, which is
  // background by definition. +1 gives a little margin without reaching the
  // shadowed jacket, which starts around spread 9 and is the nearest
  // character tone.
  // A percentile, not the max: a handful of JPEG-noise pixels in the ring push
  // the max several points above the bulk of the background, and that slack is
  // exactly what eats into shadowed jacket. Stragglers above the percentile stay
  // opaque but end up as tiny isolated blobs, which the keep-largest-component
  // step below discards anyway.
  const RING = 8;
  const ringSpreads = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= RING && y >= RING && x < width - RING && y < height - RING) continue;
      ringSpreads.push(spreadOf(y * width + x));
    }
  }
  ringSpreads.sort((a, b) => a - b);
  const spreadThreshold = Math.min(20, ringSpreads[Math.floor(ringSpreads.length * 0.995)] + 1);

  const spreadOk = new Uint8Array(N); // achromatic AND light => background-like
  for (let p = 0; p < N; p++) {
    if (spreadOf(p) <= spreadThreshold && lumOf(p) >= LUM_MIN) spreadOk[p] = 1;
  }

  // border flood fill
  const isBg = new Uint8Array(N);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, x + (height - 1) * width);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length) {
    const p = stack.pop();
    if (isBg[p] || !spreadOk[p]) continue;
    isBg[p] = 1;
    const x = p % width, y = (p / width) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }

  // enclosed islands: fill only if the checkerboard pattern (bimodal) is present
  const visited = new Uint8Array(N);
  let holes = 0;
  for (let start = 0; start < N; start++) {
    if (visited[start] || isBg[start] || !spreadOk[start]) continue;
    const island = [start];
    visited[start] = 1;
    for (let qi = 0; qi < island.length; qi++) {
      const p = island[qi];
      const x = p % width, y = (p / width) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const np = ny * width + nx;
        if (!visited[np] && !isBg[np] && spreadOk[np]) { visited[np] = 1; island.push(np); }
      }
    }
    if (island.length < HOLE_MIN) continue;
    let dark = 0, light = 0;
    for (const p of island) {
      const lum = (data[p * channels] + data[p * channels + 1] + data[p * channels + 2]) / 3;
      if (lum < 215) dark++;
      else if (lum > 240) light++;
    }
    const frac = (n) => n / island.length;
    if (frac(dark) > 0.15 && frac(light) > 0.15) {
      for (const p of island) isBg[p] = 1;
      holes += island.length;
    }
  }

  // Chebyshev distance transform from a binary seed mask, two passes.
  const INF = 1 << 28;
  const distanceFrom = (seed) => {
    const d = new Int32Array(N);
    for (let p = 0; p < N; p++) d[p] = seed[p] ? 0 : INF;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!d[p]) continue;
      let b = d[p];
      if (x > 0) b = Math.min(b, d[p - 1] + 1);
      if (y > 0) b = Math.min(b, d[p - width] + 1);
      if (x > 0 && y > 0) b = Math.min(b, d[p - width - 1] + 1);
      if (x < width - 1 && y > 0) b = Math.min(b, d[p - width + 1] + 1);
      d[p] = b;
    }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      if (!d[p]) continue;
      let b = d[p];
      if (x < width - 1) b = Math.min(b, d[p + 1] + 1);
      if (y < height - 1) b = Math.min(b, d[p + width] + 1);
      if (x < width - 1 && y < height - 1) b = Math.min(b, d[p + width + 1] + 1);
      if (x > 0 && y < height - 1) b = Math.min(b, d[p + width - 1] + 1);
      d[p] = b;
    }
    return d;
  };

  // Close small bays bitten out of the silhouette. Specular highlights on the
  // cream jacket wash out to near-white with low spread, so where such a
  // highlight touches the outer edge the flood fill walks a few pixels into
  // the jacket and leaves a ragged notch. Dilating the character by CLOSE and
  // eroding back fills any bay narrower than 2*CLOSE while leaving the real
  // gaps (between a raised arm and the body) untouched, since those are far
  // wider.
  //
  // This is safe here in a way the earlier attempt on the head image was not:
  // that one rebuilt COLOUR for patched pixels by sampling neighbours, which
  // smeared grey streaks along the edge. Here only ALPHA changes — the RGB
  // under these pixels is already the correct jacket colour.
  const character = new Uint8Array(N);
  for (let p = 0; p < N; p++) character[p] = isBg[p] ? 0 : 1;
  const toCharacter = distanceFrom(character);
  const dilated = new Uint8Array(N);
  for (let p = 0; p < N; p++) dilated[p] = toCharacter[p] <= CLOSE ? 1 : 0;
  const outsideDilated = new Uint8Array(N);
  for (let p = 0; p < N; p++) outsideDilated[p] = dilated[p] ? 0 : 1;
  const toOutside = distanceFrom(outsideDilated);
  for (let p = 0; p < N; p++) isBg[p] = toOutside[p] > CLOSE ? 0 : 1;

  const dist = distanceFrom(isBg);

  // Defringe. The render was shot against a LIGHT checkerboard, so every
  // antialiased edge pixel is a blend of character colour and light grey.
  // Cutting a hard alpha leaves that blend behind, and on the dark indigo
  // landing background it reads as a white halo tracing the whole silhouette —
  // the single most obvious quality problem in the rendered page. Measured on
  // the black head, luminance runs ~147 at the outermost pixel and settles
  // near ~128 by three pixels in, so the contamination is about three pixels
  // deep.
  //
  // Eroding three more pixels would remove it but visibly thins the beak, so
  // instead each contaminated layer takes the colour of the clean layer just
  // inside it, working outward. Only RGB moves; alpha and the silhouette shape
  // are untouched. This differs from the failed attempt on the head image,
  // which invented colour for large removed REGIONS by sampling whatever
  // neighbour was nearest — along a jagged boundary that was another edge
  // pixel, so the error compounded into grey streaks. Here the band is three
  // pixels, and every source pixel is interior and already correct.
  const inner = ERODE + 1;
  for (let layer = inner + DEFRINGE - 1; layer >= inner; layer--) {
    const fixed = [];
    for (let p = 0; p < N; p++) {
      if (dist[p] !== layer) continue;
      const x = p % width, y = (p / width) | 0;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const np = ny * width + nx;
        if (dist[np] <= layer) continue; // only pull from deeper, cleaner pixels
        r += data[np * channels];
        g += data[np * channels + 1];
        b += data[np * channels + 2];
        n++;
      }
      if (n) fixed.push([p, Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
    }
    for (const [p, r, g, b] of fixed) {
      data[p * channels] = r;
      data[p * channels + 1] = g;
      data[p * channels + 2] = b;
    }
  }

  // erode + feather
  for (let p = 0; p < N; p++) {
    const d = dist[p];
    data[p * channels + 3] = d <= ERODE ? 0 : d >= ERODE + 1 ? 255 : Math.round((d - ERODE) * 255);
  }

  // keep largest opaque component
  const compId = new Int32Array(N).fill(-1);
  const sizes = [];
  for (let start = 0; start < N; start++) {
    if (compId[start] !== -1 || data[start * channels + 3] <= 200) continue;
    const id = sizes.length;
    const q = [start];
    compId[start] = id;
    let size = 0;
    while (q.length) {
      const p = q.pop();
      size++;
      const x = p % width, y = (p / width) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const np = ny * width + nx;
        if (compId[np] === -1 && data[np * channels + 3] > 200) { compId[np] = id; q.push(np); }
      }
    }
    sizes.push(size);
  }
  const largest = sizes.indexOf(Math.max(...sizes));
  for (let p = 0; p < N; p++) {
    if (compId[p] !== -1 && compId[p] !== largest) data[p * channels + 3] = 0;
  }

  const tmp = src + ".tmp.png";
  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(tmp);
  renameSync(tmp, src);
  console.log(`${name}: spread<=${spreadThreshold}, holes filled ${holes}px, main blob ${sizes[largest]}px`);
}

for (const f of ["toko-hero.png", "toko-shrug.png", "toko-think.png", "toko-cheer.png"]) {
  await process(f);
}
