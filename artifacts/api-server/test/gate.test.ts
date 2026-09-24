import { describe, expect, it } from "vitest";
import type { EvidenceLedger, ResumeDocument } from "@workspace/resume-core";
import { normTerm } from "@workspace/resume-core";
import { fabricationGate, revertUnsafePatches } from "../src/lib/resume/gate";

function ledgerOf(rows: Array<[string, string]>): EvidenceLedger {
  const allowedTerms = new Set<string>();
  for (const [, text] of rows) for (const w of text.toLowerCase().split(/[\s,;:()|]+/)) if (w) allowedTerms.add(normTerm(w));
  return { rows: rows.map(([id, text]) => ({ id, kind: id.split(":")[0] as "PR", text })), allowedTerms };
}

const ledger = ledgerOf([
  ["PR:1", 'Project: "ShopEase" — tech: React, Node.js, MongoDB — e-commerce site; 25 classmates used it during a fest'],
  ["SK:1", "Skill: React (self-rated proficiency 70/100)"],
]);

function doc(bullets: Array<{ text: string; evidence: string[]; suggested?: boolean }>, summary = ""): ResumeDocument {
  return {
    schemaVersion: 2,
    contact: { name: "A", email: "a@b.co", links: [] },
    headline: "",
    summary,
    order: ["summary", "projects"],
    skillSections: [],
    experience: [],
    projects: [{ title: "ShopEase", tech: ["React"], link: null, bullets }],
    education: [],
    certifications: [],
    achievements: [],
    atsMeta: null,
  } as ResumeDocument;
}

describe("fabrication gate", () => {
  it("keeps a bullet whose number is in its cited evidence", () => {
    const out = fabricationGate(doc([{ text: "Built a React store used by 25 classmates during the college fest", evidence: ["PR:1"] }]), ledger);
    expect(out.doc.projects[0].bullets).toHaveLength(1);
  });

  it("drops a bullet with a number the evidence never states", () => {
    const out = fabricationGate(doc([
      { text: "Built a React store used by 3 departments", evidence: ["PR:1"] },
      { text: "Built product search and cart in React and Node.js", evidence: ["PR:1"] },
    ]), ledger);
    expect(out.doc.projects[0].bullets.map((b) => b.text)).toEqual(["Built product search and cart in React and Node.js"]);
    expect(out.removed[0].reason).toContain("number");
  });

  it("drops a bullet naming a technology the profile lacks", () => {
    const out = fabricationGate(doc([
      { text: "Built the store API with Django and Redis", evidence: ["PR:1"] },
      { text: "Built product search and cart in React", evidence: ["PR:1"] },
    ]), ledger);
    expect(out.doc.projects[0].bullets).toHaveLength(1);
  });

  it("does not treat everyday words as tech claims in the summary", () => {
    const out = fabricationGate(doc([{ text: "Built product search in React", evidence: ["PR:1"] }], "Ready to go live with secure, fast apps. Builds React interfaces."), ledger);
    expect(out.doc.summary).toBe("Ready to go live with secure, fast apps. Builds React interfaces.");
  });

  it("removes only the summary sentence with an unsupported claim", () => {
    const out = fabricationGate(doc([{ text: "Built product search in React", evidence: ["PR:1"] }], "Builds React interfaces. Scaled Kafka pipelines for 10 teams."), ledger);
    expect(out.doc.summary).toBe("Builds React interfaces.");
  });
});

describe("critic patch safety", () => {
  it("puts back the original bullet when a patch invents a number", () => {
    const before = doc([{ text: "Built product search and cart in React", evidence: ["PR:1"] }]);
    const after = doc([{ text: "Built product search and cart in React, used by 3 departments", evidence: ["PR:1"] }]);
    const out = revertUnsafePatches(before, after, ledger);
    expect(out.reverted).toBe(1);
    expect(out.doc.projects[0].bullets[0].text).toBe("Built product search and cart in React");
  });

  it("accepts a pure rewording", () => {
    const before = doc([{ text: "Made search and cart in React", evidence: ["PR:1"] }]);
    const after = doc([{ text: "Built product search and cart features in React", evidence: ["PR:1"] }]);
    expect(revertUnsafePatches(before, after, ledger).reverted).toBe(0);
  });
});
