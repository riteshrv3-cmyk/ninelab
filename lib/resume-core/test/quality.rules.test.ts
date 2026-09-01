import { describe, expect, it } from "vitest";
import { buildQualityReport, isQuantifiedBullet } from "../src/quality";
import type { ResumeDocument } from "../src/types";
import { strong } from "./fixtures/strong";

function clone(doc: ResumeDocument): ResumeDocument {
  return JSON.parse(JSON.stringify(doc));
}

function rule(doc: ResumeDocument, id: string) {
  const r = buildQualityReport(doc).rules.find((x) => x.id === id);
  if (!r) throw new Error(`rule ${id} not found`);
  return r;
}

describe("isQuantifiedBullet", () => {
  it("counts real metrics", () => {
    expect(isQuantifiedBullet("Served 300 users daily across two campuses")).toBe(true);
    expect(isQuantifiedBullet("Cut load time by 40% on the landing page")).toBe(true);
    expect(isQuantifiedBullet("Processed 12,000 requests per minute")).toBe(true);
  });

  it("ignores digits inside technology names", () => {
    expect(isQuantifiedBullet("Built storage on S3 and EC2 with OAuth2 login")).toBe(false);
    expect(isQuantifiedBullet("Deployed containers to a K8s cluster")).toBe(false);
  });

  it("ignores digit-prefixed names like 2FA, 3D, and 5G", () => {
    expect(isQuantifiedBullet("Added 2FA login to the portal")).toBe(false);
    expect(isQuantifiedBullet("Rendered 3D charts over a 5G test network")).toBe(false);
  });

  it("treats a number right after a tech term as a version, not a metric", () => {
    expect(isQuantifiedBullet("Migrated the dashboard to React 18")).toBe(false);
    expect(isQuantifiedBullet("Upgraded services to Java 21 runtime")).toBe(false);
    expect(isQuantifiedBullet("Moved services to Spring Boot 3")).toBe(false);
    expect(isQuantifiedBullet("Upgraded to Node.js 18 across 3 services")).toBe(true);
  });

  it("returns false when there are no digits at all", () => {
    expect(isQuantifiedBullet("Improved the recommendation pipeline for the team")).toBe(false);
  });
});

describe("baseline", () => {
  it("every rule passes on the strong fixture", () => {
    const report = buildQualityReport(strong);
    const failing = report.rules.filter((r) => !r.passed).map((r) => r.id);
    expect(failing).toEqual([]);
    expect(report.total).toBe(100);
  });
});

// Each case mutates the strong fixture minimally to flip exactly the rule
// under test, then asserts it failed with actionable output.
describe("impact rules", () => {
  it("IMP-01 fails when bullets lack numbers", () => {
    const d = clone(strong);
    for (const e of d.experience) for (const b of e.bullets) b.text = b.text.replace(/[\d,]+%?/g, "many");
    for (const p of d.projects) for (const b of p.bullets) b.text = b.text.replace(/[\d,]+%?/g, "many");
    const r = rule(d, "IMP-01");
    expect(r.passed).toBe(false);
    expect(r.hint).toContain("number");
    expect(r.targets.length).toBeGreaterThan(0);
  });

  it("IMP-02 fails on a weak opener", () => {
    const d = clone(strong);
    d.projects[0].bullets[0].text = "Responsible for a meal booking system in React used by 300 hostel students";
    const r = rule(d, "IMP-02");
    expect(r.passed).toBe(false);
    expect(r.earned).toBeLessThan(r.points);
    expect(r.targets).toEqual(["projects[0].bullets[0]"]);
  });

  it("IMP-03 fails on filler verbs", () => {
    const d = clone(strong);
    d.experience[0].bullets[0].text = "Leveraged 4 REST endpoints in Node.js serving 12,000 daily requests for payments";
    const r = rule(d, "IMP-03");
    expect(r.passed).toBe(false);
    expect(r.targets).toEqual(["experience[0].bullets[0]"]);
  });

  it("IMP-04 fails on self-adjectives", () => {
    const d = clone(strong);
    d.summary = "Built a robust backend platform with Node.js and PostgreSQL for 3 production services daily.";
    expect(rule(d, "IMP-04").passed).toBe(false);
  });

  it("IMP-05 fails when no bullet states an outcome", () => {
    const d = clone(strong);
    const neutral = "Wrote code for the internal team dashboard module during the semester project";
    for (const e of d.experience) for (const b of e.bullets) b.text = neutral;
    for (const p of d.projects) for (const b of p.bullets) b.text = neutral;
    expect(rule(d, "IMP-05").passed).toBe(false);
  });
});

describe("brevity rules", () => {
  it("BRV-01 fails on a too-short bullet", () => {
    const d = clone(strong);
    d.projects[0].bullets[0].text = "Made an app";
    const r = rule(d, "BRV-01");
    expect(r.passed).toBe(false);
    expect(r.targets).toContain("projects[0].bullets[0]");
  });

  it("BRV-02 fails on a too-short summary", () => {
    const d = clone(strong);
    d.summary = "Student who codes things.";
    expect(rule(d, "BRV-02").passed).toBe(false);
  });

  it("BRV-03 fails on a sparse page", () => {
    const d = clone(strong);
    d.experience = [];
    d.projects = [];
    d.certifications = [];
    d.achievements = [];
    d.order = ["summary", "education", "skills"];
    const r = rule(d, "BRV-03");
    expect(r.passed).toBe(false);
    expect(r.hint).toContain("full");
  });

  it("BRV-04 fails without a headline", () => {
    const d = clone(strong);
    d.headline = "";
    expect(rule(d, "BRV-04").passed).toBe(false);
  });
});

describe("style rules", () => {
  it("STY-01 fails on present tense in a past role", () => {
    const d = clone(strong);
    d.experience[0].bullets[0].text = "Build 4 REST endpoints in Node.js serving 12,000 daily requests for payments";
    const r = rule(d, "STY-01");
    expect(r.passed).toBe(false);
    expect(r.targets).toEqual(["experience[0].bullets[0]"]);
  });

  it("STY-01 exempts current (Present) roles", () => {
    const d = clone(strong);
    d.experience[0].end = "Present";
    d.experience[0].bullets[0].text = "Build 4 REST endpoints in Node.js serving 12,000 daily requests for payments";
    expect(rule(d, "STY-01").passed).toBe(true);
  });

  it("STY-02 fails on mixed end punctuation", () => {
    const d = clone(strong);
    d.experience[0].bullets[0].text += ".";
    const r = rule(d, "STY-02");
    expect(r.passed).toBe(false);
    expect(r.autoFixable).toBe(true);
  });

  it("STY-03 fails on mixed date formats", () => {
    const d = clone(strong);
    d.experience[0].start = "June 2025";
    const r = rule(d, "STY-03");
    expect(r.passed).toBe(false);
    expect(r.targets).toEqual(["experience[0].start"]);
  });

  it("STY-04 fails on miscased tech names", () => {
    const d = clone(strong);
    d.experience[0].bullets[0].text = "Built 4 REST endpoints in node.js serving 12,000 daily requests for payments";
    const r = rule(d, "STY-04");
    expect(r.passed).toBe(false);
    expect(r.autoFixable).toBe(true);
  });

  it("STY-05 fails on first person", () => {
    const d = clone(strong);
    d.projects[0].bullets[0].text = "I shipped a meal booking system in React used by 300 hostel students";
    expect(rule(d, "STY-05").passed).toBe(false);
  });

  it("STY-06 fails on clichés and deducts per phrase", () => {
    const d = clone(strong);
    d.summary = "Passionate team player and quick learner building backend services in Node.js with PostgreSQL for production use.";
    const r = rule(d, "STY-06");
    expect(r.passed).toBe(false);
    expect(r.earned).toBe(1); // 4 - 3 distinct clichés
  });

  it("STY-07 fails on double spaces", () => {
    const d = clone(strong);
    d.summary = d.summary.replace(" backend", "  backend");
    expect(rule(d, "STY-07").passed).toBe(false);
  });

  it("STY-08 fails on duplicate skills across categories", () => {
    const d = clone(strong);
    d.skillSections[2].items.push("python");
    const r = rule(d, "STY-08");
    expect(r.passed).toBe(false);
    expect(r.hint).toContain("twice");
  });
});

describe("completeness rules", () => {
  it("CMP-01 fails without a name", () => {
    const d = clone(strong);
    d.contact.name = "";
    const r = rule(d, "CMP-01");
    expect(r.passed).toBe(false);
    expect(r.hint).toContain("name");
  });

  it("CMP-02 fails on an unprofessional email", () => {
    const d = clone(strong);
    d.contact.email = "priya.cool.grl@gmail.com";
    expect(rule(d, "CMP-02").passed).toBe(false);
  });

  it("CMP-03 fails on a malformed phone", () => {
    const d = clone(strong);
    d.contact.phone = "98765";
    expect(rule(d, "CMP-03").passed).toBe(false);
  });

  it("CMP-03 passes when phone is absent (optional)", () => {
    const d = clone(strong);
    d.contact.phone = null;
    expect(rule(d, "CMP-03").passed).toBe(true);
  });

  it("CMP-04 fails without LinkedIn", () => {
    const d = clone(strong);
    d.contact.links = d.contact.links.filter((l) => l.kind !== "linkedin");
    expect(rule(d, "CMP-04").passed).toBe(false);
  });

  it("CMP-05 fails without GitHub", () => {
    const d = clone(strong);
    d.contact.links = d.contact.links.filter((l) => l.kind !== "github");
    expect(rule(d, "CMP-05").passed).toBe(false);
  });

  it("CMP-06 fails without a complete education entry", () => {
    const d = clone(strong);
    d.education = [];
    expect(rule(d, "CMP-06").passed).toBe(false);
  });

  it("CMP-07 fails with too few skills", () => {
    const d = clone(strong);
    d.skillSections = [{ category: "Skills", items: ["Python", "SQL"], evidence: [] }];
    expect(rule(d, "CMP-07").passed).toBe(false);
  });

  it("CMP-08 grades entry count and bullet depth separately", () => {
    const d = clone(strong);
    d.experience = [];
    d.projects = [d.projects[0]];
    d.projects[0].bullets = [d.projects[0].bullets[0]];
    const r = rule(d, "CMP-08");
    expect(r.passed).toBe(false);
    expect(r.earned).toBe(0);
  });

  it("CMP-09 fails on an empty summary", () => {
    const d = clone(strong);
    d.summary = "";
    expect(rule(d, "CMP-09").passed).toBe(false);
  });

  it("CMP-10 fails when no CGPA is listed", () => {
    const d = clone(strong);
    d.education[0].cgpa = null;
    expect(rule(d, "CMP-10").passed).toBe(false);
  });

  it("CMP-11 fails when no project has a link", () => {
    const d = clone(strong);
    for (const p of d.projects) p.link = null;
    expect(rule(d, "CMP-11").passed).toBe(false);
  });
});

describe("ATS rules", () => {
  it("ATS-01 fails when summary is not first", () => {
    const d = clone(strong);
    d.order = ["education", "summary", "skills", "experience", "projects", "certifications", "achievements"];
    const r = rule(d, "ATS-01");
    expect(r.passed).toBe(false);
    expect(r.autoFixable).toBe(true);
  });

  it("ATS-02 fails when order lists an empty section", () => {
    const d = clone(strong);
    d.certifications = [];
    expect(rule(d, "ATS-02").passed).toBe(false);
  });

  it("ATS-03 fails on emoji, but never scans contact.name", () => {
    const d = clone(strong);
    d.projects[0].bullets[0].text += " 🚀";
    expect(rule(d, "ATS-03").passed).toBe(false);

    const d2 = clone(strong);
    d2.contact.name = "प्रिया देशमुख";
    expect(rule(d2, "ATS-03").passed).toBe(true);
  });

  it("ATS-04 fails when skills have no lexicon terms", () => {
    const d = clone(strong);
    d.skillSections = [{ category: "Soft Skills", items: ["Communication", "Teamwork", "Leadership", "Discipline", "Focus"], evidence: [] }];
    expect(rule(d, "ATS-04").passed).toBe(false);
  });

  it("ATS-05 fails on a label that breaks the shortenUrl convention", () => {
    const d = clone(strong);
    d.contact.links[0].label = "my github";
    const r = rule(d, "ATS-05");
    expect(r.passed).toBe(false);
    expect(r.targets).toEqual(["contact.links[0]"]);
  });

  it("ATS-06 fails on pipes inside bullets", () => {
    const d = clone(strong);
    d.experience[0].bullets[0].text = "Built endpoints | dashboards | reports for the payments team this summer internship";
    expect(rule(d, "ATS-06").passed).toBe(false);
  });
});
