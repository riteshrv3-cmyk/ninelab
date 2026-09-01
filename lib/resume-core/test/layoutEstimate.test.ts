import { describe, expect, it } from "vitest";
import { estimateLayout } from "../src/layoutEstimate";
import type { ResumeDocument } from "../src/types";
import { strong } from "./fixtures/strong";
import { weak } from "./fixtures/weak";

describe("estimateLayout", () => {
  it("a sparse resume fills less than a full one", () => {
    const w = estimateLayout(weak);
    const s = estimateLayout(strong);
    expect(w.pages).toBe(1);
    expect(s.pages).toBe(1);
    expect(w.fillPct).toBeLessThan(s.fillPct);
  });

  it("adding a bullet strictly increases fill", () => {
    const d: ResumeDocument = JSON.parse(JSON.stringify(strong));
    const before = estimateLayout(d).fillPct;
    d.projects[0].bullets.push({ text: "Added a nightly cron job exporting booking data to CSV for the mess committee", evidence: [] });
    const after = estimateLayout(d).fillPct;
    expect(after).toBeGreaterThan(before);
  });

  it("the strong fixture sits in the good one-page band", () => {
    const s = estimateLayout(strong);
    expect(s.fillPct).toBeGreaterThanOrEqual(70);
    expect(s.fillPct).toBeLessThanOrEqual(98);
  });
});
