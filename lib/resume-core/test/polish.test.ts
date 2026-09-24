import { describe, expect, it } from "vitest";
import { polishGenerated, regroupSkills } from "../src/polish";
import { buildQualityReport } from "../src/quality";
import type { ResumeDocument } from "../src/types";
import { strong } from "./fixtures/strong";

const clone = (d: ResumeDocument): ResumeDocument => JSON.parse(JSON.stringify(d));

describe("generation polish", () => {
  it("splits one flat skills list into standard groups", () => {
    const d = clone(strong);
    d.skillSections = [{ category: "Languages", items: ["C", "CSS", "SQL", "HTML", "Python"], evidence: ["SK:1"] }];
    const out = regroupSkills(d);
    expect(out.skillSections.map((s) => s.category)).toEqual(["Languages", "Web Technologies"]);
    expect(out.skillSections[0].items).toEqual(["C", "SQL", "Python"]);
    expect(buildQualityReport(out).rules.find((r) => r.id === "CMP-07")?.passed).toBe(true);
  });

  it("leaves author-chosen categories alone", () => {
    expect(regroupSkills(strong)).toBe(strong);
  });

  it("repairs section order and empty sections", () => {
    const d = clone(strong);
    d.achievements = [];
    d.order = ["summary", "experience", "projects", "skills", "certifications", "achievements", "education"];
    const out = polishGenerated(d);
    const r = buildQualityReport(out);
    expect(r.rules.find((x) => x.id === "ATS-01")?.passed).toBe(true);
    expect(r.rules.find((x) => x.id === "ATS-02")?.passed).toBe(true);
  });
});
