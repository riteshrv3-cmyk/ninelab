import { describe, expect, it } from "vitest";
import { buildQualityReport } from "../src/quality";
import { mediocre } from "./fixtures/mediocre";
import { strong } from "./fixtures/strong";
import { weak } from "./fixtures/weak";

describe("golden fixture bands", () => {
  it("weak lands in [20, 40] with 6+ auto-fixable failures", () => {
    const r = buildQualityReport(weak);
    expect(r.total).toBeGreaterThanOrEqual(20);
    expect(r.total).toBeLessThanOrEqual(40);
    const autoFixable = r.rules.filter((x) => !x.passed && x.autoFixable);
    expect(autoFixable.length).toBeGreaterThanOrEqual(6);
  });

  it("weak fails at least 3 sub-scores below 50%", () => {
    const r = buildQualityReport(weak);
    const below = Object.values(r.subScores).filter((s) => s.pct < 50);
    expect(below.length).toBeGreaterThanOrEqual(3);
  });

  it("weak flags its archetype failures", () => {
    const failing = buildQualityReport(weak).rules.filter((r) => !r.passed).map((r) => r.id);
    for (const id of ["IMP-01", "IMP-02", "BRV-01", "STY-03", "STY-05", "STY-06", "STY-08", "CMP-02", "CMP-04", "CMP-05", "CMP-06", "ATS-03"]) {
      expect(failing).toContain(id);
    }
  });

  it("mediocre lands in [50, 70]", () => {
    const r = buildQualityReport(mediocre);
    expect(r.total).toBeGreaterThanOrEqual(50);
    expect(r.total).toBeLessThanOrEqual(70);
  });

  it("strong lands at 85+", () => {
    const r = buildQualityReport(strong);
    expect(r.total).toBeGreaterThanOrEqual(85);
  });

  it("bands are strictly ordered", () => {
    const w = buildQualityReport(weak).total;
    const m = buildQualityReport(mediocre).total;
    const s = buildQualityReport(strong).total;
    expect(w).toBeLessThan(m);
    expect(m).toBeLessThan(s);
  });

  it("sub-score maxima sum to 100", () => {
    const r = buildQualityReport(strong);
    const sum = Object.values(r.subScores).reduce((n, s) => n + s.max, 0);
    expect(sum).toBe(100);
  });

  it("bulletStats counts quantified bullets", () => {
    const r = buildQualityReport(strong);
    expect(r.bulletStats.total).toBe(7);
    expect(r.bulletStats.quantified).toBe(7);
  });
});
