import { describe, expect, it } from "vitest";
import { buildAtsReport } from "../src/ats";
import { applyAutoFixes } from "../src/autofix";
import { findMisspellings, fixMisspellings, PASSIVE_RE, scanClaimedTech } from "../src/lexicon";
import { singular, tokenizeToNgrams } from "../src/normalize";
import { buildQualityReport } from "../src/quality";
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

describe("keyword tokenizer", () => {
  it("matches a keyword that ends a sentence", () => {
    const grams = tokenizeToNgrams("Containerised the API using Docker. Deployed on AWS.");
    expect(grams.has("docker")).toBe(true);
    expect(grams.has("amazon web services")).toBe(true);
  });

  it("keeps symbol-bearing names intact", () => {
    const grams = tokenizeToNgrams("Wrote C++ and C# tools on .NET, served by Node.js.");
    expect(grams.has("c++")).toBe(true);
    expect(grams.has("c#")).toBe(true);
    expect(grams.has(".net")).toBe(true);
    expect(grams.has("node.js")).toBe(true);
  });

  it("folds plurals both ways", () => {
    expect(singular("microservices")).toBe("microservice");
    expect(singular("redis")).toBe("redis");
    expect(singular("aws")).toBe("aws");
    const grams = tokenizeToNgrams("Split the monolith into 3 microservices");
    expect(grams.has("microservice")).toBe(true);
  });

  it("splits slash pairs", () => {
    const grams = tokenizeToNgrams("Frontend in React/Next.js with CI/CD");
    expect(grams.has("react")).toBe(true);
    expect(grams.has("next.js")).toBe(true);
    expect(grams.has("ci/cd")).toBe(true);
  });

  it("scores a trailing-period keyword as matched in the ATS report", () => {
    const d = clone(strong);
    d.projects[0].bullets[0].text = "Shipped the service to production with Kubernetes.";
    const report = buildAtsReport({ doc: d, jobTags: ["kubernetes"] });
    expect(report?.matched.map((m) => m.term)).toContain("kubernetes");
  });
});

describe("honesty scanner", () => {
  it("ignores everyday words that happen to be tech names", () => {
    expect(scanClaimedTech("Ready to go live with a secure login and fast render times")).toEqual([]);
    expect(scanClaimedTech("Keen to express ideas clearly and learn less obvious tools")).toEqual([]);
  });

  it("ignores practices and concepts", () => {
    expect(scanClaimedTech("Works in agile teams with a focus on security and caching")).toEqual([]);
  });

  it("still catches real stack claims", () => {
    expect(scanClaimedTech("Backend developer working in Go and Kafka")).toEqual(expect.arrayContaining(["go", "kafka"]));
    expect(scanClaimedTech("Built dashboards with React and PostgreSQL")).toEqual(expect.arrayContaining(["react", "postgresql"]));
    expect(scanClaimedTech("Analysed survey data in R and Python")).toEqual(expect.arrayContaining(["r", "python"]));
  });

  it("does not read initials as languages", () => {
    expect(scanClaimedTech("Student at the college under Prof. R. Sharma")).toEqual([]);
  });
});

describe("new quality rules", () => {
  it("IMP-06 flags a verb repeated across bullets", () => {
    const d = clone(strong);
    const all = [...d.experience.flatMap((e) => e.bullets), ...d.projects.flatMap((p) => p.bullets)];
    all.forEach((b) => { b.text = b.text.replace(/^\S+/, "Developed"); });
    const r = rule(d, "IMP-06");
    expect(r.passed).toBe(false);
    expect(r.hint).toContain("Developed");
  });

  it("BRV-05 flags an entry with a single bullet", () => {
    const d = clone(strong);
    d.projects[0].bullets = d.projects[0].bullets.slice(0, 1);
    expect(rule(d, "BRV-05").passed).toBe(false);
  });

  it("STY-03 now requires the month, even when every date is year-only", () => {
    const d = clone(strong);
    d.experience.forEach((e) => { e.start = "2024"; if (e.end.toLowerCase() !== "present") e.end = "2024"; });
    const r = rule(d, "STY-03");
    expect(r.passed).toBe(false);
    expect(r.autoFixable).toBe(false);
  });

  it("STY-09 flags passive voice", () => {
    expect(PASSIVE_RE.test("The dashboard was developed using React")).toBe(true);
    expect(PASSIVE_RE.test("Developed the dashboard using React")).toBe(false);
    const d = clone(strong);
    d.projects[0].bullets[0].text = "A booking API was built for 300 students across 2 hostels";
    expect(rule(d, "STY-09").passed).toBe(false);
  });

  it("STY-10 finds and auto-fixes misspellings, keeping case", () => {
    expect(findMisspellings("Developped a managment portal")).toHaveLength(2);
    expect(fixMisspellings("Developped a managment portal")).toBe("Developed a management portal");
    const d = clone(strong);
    d.summary = d.summary.replace("backend", "backend sofware");
    const r = rule(d, "STY-10");
    expect(r.passed).toBe(false);
    expect(r.autoFixable).toBe(true);
    const { doc, applied } = applyAutoFixes(d);
    expect(applied.some((a) => a.ruleId === "STY-10")).toBe(true);
    expect(rule(doc, "STY-10").passed).toBe(true);
  });

  it("British spellings are not errors", () => {
    expect(findMisspellings("Organisation, analysed, optimised, colour")).toHaveLength(0);
  });

  it("sub-score maxima still add to 100", () => {
    const report = buildQualityReport(strong);
    const perSub = new Map<string, number>();
    for (const r of report.rules) perSub.set(r.subScore, (perSub.get(r.subScore) ?? 0) + r.points);
    expect(Object.fromEntries(perSub)).toEqual({ impact: 25, brevity: 15, style: 20, completeness: 25, ats: 15 });
    expect(report.total).toBe(100);
  });
});
