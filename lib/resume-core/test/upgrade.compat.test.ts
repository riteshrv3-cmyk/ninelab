import { describe, expect, it } from "vitest";
import { buildQualityReport } from "../src/quality";
import { upgradeContent } from "../src/upgrade";
import { mediocre } from "./fixtures/mediocre";
import { strong } from "./fixtures/strong";
import { weak } from "./fixtures/weak";

describe("upgradeContent compatibility", () => {
  it("upgrades a v1 flat blob to v2", () => {
    const v1 = {
      name: "Rahul Verma",
      email: "rahul.verma@gmail.com",
      phone: "9876543210",
      city: "Mumbai",
      githubUrl: "https://github.com/rahulv",
      linkedinUrl: "https://www.linkedin.com/in/rahulv",
      degree: "B.E. Computer Engineering",
      college: "VJTI Mumbai",
      startYear: 2021,
      gradYear: 2025,
      cgpa: "8.1",
      summary: "Backend-focused engineering student.",
      skillSections: [{ category: "Languages", items: "Python, SQL, JavaScript" }],
      projects: [{ title: "Chat App", tech: "Node.js, Redis", bullets: ["Built a chat app", "Added typing indicators"] }],
      certifications: [{ name: "SQL Basics", issuer: "Coursera" }],
      achievements: ["Won college hackathon"],
    };
    const doc = upgradeContent(v1);
    expect(doc.schemaVersion).toBe(2);
    expect(doc.contact.name).toBe("Rahul Verma");
    expect(doc.contact.links.map((l) => l.kind).sort()).toEqual(["github", "linkedin"]);
    expect(doc.skillSections[0].items).toEqual(["Python", "SQL", "JavaScript"]);
    expect(doc.projects[0].tech).toEqual(["Node.js", "Redis"]);
    expect(doc.projects[0].bullets[0]).toEqual({ text: "Built a chat app", evidence: [] });
    expect(doc.education).toEqual([
      expect.objectContaining({ degree: "B.E. Computer Engineering", institution: "VJTI Mumbai", start: "2021", end: "2025", cgpa: "8.1" }),
    ]);
    expect(doc.achievements[0]).toEqual({ text: "Won college hackathon", evidence: [] });
  });

  it("never throws on malformed input", () => {
    for (const junk of [null, undefined, 42, "resume", [], {}, { schemaVersion: 2 }, { contact: "nope" }, { projects: [{}, null, 7] }]) {
      expect(() => upgradeContent(junk)).not.toThrow();
      const doc = upgradeContent(junk);
      expect(() => buildQualityReport(doc)).not.toThrow();
    }
  });

  it("round-trips v2 fixtures without changing their score", () => {
    for (const doc of [weak, mediocre, strong]) {
      const upgraded = upgradeContent(JSON.parse(JSON.stringify(doc)));
      expect(buildQualityReport(upgraded).total).toBe(buildQualityReport(doc).total);
      expect(upgraded.contact.name).toBe(doc.contact.name);
      expect(upgraded.order).toEqual(doc.order);
    }
  });

  it("parses a v1 experience period string into start/end", () => {
    const doc = upgradeContent({
      name: "X", email: "x@y.com",
      experience: [{ company: "Acme", role: "Intern", period: "Jun 2024 - Aug 2024", bullets: ["Did things at the office"] }],
    });
    expect(doc.experience[0].start).toBe("Jun 2024");
    expect(doc.experience[0].end).toBe("Aug 2024");
  });
});
