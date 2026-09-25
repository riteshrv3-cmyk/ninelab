import { describe, expect, it } from "vitest";

// driveAnalysis imports the db package, which refuses to load without a URL.
// The pool is lazy, so nothing connects; these tests are pure.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";
const { graduationYear, normalizeBranch, computeEligibilityGates } = await import("../src/lib/driveAnalysis");

describe("graduationYear", () => {
  it("final year in Sep 2026 is the 2027 batch", () => {
    expect(graduationYear(4, new Date(2026, 8, 25))).toBe(2027);
  });
  it("final year in Mar 2027 is still the 2027 batch", () => {
    expect(graduationYear(4, new Date(2027, 2, 1))).toBe(2027);
  });
  it("first year in Aug 2026 is the 2030 batch", () => {
    expect(graduationYear(1, new Date(2026, 7, 1))).toBe(2030);
  });
});

describe("normalizeBranch", () => {
  it.each(["Information Technology", "Data Science", "Artificial Intelligence", "Cybersecurity", "IT", "Computer Engineering"])(
    "%s is CS family",
    (f) => expect(normalizeBranch(f)).toBe("cse"),
  );
  it("keeps mechanical separate", () => expect(normalizeBranch("Mechanical")).toBe("mech"));
});

describe("computeEligibilityGates", () => {
  it("uses the student's own target batch", () => {
    const { gates } = computeEligibilityGates(
      { cgpa: "8.1", field: "Information Technology", year: 4, targetBatch: 2027 },
      { cgpaCutoff: 7, branches: ["cse"], batch: "2027" },
    );
    expect(Object.values(gates).every((g) => g.open)).toBe(true);
  });
});
