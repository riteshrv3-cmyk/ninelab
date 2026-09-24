import { applyAutoFixes } from "./autofix";
import { normTerm } from "./normalize";
import type { ResumeDocument, SkillSection } from "./types";

// Standard ATS-recognised skill groups. Order is the order they print in.
const SKILL_GROUPS: Array<{ category: string; terms: string[] }> = [
  { category: "Languages", terms: ["python", "java", "c", "c++", "c#", "javascript", "typescript", "golang", "kotlin", "swift", "sql", "r", "php", "ruby", "dart", "rust", "scala", "matlab", "bash", "shell scripting"] },
  { category: "Frameworks & Libraries", terms: ["react", "angular", "vue", "node.js", "express", "django", "flask", "fastapi", "spring", "spring boot", "next.js", "tailwindcss", "bootstrap", "redux", "jquery", "flutter", "react native", ".net", "laravel", "rails", "junit", "jest", "pytest", "selenium"] },
  { category: "Web Technologies", terms: ["html", "css", "sass", "rest apis", "graphql", "websockets", "application programming interface"] },
  { category: "Databases", terms: ["mysql", "postgresql", "mongodb", "redis", "sqlite", "firebase", "firestore", "oracle", "dynamodb", "cassandra", "supabase", "elasticsearch"] },
  { category: "Data & Machine Learning", terms: ["pandas", "numpy", "tensorflow", "pytorch", "keras", "scikit-learn", "machine learning", "deep learning", "natural language processing", "computer vision", "opencv", "tableau", "power bi", "excel", "matplotlib", "seaborn", "data analytics", "large language models"] },
  { category: "Cloud & DevOps", terms: ["amazon web services", "azure", "google cloud platform", "docker", "kubernetes", "jenkins", "github actions", "ci/cd", "terraform", "linux", "nginx", "heroku", "vercel", "netlify"] },
  { category: "Tools", terms: ["git", "github", "gitlab", "postman", "jira", "figma", "vs code", "android studio", "intellij", "eclipse", "canva"] },
];

const GROUP_OF = new Map<string, string>();
for (const g of SKILL_GROUPS) for (const t of g.terms) GROUP_OF.set(t, g.category);

/**
 * A single flat skills list ("Languages: C, CSS, SQL, HTML, Python") reads as
 * careless and fails the categorised-skills check. Split it into standard
 * groups when at least two groups result; anything unknown goes under
 * "Other Skills". Multiple existing categories are left as the author chose.
 */
export function regroupSkills(doc: ResumeDocument): ResumeDocument {
  if (doc.skillSections.length !== 1) return doc;
  const only = doc.skillSections[0];
  if (only.items.length < 4) return doc;
  const buckets = new Map<string, string[]>();
  for (const item of only.items) {
    const cat = GROUP_OF.get(normTerm(item)) ?? "Other Skills";
    buckets.set(cat, [...(buckets.get(cat) ?? []), item]);
  }
  if (buckets.size < 2) return doc;
  const order = [...SKILL_GROUPS.map((g) => g.category), "Other Skills"];
  const sections: SkillSection[] = order
    .filter((c) => buckets.has(c))
    .map((category) => ({ category, items: buckets.get(category)!, evidence: only.evidence }));
  return { ...doc, skillSections: sections };
}

// Indian degree abbreviations, spelled out with the short form kept: parsers
// match "Bachelor"/"Master", recruiters search either form.
const DEGREES: Array<[RegExp, string]> = [
  [/^B\.?\s?E\.?(?=\s|$|,)/i, "Bachelor of Engineering (B.E.)"],
  [/^B\.?\s?Tech\.?(?=\s|$|,)/i, "Bachelor of Technology (B.Tech)"],
  [/^M\.?\s?Tech\.?(?=\s|$|,)/i, "Master of Technology (M.Tech)"],
  [/^M\.?\s?E\.?(?=\s|$|,)/i, "Master of Engineering (M.E.)"],
  [/^B\.?\s?C\.?\s?A\.?(?=\s|$|,)/i, "Bachelor of Computer Applications (BCA)"],
  [/^M\.?\s?C\.?\s?A\.?(?=\s|$|,)/i, "Master of Computer Applications (MCA)"],
  [/^B\.?\s?Sc\.?(?=\s|$|,)/i, "Bachelor of Science (B.Sc.)"],
  [/^M\.?\s?Sc\.?(?=\s|$|,)/i, "Master of Science (M.Sc.)"],
  [/^B\.?\s?B\.?\s?A\.?(?=\s|$|,)/i, "Bachelor of Business Administration (BBA)"],
  [/^M\.?\s?B\.?\s?A\.?(?=\s|$|,)/i, "Master of Business Administration (MBA)"],
  [/^B\.?\s?Com\.?(?=\s|$|,)/i, "Bachelor of Commerce (B.Com)"],
];

export function expandDegree(degree: string): string {
  const d = degree.trim();
  if (/^(bachelor|master|doctor|diploma)/i.test(d)) return d;
  for (const [re, full] of DEGREES) {
    const m = d.match(re);
    if (m) {
      const rest = d.slice(m[0].length).replace(/^[\s,.-]+/, "").replace(/^in\s+/i, "");
      return rest ? `${full} in ${rest}` : full;
    }
  }
  return d;
}

/** "Backend Developer | Java, Spring Boot" -> "Backend Developer | Java | Spring Boot":
 * a comma after a word reads as "City, ST" to some location parsers. */
export function pipeHeadline(headline: string): string {
  return headline.split(/\s*[|,]\s*/).filter(Boolean).join(" | ");
}

/** "Aspiring Software Developer" -> "Software Developer": the one cliché
 * that can be dropped without rewriting the sentence around it. */
export function dropAspiring(text: string): string {
  return text.replace(/\baspiring\s+/gi, "").replace(/^([a-z])/, (c) => c.toUpperCase());
}

/**
 * Final deterministic pass on a freshly generated resume: standard skill
 * groups, then every mechanical fix (section order, casing, date format,
 * spelling, punctuation, whitespace). Nothing here changes a claim.
 */
export function polishGenerated(doc: ResumeDocument): ResumeDocument {
  const shaped: ResumeDocument = {
    ...regroupSkills(doc),
    headline: pipeHeadline(dropAspiring(doc.headline)),
    summary: dropAspiring(doc.summary),
    education: doc.education.map((e) => ({ ...e, degree: expandDegree(e.degree) })),
  };
  return applyAutoFixes(shaped).doc;
}
