/**
 * Runtime polyfills for browser APIs that our dependencies assume but older
 * browsers lack.
 *
 * Math.sumPrecise (TC39 Stage 4, Chrome 137+ / Safari 18.4+ / Node 24+) is
 * called by pdfjs-dist v6 during PDF rendering. Students on older Chrome,
 * Safari, or in-app webviews (very common on budget Android phones in India)
 * would otherwise hit "Math.sumPrecise is not a function" and the resume PDF
 * preview would fail to render. We install a Kahan-Neumaier summation, which is
 * precise enough for pdf.js geometry and matches the spec's edge-case handling
 * for empty input, non-finite values, and signed zero.
 */
export function installPolyfills(): void {
  const M = Math as unknown as { sumPrecise?: (values: Iterable<number>) => number };
  if (typeof M.sumPrecise === "function") return;

  M.sumPrecise = function sumPrecise(values: Iterable<number>): number {
    let sum = 0;
    let compensation = 0; // running compensation for lost low-order bits
    let sawInfinity = 0; // +1 for +Inf, -1 for -Inf, 2 once both are seen
    let count = 0;

    for (const raw of values) {
      const v = Number(raw);
      if (Number.isNaN(v)) return NaN;
      count++;
      if (!Number.isFinite(v)) {
        if (v === Infinity) sawInfinity = sawInfinity === -1 ? 2 : 1;
        else sawInfinity = sawInfinity === 1 ? 2 : -1;
        continue;
      }
      const t = sum + v;
      compensation += Math.abs(sum) >= Math.abs(v) ? sum - t + v : v - t + sum;
      sum = t;
    }

    if (sawInfinity === 2) return NaN; // +Inf and -Inf together
    if (sawInfinity === 1) return Infinity;
    if (sawInfinity === -1) return -Infinity;
    if (count === 0) return -0; // spec: sum of no values is -0
    return sum + compensation;
  };
}
