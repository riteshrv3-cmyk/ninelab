import { describe, expect, it } from "vitest";
import { applyAutoFixes, normalizeDate } from "../src/autofix";
import { buildQualityReport } from "../src/quality";
import type { ResumeDocument } from "../src/types";
import { mediocre } from "./fixtures/mediocre";
import { strong } from "./fixtures/strong";
import { weak } from "./fixtures/weak";

const fixtures: Array<[string, ResumeDocument]> = [
  ["weak", weak],
  ["mediocre", mediocre],
  ["strong", strong],
];

describe("normalizeDate", () => {
  it("normalizes tolerant formats to Mon YYYY", () => {
    expect(normalizeDate("June 2024")).toBe("Jun 2024");
    expect(normalizeDate("06/2024")).toBe("Jun 2024");
    expect(normalizeDate("2024-06")).toBe("Jun 2024");
    expect(normalizeDate("Jun'24")).toBe("Jun 2024");
    expect(normalizeDate("Jun 2024")).toBe("Jun 2024");
    expect(normalizeDate("Present")).toBe("Present");
  });

  it("leaves unparseable values untouched", () => {
    expect(normalizeDate("2024")).toBe("2024");
    expect(normalizeDate("last summer")).toBe("last summer");
    expect(normalizeDate("")).toBe("");
  });
});

describe("applyAutoFixes", () => {
  it("is idempotent on every fixture", () => {
    for (const [name, doc] of fixtures) {
      const first = applyAutoFixes(doc);
      const second = applyAutoFixes(first.doc);
      expect(second.applied, `${name} second pass`).toEqual([]);
    }
  });

  it("never lowers the quality score", () => {
    for (const [name, doc] of fixtures) {
      const before = buildQualityReport(doc).total;
      const after = buildQualityReport(applyAutoFixes(doc).doc).total;
      expect(after, name).toBeGreaterThanOrEqual(before);
    }
  });

  it("does not mutate its input", () => {
    const snapshot = JSON.stringify(weak);
    applyAutoFixes(weak);
    expect(JSON.stringify(weak)).toBe(snapshot);
  });

  it("applies nothing to the strong fixture", () => {
    expect(applyAutoFixes(strong).applied).toEqual([]);
  });

  it("fixes the weak fixture's mechanical issues", () => {
    const { doc, applied } = applyAutoFixes(weak);
    const ruleIds = new Set(applied.map((f) => f.ruleId));

    expect(ruleIds).toContain("STY-07"); // double space in summary
    expect(doc.summary).not.toMatch(/\s{2,}/);

    expect(ruleIds).toContain("ATS-03"); // emoji stripped
    expect(doc.projects[0].bullets[0].text).not.toContain("😊");

    expect(ruleIds).toContain("STY-04"); // java -> Java, c++ -> C++
    expect(doc.skillSections[0].items).toContain("C++");
    expect(doc.skillSections[0].items).toContain("Java");

    expect(ruleIds).toContain("STY-08"); // duplicate C++ removed
    expect(doc.skillSections[0].items).toHaveLength(2);

    expect(ruleIds).toContain("STY-03"); // June 2024 -> Jun 2024
    expect(doc.experience[0].start).toBe("Jun 2024");
    expect(doc.experience[0].end).toBe("2024"); // bare year untouched

    expect(ruleIds).toContain("ATS-01"); // empty sections dropped from order
    expect(doc.order).not.toContain("education");
    expect(doc.order[0]).toBe("summary");
  });

  it("strips trailing periods but preserves multi-sentence bullets", () => {
    const d: ResumeDocument = JSON.parse(JSON.stringify(strong));
    d.experience[0].bullets[0].text += ".";
    d.experience[0].bullets[1].text = "Did one thing. Then did another thing after that.";
    const { doc } = applyAutoFixes(d);
    expect(doc.experience[0].bullets[0].text.endsWith(".")).toBe(false);
    expect(doc.experience[0].bullets[1].text.endsWith(".")).toBe(true);
  });

  it("replaces pipes and tabs inside bullets", () => {
    const d: ResumeDocument = JSON.parse(JSON.stringify(strong));
    d.experience[0].bullets[0].text = "Built endpoints | dashboards\tand reports for the payments team this summer";
    const { doc } = applyAutoFixes(d);
    expect(doc.experience[0].bullets[0].text).not.toMatch(/[|\t]/);
    expect(doc.experience[0].bullets[0].text).toContain("endpoints, dashboards");
  });

  it("reformats a valid Indian mobile number", () => {
    const d: ResumeDocument = JSON.parse(JSON.stringify(strong));
    d.contact.phone = "9876543210";
    const { doc } = applyAutoFixes(d);
    expect(doc.contact.phone).toBe("+91 98765 43210");
  });

  it("leaves an unparseable phone alone", () => {
    const { doc } = applyAutoFixes(weak);
    expect(doc.contact.phone).toBe("09876543");
  });

  it("never recases words outside the canonical map", () => {
    const d: ResumeDocument = JSON.parse(JSON.stringify(strong));
    d.experience[0].bullets[0].text = "Built a render pipeline to move data going through the system daily";
    const { doc } = applyAutoFixes(d);
    expect(doc.experience[0].bullets[0].text).toContain("render pipeline");
  });

  it("normalizes malformed link labels", () => {
    const d: ResumeDocument = JSON.parse(JSON.stringify(strong));
    d.contact.links[0].label = "my github";
    const { doc, applied } = applyAutoFixes(d);
    expect(doc.contact.links[0].label).toBe("github.com/priyadesh");
    expect(applied.some((f) => f.ruleId === "ATS-05")).toBe(true);
  });

  it("moves experience before projects and education into the top slots", () => {
    const d: ResumeDocument = JSON.parse(JSON.stringify(strong));
    d.order = ["projects", "experience", "skills", "summary", "certifications", "achievements", "education"];
    const { doc } = applyAutoFixes(d);
    expect(doc.order[0]).toBe("summary");
    expect(doc.order.indexOf("experience")).toBeLessThan(doc.order.indexOf("projects"));
    expect(doc.order.indexOf("education")).toBeLessThanOrEqual(3);
  });
});
