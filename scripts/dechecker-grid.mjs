/**
 * Same alpha-recovery pipeline as dechecker.mjs, applied to the 2x2 pose grid,
 * then sliced into four individual pose PNGs.
 *
 * Run: node scripts/dechecker-grid.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(
  "C:/Users/asusv/AppData/Local/Temp/claude/C--Users-asusv-OneDrive-Desktop-yc/d4596f64-56f5-4cea-a0b1-a55d55566366/scratchpad",
  "toko-pose-grid.png",
);
const publicDir = path.join(root, "artifacts/ninelab/public/toko");

const SPREAD_THRESHOLD = 3;
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

// ── 1b. enclosed background pockets (open mouths, gaps between raised arms) ──
// Border flood fill misses checkerboard-coloured regions fully surrounded by
// character pixels, e.g. the visible background showing through an open beak.
// Those are real holes, not character, and must also go transparent. But an
// eye's white specular highlight is ALSO an enclosed, exactly-achromatic
// pixel blob, so "enclosed + achromatic" alone would punch a hole in every
// eye. Measuring actual enclosed islands in this image found a clean size
// gap: five islands of 890-2124px (real holes: open mouths, arm/body gaps)
// vs everything else at 339px and below (highlight specks, button glints).
// 500 sits in that gap.
const ENCLOSED_HOLE_MIN_SIZE = 500;
const isBgColor = new Uint8Array(N);
for (let p = 0; p < N; p++) {
  const i = p * channels;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (Math.max(r, g, b) - Math.min(r, g, b) <= SPREAD_THRESHOLD) isBgColor[p] = 1;
}
const encVisited = new Uint8Array(N);
let enclosedFilled = 0;
for (let start = 0; start < N; start++) {
  if (encVisited[start] || isBg[start] || !isBgColor[start]) continue;
  const q = [start];
  encVisited[start] = 1;
  const island = [start];
  while (q.length) {
    const p = q.pop();
    const x = p % width, y = (p / width) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const np = ny * width + nx;
      if (!encVisited[np] && !isBg[np] && isBgColor[np]) {
        encVisited[np] = 1;
        q.push(np);
        island.push(np);
      }
    }
  }
  if (island.length < ENCLOSED_HOLE_MIN_SIZE) continue;
  // One island in this specific source image is a false positive: a low-
  // saturation shading band under the hero pose's jaw/collar (measured
  // bounding box x:202-377 y:284-325), not a real gap. Filling it disconnects
  // the hero bust into a head fragment and a body fragment. Genuine holes
  // (open mouths, gaps between a raised arm and the body) sit elsewhere in
  // the grid, so this one region is excluded by its measured location rather
  // than by a size/shape rule that can't tell the two apart.
  const cx = island.reduce((s, p) => s + (p % width), 0) / island.length;
  const cy = island.reduce((s, p) => s + ((p / width) | 0), 0) / island.length;
  if (cx >= 150 && cx <= 400 && cy >= 260 && cy <= 340) {
    console.log(`skipped false-positive island at (${cx.toFixed(0)},${cy.toFixed(0)}), size ${island.length}`);
    continue;
  }
  for (const p of island) isBg[p] = 1;
  enclosedFilled += island.length;
}
console.log(`enclosed holes: filled ${enclosedFilled}px as background`);

// ── 2. erode via Chebyshev distance transform ────────────────────────────────
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

// ── 3. feather ────────────────────────────────────────────────────────────────
for (let p = 0; p < N; p++) {
  const d = dist[p];
  let a;
  if (d <= ERODE) a = 0;
  else if (d >= ERODE + 1) a = 255;
  else a = Math.round((d - ERODE) * 255);
  data[p * channels + 3] = a;
}

// ── 4. drop isolated specks, but keep the four largest components ───────────
// Four separate poses means four separate blobs, not one — keep the top 4
// components by size instead of only the single largest.
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
const ranked = compSize.map((size, id) => ({ id, size })).sort((a, b) => b.size - a.size);
const keep = new Set(ranked.slice(0, 4).map((c) => c.id));
let dropped = 0;
for (let p = 0; p < N; p++) {
  if (compId[p] !== -1 && !keep.has(compId[p])) {
    data[p * channels + 3] = 0;
    dropped++;
  }
}
console.log(`components: ${compSize.length}, kept top 4 (sizes ${ranked.slice(0, 4).map((c) => c.size).join(", ")}), dropped ${dropped}px`);

const recovered = sharp(data, { raw: { width, height, channels } }).png();
const recoveredBuffer = await recovered.toBuffer();

// ── 5. locate the four bounding boxes from the four kept components ─────────
const boxes = ranked.slice(0, 4).map(() => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }));
const idToBoxIndex = new Map(ranked.slice(0, 4).map((c, i) => [c.id, i]));
for (let p = 0; p < N; p++) {
  const id = compId[p];
  if (id === -1 || !idToBoxIndex.has(id)) continue;
  const box = boxes[idToBoxIndex.get(id)];
  const x = p % width, y = (p / width) | 0;
  if (x < box.minX) box.minX = x;
  if (x > box.maxX) box.maxX = x;
  if (y < box.minY) box.minY = y;
  if (y > box.maxY) box.maxY = y;
}

// Sort boxes into reading order (top-left, top-right, bottom-left, bottom-right)
// by quadrant of their centre, not by component size.
const withCentre = boxes.map((b) => ({ ...b, cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2 }));
const midX = width / 2, midY = height / 2;
const order = ["hero", "shrug", "think", "cheer"];
const quadrantOf = (b) => (b.cy < midY ? 0 : 2) + (b.cx < midX ? 0 : 1);
const byQuadrant = new Array(4);
for (const b of withCentre) byQuadrant[quadrantOf(b)] = b;

const PAD = 24;
for (let i = 0; i < 4; i++) {
  const b = byQuadrant[i];
  if (!b) {
    console.log(`quadrant ${i} (${order[i]}): no component found, skipping`);
    continue;
  }
  const left = Math.max(0, Math.floor(b.minX) - PAD);
  const top = Math.max(0, Math.floor(b.minY) - PAD);
  const w = Math.min(width - left, Math.ceil(b.maxX - b.minX) + PAD * 2);
  const h = Math.min(height - top, Math.ceil(b.maxY - b.minY) + PAD * 2);
  const out = path.join(publicDir, `toko-${order[i]}.png`);
  await sharp(recoveredBuffer)
    .extract({ left, top, width: w, height: h })
    .resize(768, 768, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`wrote ${path.relative(root, out)} from box [${left},${top},${w},${h}]`);
}
