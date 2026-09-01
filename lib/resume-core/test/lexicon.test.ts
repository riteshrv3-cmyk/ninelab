import { describe, expect, it } from "vitest";
import { CANONICAL_CASE, CLICHES, FILLER_VERBS, OUTCOME_CUES, SELF_ADJECTIVES, TECH_LEXICON, WEAK_OPENERS } from "../src/lexicon";

describe("lexicon word lists", () => {
  it("every CANONICAL_CASE key is a known lexicon term", () => {
    const missing = Object.keys(CANONICAL_CASE).filter((k) => !TECH_LEXICON.has(k));
    expect(missing).toEqual([]);
  });

  it("CANONICAL_CASE keys are lowercase and values differ meaningfully", () => {
    for (const [key, value] of Object.entries(CANONICAL_CASE)) {
      expect(key).toBe(key.toLowerCase());
      expect(value.toLowerCase()).toBe(key);
    }
  });

  it("word lists have no duplicates", () => {
    for (const list of [CLICHES, WEAK_OPENERS, FILLER_VERBS, SELF_ADJECTIVES, OUTCOME_CUES] as readonly (readonly string[])[]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("word lists are lowercase (matching is case-insensitive)", () => {
    for (const list of [CLICHES, WEAK_OPENERS, FILLER_VERBS, SELF_ADJECTIVES] as readonly (readonly string[])[]) {
      for (const w of list) expect(w).toBe(w.toLowerCase());
    }
  });
});
