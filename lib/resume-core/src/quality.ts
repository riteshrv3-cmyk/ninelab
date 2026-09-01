// Deterministic resume-quality scoring. Pure functions of a ResumeDocument —
// no I/O, no randomness — so the exact same score computes client-side on
// every keystroke (debounced) and server-side when persisting. The AI judge
// receives this report as context and adds prose on top; it never re-derives
// the number.

import { MONTH_YEAR_RE, YEAR_RE, isDateFixable, isIndianMobileFixable } from "./dates";
import { estimateLayout } from "./layoutEstimate";
import {
  CANONICAL_CASE,
  CLICHES,
  FILLER_VERBS,
  OUTCOME_CUES,
  SELF_ADJECTIVES,
  TECH_LEXICON,
  WEAK_OPENERS,
  scanLexicon,
} from "./lexicon";
import { normTerm } from "./normalize";
import type { LayoutEstimate, ResumeDocument, SectionKey } from "./types";
import type { TemplateDensity } from "./budget";

export type SubScoreKey = "impact" | "brevity" | "style" | "completeness" | "ats";

export type RuleSection = SectionKey | "contact" | "header" | "overall";

export interface QualityRuleResult {
  id: string; // "IMP-01"
  subScore: SubScoreKey;
  section: RuleSection; // which ReviewFlow step this anchors to
  points: number;
  earned: number; // graded rules earn fractions of `points`
  passed: boolean;
  hint: string | null; // exact user-facing copy; null when passed or vacuous
  autoFixable: boolean;
  targets: string[]; // doc paths of offenders, e.g. "experience[0].bullets[1]"
  /** The rule had nothing to check because the content doesn't exist yet.
   * Scores zero and shows no hint — see `vacuous()`. */
  vacuous: boolean;
}

export interface QualitySubScore {
  earned: number;
  max: number;
  pct: number;
}

export interface QualityReport {
  version: "quality-v1";
  total: number; // 0-100 integer
  subScores: Record<SubScoreKey, QualitySubScore>;
  rules: QualityRuleResult[];
  layout: LayoutEstimate;
  bulletStats: { total: number; quantified: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PathedBullet {
  text: string;
  path: string;
  /** true when the owning experience entry has end !== "Present" */
  pastRole: boolean;
  fromExperience: boolean;
}

function collectBullets(doc: ResumeDocument): PathedBullet[] {
  const out: PathedBullet[] = [];
  doc.experience.forEach((e, ei) => {
    const past = e.end.trim().toLowerCase() !== "present";
    e.bullets.forEach((b, bi) => {
      out.push({ text: b.text, path: `experience[${ei}].bullets[${bi}]`, pastRole: past, fromExperience: true });
    });
  });
  doc.projects.forEach((p, pi) => {
    p.bullets.forEach((b, bi) => {
      out.push({ text: b.text, path: `projects[${pi}].bullets[${bi}]`, pastRole: false, fromExperience: false });
    });
  });
  return out;
}

function wordCount(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

function startsWithPhrase(text: string, phrase: string): boolean {
  return text.trim().toLowerCase().startsWith(phrase);
}

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(text);
}

function containsPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

const IRREGULAR_PAST = new Set([
  "built", "led", "wrote", "made", "ran", "set", "cut", "drove", "grew", "won",
  "shipped", "sped", "kept", "taught", "held", "rebuilt",
]);

// Standalone number tokens only — a digit glued to letters on either side
// ("S3", "OAuth2", "2FA", "3D", "5G") is part of a name, not a metric.
const STANDALONE_NUMBER_RE = /(?<![A-Za-z0-9])(\d[\d,.]*%?)(?![A-Za-z])/g;

/**
 * True when a bullet states an actual metric. Digits inside technology names
 * (S3, OAuth2, 2FA) never count, and a standalone number immediately after a
 * known tech term — single- or two-word ("React 18", "Spring Boot 3") — is
 * treated as a version, not a metric. Shared with the quantification coach so
 * scoring and coaching agree on which bullets need numbers.
 */
export function isQuantifiedBullet(text: string): boolean {
  STANDALONE_NUMBER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STANDALONE_NUMBER_RE.exec(text)) !== null) {
    const before = text.slice(0, m.index).trimEnd();
    const words = before.split(/\s+/);
    const clean = (w: string | undefined) => w?.toLowerCase().replace(/[^a-z0-9.+#/-]/g, "") ?? "";
    const prev1 = clean(words[words.length - 1]);
    const prev2 = words.length >= 2 ? `${clean(words[words.length - 2])} ${prev1}` : "";
    if ((prev1 && TECH_LEXICON.has(prev1)) || (prev2 && TECH_LEXICON.has(prev2))) continue; // version number
    return true;
  }
  return false;
}

/** Characters an ATS parser reliably survives: printable ASCII plus en/em-dash,
 * curly quotes, and the bullet glyph. */
const ATS_SAFE_RE = /^[\x20-\x7E–—‘’“”•\n\r\t]*$/;

export const UNPROFESSIONAL_EMAIL_TOKENS = ["cool", "boy", "girl", "cute", "killer", "don", "bhai"];

const EMAIL_RE = /^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.[a-z]{2,}$/i;

/** All free-text fields the style/ATS rules scan, with their doc paths. */
function textFields(doc: ResumeDocument): Array<{ text: string; path: string }> {
  const out: Array<{ text: string; path: string }> = [];
  if (doc.summary) out.push({ text: doc.summary, path: "summary" });
  if (doc.headline) out.push({ text: doc.headline, path: "headline" });
  for (const b of collectBullets(doc)) out.push({ text: b.text, path: b.path });
  doc.skillSections.forEach((s, si) => {
    s.items.forEach((item, ii) => out.push({ text: item, path: `skillSections[${si}].items[${ii}]` }));
  });
  doc.achievements.forEach((a, ai) => out.push({ text: a.text, path: `achievements[${ai}]` }));
  return out;
}

function isSectionEmpty(doc: ResumeDocument, key: SectionKey): boolean {
  switch (key) {
    case "summary": return !doc.summary.trim();
    case "experience": return doc.experience.length === 0;
    case "projects": return doc.projects.length === 0;
    case "skills": return doc.skillSections.length === 0;
    case "education": return doc.education.length === 0;
    case "certifications": return doc.certifications.length === 0;
    case "achievements": return doc.achievements.length === 0;
  }
}

type RuleInput = {
  doc: ResumeDocument;
  bullets: PathedBullet[];
  layout: LayoutEstimate;
};

type RuleOutcome = Omit<QualityRuleResult, "id" | "subScore" | "section" | "points" | "autoFixable" | "vacuous">
  & {
    vacuous?: boolean;
    /** Overrides the rule's default: set false when THIS failure mode can't be
     * repaired mechanically (e.g. a missing phone can be reformatted, not invented). */
    autoFixable?: boolean;
  };

type RuleFn = (input: RuleInput) => RuleOutcome;

interface RuleDef {
  id: string;
  subScore: SubScoreKey;
  section: RuleSection;
  points: number;
  autoFixable: boolean;
  run: RuleFn;
}

function pass(): RuleOutcome {
  return { earned: 0, passed: true, hint: null, targets: [] };
}

/**
 * The rule has nothing to check because the content doesn't exist yet — a
 * resume with no bullets has no weak openers, no filler verbs, no bad
 * punctuation. That is NOT the same as being well written, so it scores zero:
 * an empty resume must never bank points for content it doesn't have. It stays
 * silent (no hint, never auto-fixable) because the completeness rules already
 * carry the real "add your work" message — otherwise an empty resume would
 * show a wall of meaningless checklist items.
 */
function vacuous(): RuleOutcome {
  return { earned: 0, passed: false, hint: null, targets: [], vacuous: true };
}

// ─── Rule definitions ────────────────────────────────────────────────────────

const RULES: RuleDef[] = [
  // ── Impact (25) ──
  {
    id: "IMP-01", subScore: "impact", section: "overall", points: 8, autoFixable: false,
    run: ({ bullets }) => {
      if (bullets.length === 0) return { earned: 0, passed: false, hint: "Add bullets to your experience or projects first — impact lives there.", targets: [] };
      const quantified = bullets.filter((b) => isQuantifiedBullet(b.text));
      const q = quantified.length / bullets.length;
      let earned: number;
      if (q >= 0.6) earned = 8;
      else if (q >= 0.3) earned = 4;
      else earned = Math.min(4, (8 * q) / 0.6);
      earned = Math.round(earned * 10) / 10;
      const passed = earned === 8;
      return {
        earned, passed,
        hint: passed ? null : `Only ${quantified.length}/${bullets.length} bullets have a number. Recruiters trust numbers — use the Add numbers coach to quantify more.`,
        targets: bullets.filter((b) => !isQuantifiedBullet(b.text)).map((b) => b.path),
      };
    },
  },
  {
    id: "IMP-02", subScore: "impact", section: "overall", points: 6, autoFixable: false,
    run: ({ bullets }) => {
      if (bullets.length === 0) return vacuous();
      const weak = bullets.filter((b) => WEAK_OPENERS.some((w) => startsWithPhrase(b.text, w)));
      if (weak.length === 0) return pass();
      const frac = (bullets.length - weak.length) / bullets.length;
      return {
        earned: Math.round(6 * frac * 10) / 10, passed: false,
        hint: `${weak.length} bullet${weak.length > 1 ? "s" : ""} open weakly ('Responsible for…', 'Worked on…'). Start with what you did: Built, Reduced, Automated.`,
        targets: weak.map((b) => b.path),
      };
    },
  },
  {
    id: "IMP-03", subScore: "impact", section: "overall", points: 4, autoFixable: false,
    run: ({ bullets }) => {
      if (bullets.length === 0) return vacuous();
      const hits = bullets.filter((b) => FILLER_VERBS.some((v) => containsWord(b.text, v)));
      if (hits.length === 0) return pass();
      return {
        earned: 0, passed: false,
        hint: "Swap filler verbs like 'Leveraged' and 'Utilized' for words an engineer says: Used, Built, Wrote.",
        targets: hits.map((b) => b.path),
      };
    },
  },
  {
    id: "IMP-04", subScore: "impact", section: "overall", points: 3, autoFixable: false,
    run: ({ doc, bullets }) => {
      const fields = [
        ...bullets.map((b) => ({ text: b.text, path: b.path })),
        { text: doc.summary, path: "summary" },
        { text: doc.headline, path: "headline" },
      ].filter((f) => f.text.trim());
      if (fields.length === 0) return vacuous();
      const hits = fields.filter((f) => SELF_ADJECTIVES.some((a) => containsPhrase(f.text, a)));
      if (hits.length === 0) return pass();
      return {
        earned: 0, passed: false,
        hint: "'Robust' and 'scalable' are claims, not evidence. Show the number or scope instead.",
        targets: hits.map((f) => f.path),
      };
    },
  },
  {
    id: "IMP-05", subScore: "impact", section: "overall", points: 4, autoFixable: false,
    run: ({ bullets }) => {
      if (bullets.some((b) => OUTCOME_CUES.some((c) => c === "%" || c === "x faster" ? containsPhrase(b.text, c) : containsWord(b.text, c)))) return pass();
      return {
        earned: 0, passed: false,
        hint: "No bullet states an outcome. Add one 'reduced/improved/saved' result — even scope ('for 3 departments') counts.",
        targets: [],
      };
    },
  },

  // ── Brevity (15) ──
  {
    id: "BRV-01", subScore: "brevity", section: "overall", points: 6, autoFixable: false,
    run: ({ bullets }) => {
      if (bullets.length === 0) return vacuous();
      const bad = bullets.filter((b) => {
        const w = wordCount(b.text);
        return w < 8 || w > 28;
      });
      if (bad.length === 0) return pass();
      const tooLong = bad.filter((b) => wordCount(b.text) > 28).length;
      const which = tooLong >= bad.length - tooLong ? "long" : "short";
      const frac = (bullets.length - bad.length) / bullets.length;
      return {
        earned: Math.round(6 * frac * 10) / 10, passed: false,
        hint: `${bad.length} bullet${bad.length > 1 ? "s are" : " is"} too ${which}. Aim for one line: 8-28 words each.`,
        targets: bad.map((b) => b.path),
      };
    },
  },
  {
    id: "BRV-02", subScore: "brevity", section: "summary", points: 3, autoFixable: false,
    run: ({ doc }) => {
      if (!doc.summary.trim()) return vacuous(); // CMP-09 carries the "write one" hint
      const w = wordCount(doc.summary);
      if (w >= 15 && w <= 45) return pass();
      return {
        earned: 0, passed: false,
        hint: `Your summary is ${w} words. Keep it 15-45 — three tight lines a recruiter reads in the first 7 seconds.`,
        targets: ["summary"],
      };
    },
  },
  {
    id: "BRV-03", subScore: "brevity", section: "overall", points: 4, autoFixable: false,
    run: ({ layout }) => {
      if (layout.pages === 1 && layout.fillPct >= 70 && layout.fillPct <= 98) return pass();
      if (layout.pages === 1 && layout.fillPct >= 50) {
        return {
          earned: 2, passed: false,
          hint: `Your page is only ${layout.fillPct}% full. Add a project bullet or coursework line so it doesn't look empty.`,
          targets: [],
        };
      }
      const hint = layout.pages > 1
        ? "Your resume runs past one page. Cut the weakest bullets — one strong page beats two thin ones."
        : `Your page is only ${layout.fillPct}% full. Add a project bullet or coursework line so it doesn't look empty.`;
      return { earned: 0, passed: false, hint, targets: [] };
    },
  },
  {
    id: "BRV-04", subScore: "brevity", section: "header", points: 2, autoFixable: false,
    run: ({ doc }) => {
      const len = doc.headline.trim().length;
      if (len >= 1 && len <= 80) return pass();
      return {
        earned: 0, passed: false,
        hint: len === 0
          ? "Add a one-line headline under your name, like 'Backend Developer | Node.js, PostgreSQL'."
          : "Keep your headline under 80 characters — one clean line.",
        targets: ["headline"],
      };
    },
  },

  // ── Style & Consistency (20) ──
  {
    id: "STY-01", subScore: "style", section: "experience", points: 3, autoFixable: false,
    run: ({ bullets }) => {
      const experienceBullets = bullets.filter((b) => b.fromExperience);
      if (experienceBullets.length === 0) return vacuous(); // no experience yet
      const pastBullets = experienceBullets.filter((b) => b.pastRole);
      // Real experience, but all of it current — tense is correct by default.
      if (pastBullets.length === 0) return pass();
      const bad = pastBullets.filter((b) => {
        const first = b.text.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
        return !(first.endsWith("ed") || IRREGULAR_PAST.has(first));
      });
      if (bad.length === 0) return pass();
      const frac = (pastBullets.length - bad.length) / pastBullets.length;
      return {
        earned: Math.round(3 * frac * 10) / 10, passed: false,
        hint: `Past internships should use past tense: 'Built', not 'Build'. ${bad.length} bullet${bad.length > 1 ? "s" : ""} to fix.`,
        targets: bad.map((b) => b.path),
      };
    },
  },
  {
    id: "STY-02", subScore: "style", section: "overall", points: 2, autoFixable: true,
    run: ({ bullets }) => {
      if (bullets.length === 0) return vacuous();
      if (bullets.length < 2) return pass(); // a single bullet is trivially consistent
      const withDot = bullets.filter((b) => b.text.trimEnd().endsWith("."));
      if (withDot.length === 0 || withDot.length === bullets.length) return pass();
      const minority = withDot.length <= bullets.length / 2 ? withDot : bullets.filter((b) => !b.text.trimEnd().endsWith("."));
      return {
        earned: 0, passed: false,
        hint: "Some bullets end with a period, some don't. Pick one style — we'll make them consistent.",
        targets: minority.map((b) => b.path),
      };
    },
  },
  {
    id: "STY-03", subScore: "style", section: "experience", points: 3, autoFixable: true,
    run: ({ doc }) => {
      const dates: Array<{ v: string; path: string }> = [];
      doc.experience.forEach((e, i) => {
        if (e.start) dates.push({ v: e.start, path: `experience[${i}].start` });
        if (e.end) dates.push({ v: e.end, path: `experience[${i}].end` });
      });
      const real = dates.filter((d) => d.v.trim().toLowerCase() !== "present");
      if (real.length === 0) return vacuous();
      const allMonYear = real.every((d) => MONTH_YEAR_RE.test(d.v.trim()));
      const allYear = real.every((d) => YEAR_RE.test(d.v.trim()));
      if (allMonYear || allYear) return pass();
      const offenders = real.filter((d) => !MONTH_YEAR_RE.test(d.v.trim()));
      // Only advertise a one-tap fix when the fixer can actually rewrite one
      // of them — a bare "2024" has no month to recover, so that's manual.
      const fixable = offenders.some((d) => isDateFixable(d.v));
      return {
        earned: 0, passed: false, autoFixable: fixable,
        hint: fixable
          ? "Your dates mix formats ('June 2024' vs '2024'). Recruiters and ATS parsers both prefer 'Jun 2024'."
          : "Your dates mix formats. Write each one as 'Jun 2024' — add the month where only a year is given.",
        targets: offenders.map((d) => d.path),
      };
    },
  },
  {
    id: "STY-04", subScore: "style", section: "overall", points: 3, autoFixable: true,
    run: (input) => {
      const fields = textFields(input.doc);
      const keys = Object.keys(CANONICAL_CASE);
      const offenders: string[] = [];
      let occurrences = 0;
      let wrong = 0;
      for (const f of fields) {
        for (const key of keys) {
          const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "gi");
          const matches = f.text.match(re);
          if (!matches) continue;
          for (const m of matches) {
            occurrences++;
            if (m !== CANONICAL_CASE[key]) {
              wrong++;
              if (!offenders.includes(f.path)) offenders.push(f.path);
            }
          }
        }
      }
      if (occurrences === 0) return vacuous(); // no known tech named anywhere yet
      if (wrong === 0) return pass();
      const frac = (occurrences - wrong) / occurrences;
      return {
        earned: Math.round(3 * frac * 10) / 10, passed: false,
        hint: `${wrong} technology name${wrong > 1 ? "s are" : " is"} miscased ('javascript' → 'JavaScript'). Correct casing signals attention to detail.`,
        targets: offenders,
      };
    },
  },
  {
    id: "STY-05", subScore: "style", section: "overall", points: 3, autoFixable: false,
    run: ({ doc, bullets }) => {
      const fields = [{ text: doc.summary, path: "summary" }, ...bullets.map((b) => ({ text: b.text, path: b.path }))]
        .filter((f) => f.text.trim());
      if (fields.length === 0) return vacuous();
      const hits = fields.filter((f) => /\b(i|my|me|we|our)\b/i.test(f.text));
      if (hits.length === 0) return pass();
      return {
        earned: 0, passed: false,
        hint: "Resumes never say 'I' or 'my'. Start straight from the verb: 'Built…', not 'I built…'.",
        targets: hits.map((f) => f.path),
      };
    },
  },
  {
    id: "STY-06", subScore: "style", section: "overall", points: 4, autoFixable: false,
    run: ({ doc, bullets }) => {
      const scan = [doc.summary, doc.headline, ...bullets.map((b) => b.text)].join("\n").toLowerCase();
      if (!scan.trim()) return vacuous();
      const found = CLICHES.filter((c) => scan.includes(c));
      if (found.length === 0) return pass();
      return {
        earned: Math.max(0, 4 - found.length), passed: false,
        hint: `'${found[0]}' appears on lakhs of resumes. Delete it and show the evidence instead — that's what the rest of this checklist does.`,
        targets: [],
      };
    },
  },
  {
    id: "STY-07", subScore: "style", section: "overall", points: 1, autoFixable: true,
    run: (input) => {
      const fields = textFields(input.doc);
      if (fields.length === 0) return vacuous();
      const hits = fields.filter((f) => /\s{2,}/.test(f.text) || f.text !== f.text.trim());
      if (hits.length === 0) return pass();
      return { earned: 0, passed: false, hint: "Extra spaces found — we'll clean them up.", targets: hits.map((f) => f.path) };
    },
  },
  {
    id: "STY-08", subScore: "style", section: "skills", points: 1, autoFixable: true,
    run: ({ doc }) => {
      if (doc.skillSections.every((s) => s.items.length === 0)) return vacuous();
      const seen = new Map<string, string>();
      let dupe: string | null = null;
      const targets: string[] = [];
      doc.skillSections.forEach((s, si) => {
        s.items.forEach((item, ii) => {
          const norm = normTerm(item);
          if (seen.has(norm)) {
            if (!dupe) dupe = item;
            targets.push(`skillSections[${si}].items[${ii}]`);
          } else {
            seen.set(norm, item);
          }
        });
      });
      if (!dupe) return pass();
      return { earned: 0, passed: false, hint: `'${dupe}' appears twice in your skills. Once is enough.`, targets };
    },
  },

  // ── Completeness (25) ──
  {
    id: "CMP-01", subScore: "completeness", section: "contact", points: 4, autoFixable: false,
    run: ({ doc }) => {
      const missing: string[] = [];
      if (!doc.contact.name.trim()) missing.push("name");
      if (!doc.contact.email.trim()) missing.push("email");
      if (missing.length === 0) return pass();
      return {
        earned: 0, passed: false,
        hint: `Add your ${missing.join(" and ")} — a resume without it goes straight to the reject pile.`,
        targets: missing.map((m) => `contact.${m}`),
      };
    },
  },
  {
    id: "CMP-02", subScore: "completeness", section: "contact", points: 2, autoFixable: false,
    run: ({ doc }) => {
      const email = doc.contact.email.trim();
      if (!email) return vacuous(); // CMP-01 carries the "add your email" hint
      const local = email.split("@")[0]?.toLowerCase() ?? "";
      const ok = EMAIL_RE.test(email)
        && /[a-z]{3,}/.test(local)
        && !UNPROFESSIONAL_EMAIL_TOKENS.some((t) => local.includes(t));
      if (ok) return pass();
      return {
        earned: 0, passed: false,
        hint: `'${email}' doesn't look recruiter-ready. Use a plain firstname.lastname address — Gmail is fine.`,
        targets: ["contact.email"],
      };
    },
  },
  {
    id: "CMP-03", subScore: "completeness", section: "contact", points: 1, autoFixable: true,
    run: ({ doc }) => {
      const phone = doc.contact.phone?.trim();
      if (!phone) {
        // Not auto-fixable: the fixer reformats a phone, it cannot invent one.
        return { earned: 0, passed: false, autoFixable: false, hint: "Add your phone number — Indian recruiters usually call before they email.", targets: ["contact.phone"] };
      }
      const digits = phone.replace(/\D/g, "");
      const ok = /^(91)?[6-9]\d{9}$/.test(digits) || (phone.startsWith("+") && digits.length >= 10 && digits.length <= 14);
      if (ok) return pass();
      // Reformattable only when the digits actually form an Indian mobile;
      // "09876543" is simply wrong and needs the student to retype it.
      const fixable = isIndianMobileFixable(phone);
      return {
        earned: 0, passed: false, autoFixable: fixable,
        hint: fixable
          ? "Format your phone as +91 XXXXX XXXXX so it's unambiguous internationally."
          : "That phone number looks incomplete — check the digits and write it as +91 XXXXX XXXXX.",
        targets: ["contact.phone"],
      };
    },
  },
  {
    id: "CMP-04", subScore: "completeness", section: "contact", points: 2, autoFixable: false,
    run: ({ doc }) => {
      const ok = doc.contact.links.some((l) => l.kind === "linkedin" && /linkedin\.com\/in\/[A-Za-z0-9%-]{3,}/i.test(l.url));
      if (ok) return pass();
      return { earned: 0, passed: false, hint: "Add your LinkedIn URL (linkedin.com/in/yourname) — recruiters look for it.", targets: ["contact.links"] };
    },
  },
  {
    id: "CMP-05", subScore: "completeness", section: "contact", points: 2, autoFixable: false,
    run: ({ doc }) => {
      const ok = doc.contact.links.some((l) => l.kind === "github" && /github\.com\/[A-Za-z0-9-]{1,39}/i.test(l.url));
      if (ok) return pass();
      return { earned: 0, passed: false, hint: "For engineering roles a GitHub link is expected. Add yours — even 2-3 real repos help.", targets: ["contact.links"] };
    },
  },
  {
    id: "CMP-06", subScore: "completeness", section: "education", points: 3, autoFixable: false,
    run: ({ doc }) => {
      const ok = doc.education.some((e) => e.degree.trim() && e.institution.trim() && /^(\d{4}|Present)$/i.test(e.end.trim()));
      if (ok) return pass();
      return { earned: 0, passed: false, hint: "Complete your education entry: degree, college, and graduation year.", targets: ["education"] };
    },
  },
  {
    id: "CMP-07", subScore: "completeness", section: "skills", points: 3, autoFixable: false,
    run: ({ doc }) => {
      const total = doc.skillSections.reduce((n, s) => n + s.items.length, 0);
      if (total >= 5 && doc.skillSections.length >= 2) return pass();
      return { earned: 0, passed: false, hint: "List at least 5 skills grouped into categories (Languages / Frameworks / Tools).", targets: ["skillSections"] };
    },
  },
  {
    id: "CMP-08", subScore: "completeness", section: "overall", points: 4, autoFixable: false,
    run: ({ doc }) => {
      const entries = [...doc.experience, ...doc.projects];
      const enough = entries.length >= 2;
      const allHaveBullets = entries.length > 0 && entries.every((e) => e.bullets.length >= 2);
      const earned = (enough ? 2 : 0) + (allHaveBullets ? 2 : 0);
      if (earned === 4) return pass();
      return {
        earned, passed: false,
        hint: "Add at least 2 experience or project entries with 2+ bullets each — this is the section recruiters actually read.",
        targets: [],
      };
    },
  },
  {
    id: "CMP-09", subScore: "completeness", section: "summary", points: 2, autoFixable: false,
    run: ({ doc }) => {
      if (doc.summary.trim()) return pass();
      return { earned: 0, passed: false, hint: "Write a 2-3 line summary. It's the first thing read in a 7-second skim.", targets: ["summary"] };
    },
  },
  {
    id: "CMP-10", subScore: "completeness", section: "education", points: 1, autoFixable: false,
    run: ({ doc }) => {
      if (doc.education.length === 0) return vacuous(); // CMP-06 carries the hint
      if (doc.education.some((e) => e.cgpa && e.cgpa.trim())) return pass();
      return { earned: 0, passed: false, hint: "Indian recruiters filter on CGPA. Add yours if it's 7.0+; leave off only if below.", targets: ["education"] };
    },
  },
  {
    id: "CMP-11", subScore: "completeness", section: "projects", points: 1, autoFixable: false,
    run: ({ doc }) => {
      if (doc.projects.length === 0) return vacuous(); // CMP-08 covers substance
      if (doc.projects.some((p) => p.link && p.link.trim())) return pass();
      return { earned: 0, passed: false, hint: "Add a GitHub or live link to at least one project — proof beats description.", targets: ["projects"] };
    },
  },

  // ── ATS-readiness (15) ──
  {
    id: "ATS-01", subScore: "ats", section: "overall", points: 3, autoFixable: true,
    run: ({ doc }) => {
      const order = doc.order;
      // Ordering nothing correctly is not an achievement.
      if (order.every((k) => isSectionEmpty(doc, k))) return vacuous();
      const problems: string[] = [];
      if (order[0] !== "summary") problems.push("summary");
      const expIdx = order.indexOf("experience");
      const projIdx = order.indexOf("projects");
      if (doc.experience.length > 0 && expIdx !== -1 && projIdx !== -1 && expIdx > projIdx) problems.push("experience");
      const eduIdx = order.indexOf("education");
      if (eduIdx > 3) problems.push("education");
      if (problems.length === 0) return pass();
      return {
        earned: 0, passed: false,
        hint: `Your section order buries ${problems[0]}. For students: Summary → Skills/Education → Experience → Projects reads best.`,
        targets: ["order"],
      };
    },
  },
  {
    id: "ATS-02", subScore: "ats", section: "overall", points: 2, autoFixable: true,
    run: ({ doc }) => {
      const seen = new Set<string>();
      let bad = false;
      for (const key of doc.order) {
        if (seen.has(key)) bad = true;
        seen.add(key);
        if (isSectionEmpty(doc, key)) bad = true;
      }
      const allKeys: SectionKey[] = ["summary", "experience", "projects", "skills", "education", "certifications", "achievements"];
      for (const key of allKeys) {
        if (!isSectionEmpty(doc, key) && !seen.has(key)) bad = true;
      }
      if (!bad) return pass();
      return { earned: 0, passed: false, hint: "Section list is out of sync — we'll repair it.", targets: ["order"] };
    },
  },
  {
    id: "ATS-03", subScore: "ats", section: "overall", points: 3, autoFixable: true,
    run: (input) => {
      // Deliberately NOT applied to contact.name — Devanagari or other scripts
      // in a person's name are correct, not an ATS defect.
      const fields = textFields(input.doc);
      if (fields.length === 0) return vacuous();
      const hits = fields.filter((f) => !ATS_SAFE_RE.test(f.text));
      if (hits.length === 0) return pass();
      return {
        earned: 0, passed: false,
        hint: `Found ${hits.length} special character${hits.length > 1 ? "s" : ""} (emoji/symbols) an ATS parser may garble. We'll strip or replace them.`,
        targets: hits.map((f) => f.path),
      };
    },
  },
  {
    id: "ATS-04", subScore: "ats", section: "skills", points: 3, autoFixable: false,
    run: ({ doc, bullets }) => {
      const skillText = doc.skillSections.map((s) => s.items.join(", ")).join(", ");
      const skillTerms = scanLexicon(skillText);
      if (skillTerms.length < 3) {
        return { earned: 0, passed: false, hint: "List your actual stack (React, Python, SQL…) in skills — that's what keyword scanners read.", targets: ["skillSections"] };
      }
      const bulletText = bullets.map((b) => b.text).join("\n");
      const inBullets = skillTerms.some((t) => scanLexicon(bulletText).includes(t));
      if (inBullets) return pass();
      return {
        earned: 1, passed: false,
        hint: "Your skills list and your bullets don't mention the same technologies. Name your stack inside the bullets — that's what keyword scanners read.",
        targets: [],
      };
    },
  },
  {
    id: "ATS-05", subScore: "ats", section: "contact", points: 2, autoFixable: true,
    run: ({ doc }) => {
      if (doc.contact.links.length === 0) return vacuous(); // CMP-04/05 ask for the links
      const bad: string[] = [];
      doc.contact.links.forEach((l, i) => {
        try {
          const u = new URL(l.url.startsWith("http") ? l.url : `https://${l.url}`);
          const expected = `${u.hostname}${u.pathname}`.replace(/\/$/, "");
          if (l.label !== expected) bad.push(`contact.links[${i}]`);
        } catch {
          bad.push(`contact.links[${i}]`);
        }
      });
      if (bad.length === 0) return pass();
      return { earned: 0, passed: false, hint: "A contact link looks malformed — we'll normalize it.", targets: bad };
    },
  },
  {
    id: "ATS-06", subScore: "ats", section: "overall", points: 2, autoFixable: true,
    run: ({ bullets }) => {
      if (bullets.length === 0) return vacuous();
      const hits = bullets.filter((b) => b.text.includes("\t") || b.text.includes("|"));
      if (hits.length === 0) return pass();
      return {
        earned: 0, passed: false,
        hint: "Tabs and pipe characters inside bullets break ATS parsing — we'll replace them.",
        targets: hits.map((b) => b.path),
      };
    },
  },
];

const SUB_SCORE_MAX: Record<SubScoreKey, number> = { impact: 25, brevity: 15, style: 20, completeness: 25, ats: 15 };

// ─── Entry point ─────────────────────────────────────────────────────────────

export function buildQualityReport(
  doc: ResumeDocument,
  opts?: { density?: TemplateDensity },
): QualityReport {
  const layout = estimateLayout(doc, opts?.density ?? "normal");
  const bullets = collectBullets(doc);
  const input: RuleInput = { doc, bullets, layout };

  const rules: QualityRuleResult[] = RULES.map((def) => {
    const r = def.run(input);
    const isVacuous = r.vacuous === true;
    return {
      id: def.id,
      subScore: def.subScore,
      section: def.section,
      points: def.points,
      earned: r.passed ? def.points : Math.min(def.points, Math.max(0, r.earned)),
      passed: r.passed,
      hint: r.hint,
      // A vacuous rule has nothing to fix, so it must never inflate the
      // "Fix N formatting issues" chip into a no-op. Rules may also opt out
      // per-failure when that specific failure isn't mechanically repairable.
      autoFixable: def.autoFixable && !r.passed && !isVacuous && r.autoFixable !== false,
      targets: r.targets,
      vacuous: isVacuous,
    };
  });

  const subScores = {} as Record<SubScoreKey, QualitySubScore>;
  for (const key of Object.keys(SUB_SCORE_MAX) as SubScoreKey[]) {
    const mine = rules.filter((r) => r.subScore === key);
    const earned = mine.reduce((n, r) => n + r.earned, 0);
    const max = SUB_SCORE_MAX[key];
    subScores[key] = { earned: Math.round(earned * 10) / 10, max, pct: Math.round((earned / max) * 100) };
  }

  const total = Math.round(rules.reduce((n, r) => n + r.earned, 0));
  const quantified = bullets.filter((b) => isQuantifiedBullet(b.text)).length;

  return {
    version: "quality-v1",
    total: Math.max(0, Math.min(100, total)),
    subScores,
    rules,
    layout,
    bulletStats: { total: bullets.length, quantified },
  };
}
