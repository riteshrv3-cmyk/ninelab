import { applyAutoFixes } from "./autofix";
import { normTerm } from "./normalize";
import type { ResumeDocument, SectionKey, SkillSection } from "./types";

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
  // Any separator the model picks ("·", "•", "–", ":") becomes a pipe; a
  // stray middle dot would otherwise be stripped as unsafe and glue words.
  return headline.split(/\s*(?:[|,;:·•–—]|\s-\s)\s*/).map((p) => p.trim()).filter(Boolean).join(" | ");
}

/** "Aspiring Software Developer" -> "Software Developer": the one cliché
 * that can be dropped without rewriting the sentence around it. */
export function dropAspiring(text: string): string {
  return text.replace(/\baspiring\s+/gi, "").replace(/^([a-z])/, (c) => c.toUpperCase());
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Checkers want a 2-3 line summary and ~300+ words overall; the AI summary
 * sometimes ends up a single short line after the honesty gate trims it.
 * Tops it up to ~25+ words with sentences built only from facts already on
 * the resume (education, internship, projects, listed skills).
 */
export function ensureSummary(doc: ResumeDocument, nowYear = new Date().getFullYear()): ResumeDocument {
  let summary = doc.summary.trim();
  if (wordCount(summary) >= 25) return doc;
  const has = (s: string) => summary.toLowerCase().includes(s.toLowerCase());
  const extras: string[] = [];

  const skills = doc.skillSections.flatMap((s) => s.items).slice(0, 4);
  const role = doc.headline.split("|")[0]?.trim();
  if (!summary && role && skills.length >= 2) extras.push(`${role} with hands-on experience in ${listJoin(skills)}.`);

  const ed = doc.education[0];
  if (ed?.institution && !has(ed.institution)) {
    const subject = ed.degree.includes(" in ") ? ed.degree.split(" in ").slice(1).join(" in ") : ed.degree;
    const year = /^\d{4}$/.test(ed.end.trim()) ? Number(ed.end.trim()) : null;
    const when = year === null ? "" : year >= nowYear ? `, graduating in ${year}` : `, graduated in ${year}`;
    const cgpa = ed.cgpa ? ` with a CGPA of ${ed.cgpa}` : "";
    extras.push(`${year !== null && year < nowYear ? "Graduate in" : "Student of"} ${subject} at ${ed.institution}${when}${cgpa}.`);
  }

  const job = doc.experience.find((e) => e.bullets.some((b) => !b.suggested));
  if (job?.company && !has(job.company)) extras.push(`Worked as ${job.role} at ${job.company}.`);

  const projects = doc.projects.filter((p) => p.bullets.some((b) => !b.suggested)).map((p) => p.title).slice(0, 2);
  if (projects.length && !projects.every(has)) extras.push(`Built ${projects.length === 1 ? "the project" : "projects including"} ${listJoin(projects)}.`);

  for (const sentence of extras) {
    if (wordCount(summary) >= 25 || wordCount(`${summary} ${sentence}`) > 45) break;
    summary = summary ? `${summary.replace(/([^.!?])$/, "$1.")} ${sentence}` : sentence;
  }
  return summary === doc.summary ? doc : { ...doc, summary };
}

// Indian fresher order (placement-cell and recruiter guides): education and
// skills before work. Tested: ResumeGo only detected the Education section
// when it came straight after the summary.
const FRESHER_ORDER: SectionKey[] = ["summary", "education", "skills", "experience", "projects", "certifications", "achievements"];

export function fresherOrder(doc: ResumeDocument): ResumeDocument {
  const present = new Set(doc.order);
  const order = FRESHER_ORDER.filter((k) => present.has(k));
  for (const k of doc.order) if (!order.includes(k)) order.push(k);
  return order.join() === doc.order.join() ? doc : { ...doc, order };
}

/** Standard category for a skill name, or null when unknown. */
export function skillCategory(item: string): string | null {
  return GROUP_OF.get(normTerm(item)) ?? null;
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
  return ensureSummary(fresherOrder(applyAutoFixes(shaped).doc));
}
