import { describe, expect, it } from "vitest";
import { applyAutoFixes } from "../src/autofix";
import { buildQualityReport } from "../src/quality";
import { upgradeContent } from "../src/upgrade";
import { mediocre } from "./fixtures/mediocre";
import { strong } from "./fixtures/strong";
import { weak } from "./fixtures/weak";

// What the pipeline produces for a student who has filled in nothing: a name,
// a college, and a one-line summary derived from their degree. It must never
// score like a real resume — rules with no content to check score zero rather
// than passing vacuously.
const emptyProfileDoc = upgradeContent({
  schemaVersion: 2,
  contact: { name: "Empty Test", email: "someone@example.com", phone: null, city: null, links: [] },
  headline: "Computer Science & Engineering Graduate",
  summary: "B.Tech in Computer Science & Engineering from Test College.",
  order: ["summary", "education", "skills", "experience", "projects", "certifications", "achievements"],
  skillSections: [],
  experience: [],
  projects: [],
  education: [{ degree: "B.Tech Computer Science & Engineering", institution: "Test College", start: "2023", end: "2027", cgpa: null }],
  certifications: [],
  achievements: [],
});

describe("empty profile", () => {
  it("lands in the bottom band, not a passable-looking number", () => {
    // The points it does keep are real: a name, an email, an education row,
    // a headline, and a clean one-line summary all genuinely exist.
    const r = buildQualityReport(emptyProfileDoc);
    expect(r.total).toBeLessThanOrEqual(34); // "Needs rebuilding" band
  });

  it("never shows a sub-score as complete", () => {
    const r = buildQualityReport(emptyProfileDoc);
    for (const [key, s] of Object.entries(r.subScores)) {
      expect(s.pct, `${key} must not read as complete on an empty resume`).toBeLessThan(100);
    }
  });

  it("fails every substance rule", () => {
    const failing = buildQualityReport(emptyProfileDoc).rules.filter(x => !x.passed).map(x => x.id);
    for (const id of ["IMP-01", "IMP-02", "IMP-05", "BRV-01", "CMP-07", "CMP-08", "ATS-04"]) {
      expect(failing, `${id} must fail with no content`).toContain(id);
    }
  });

  it("stays silent about content that doesn't exist yet", () => {
    const r = buildQualityReport(emptyProfileDoc);
    // Vacuous rules carry no hint; the completeness rules carry the real asks.
    for (const x of r.rules.filter(x => x.vacuous)) expect(x.hint).toBeNull();
    const shown = r.rules.filter(x => !x.passed && x.hint).map(x => x.id);
    expect(shown).toContain("CMP-07"); // add skills
    expect(shown).toContain("CMP-08"); // add experience/projects
    expect(shown.length).toBeLessThanOrEqual(12);
  });
});

describe("auto-fix chip integrity", () => {
  // The "Fix N formatting issues" chip must never be a no-op: every rule it
  // counts has to be something applyAutoFixes actually repairs.
  const cases: Array<[string, ReturnType<typeof upgradeContent>]> = [
    ["empty", emptyProfileDoc],
    ["weak", upgradeContent(weak)],
    ["mediocre", upgradeContent(mediocre)],
    ["strong", upgradeContent(strong)],
  ];
  for (const [name, doc] of cases) {
    it(`resolves every advertised fix on the ${name} resume`, () => {
      const before = buildQualityReport(doc).rules.filter(x => x.autoFixable).map(x => x.id);
      if (before.length === 0) return;
      const { doc: fixed, applied } = applyAutoFixes(doc);
      expect(applied.length, "chip promised fixes but nothing changed").toBeGreaterThan(0);
      const after = buildQualityReport(fixed).rules.filter(x => x.autoFixable).map(x => x.id);
      expect(after, `${before.join(",")} still auto-fixable after fixing`).toEqual([]);
    });
  }
});

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
