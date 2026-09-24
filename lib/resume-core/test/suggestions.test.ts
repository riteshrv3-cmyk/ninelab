import { describe, expect, it } from "vitest";
import { buildAtsReport } from "../src/ats";
import { renderPlainText } from "../src/plainText";
import { buildQualityReport } from "../src/quality";
import { confirmedOnly, countSuggestions } from "../src/suggestions";
import { upgradeContent } from "../src/upgrade";
import type { ResumeDocument } from "../src/types";
import { strong } from "./fixtures/strong";

function withSuggestion(): ResumeDocument {
  const d: ResumeDocument = JSON.parse(JSON.stringify(strong));
  d.projects[0].bullets.push({ text: "Designed a Kubernetes rollout for the booking service across hostels", evidence: ["PR:1"], suggested: true });
  return d;
}

describe("AI suggestions", () => {
  it("survive a save round-trip through upgradeContent", () => {
    const d = withSuggestion();
    const again = upgradeContent(JSON.parse(JSON.stringify(d)));
    expect(countSuggestions(again)).toBe(1);
    expect(again.projects[0].bullets.at(-1)?.suggested).toBe(true);
  });

  it("are left out of the printed text until confirmed", () => {
    const d = withSuggestion();
    expect(renderPlainText(d)).not.toContain("Kubernetes rollout");
    d.projects[0].bullets.at(-1)!.suggested = undefined;
    expect(renderPlainText(d)).toContain("Kubernetes rollout");
  });

  it("earn nothing in the quality or ATS score", () => {
    const d = withSuggestion();
    expect(buildQualityReport(d).total).toBe(buildQualityReport(strong).total);
    expect(buildQualityReport(d).bulletStats.total).toBe(buildQualityReport(strong).bulletStats.total);
    const ats = buildAtsReport({ doc: d, jobTags: ["kubernetes"] });
    expect(ats?.matched.map((m) => m.term)).not.toContain("kubernetes");
  });

  it("confirmedOnly leaves a clean doc untouched", () => {
    expect(confirmedOnly(strong)).toBe(strong);
  });
});
