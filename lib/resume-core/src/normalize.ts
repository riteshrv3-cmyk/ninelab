// Term normalization shared by keyword extraction, ATS scoring, and the
// fabrication gate's forbidden-term scan. The goal is exact, predictable
// matching — no substring matching, no fuzzy scoring.

/** Canonical name -> alternate spellings/casings a JD or resume might use. */
export const ALIASES: Record<string, string[]> = {
  "node.js": ["node", "nodejs", "node js"],
  "react": ["react.js", "reactjs"],
  "vue": ["vue.js", "vuejs"],
  "next.js": ["nextjs", "next"],
  "postgresql": ["postgres", "psql", "pg"],
  "javascript": ["js", "es6", "ecmascript"],
  "typescript": ["ts"],
  "c++": ["cpp"],
  "c#": ["csharp", "c sharp"],
  ".net": ["dotnet", "dot net"],
  "rest apis": ["rest api", "restful api", "restful apis", "rest"],
  "ci/cd": ["ci cd", "continuous integration", "continuous deployment"],
  "scikit-learn": ["sklearn"],
  "kubernetes": ["k8s"],
  "amazon web services": ["aws"],
  "google cloud platform": ["gcp"],
  "machine learning": ["ml"],
  "artificial intelligence": ["ai"],
  "golang": ["go"],
  "objective-c": ["objective c", "objc"],
  "express": ["express.js", "expressjs"],
  "mongodb": ["mongo"],
  "html": ["html5"],
  "css": ["css3"],
  "tailwindcss": ["tailwind css"],
  "natural language processing": ["nlp"],
  "data structures and algorithms": ["dsa", "data structures & algorithms"],
  "object-oriented programming": ["oop", "oops", "object oriented programming"],
  "large language models": ["llm", "llms"],
  "user interface": ["ui"],
  "application programming interface": ["api"],
};

/** Reverse lookup: alias -> canonical term, built once. */
const ALIAS_TO_CANONICAL = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase(), canonical);
  }
}

/**
 * Normalize a term for exact matching: lowercase, trim, collapse whitespace,
 * map known aliases to their canonical form. Atomic tokens like "c++"/"c#"/
 * ".net"/"node.js" are preserved (not split on punctuation) because they are
 * looked up as whole strings, never tokenized further.
 */
export function normTerm(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return ALIAS_TO_CANONICAL.get(trimmed) ?? trimmed;
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "with", "is", "are", "was", "were", "be", "been", "being", "this", "that",
  "as", "by", "from", "it", "its", "will", "would", "should", "can", "could",
]);

/**
 * Tokenize text into normalized 1/2/3-grams for exact-set-membership matching.
 * This is what makes ATS scoring precise: "C" cannot match "Scala" (no
 * substring test), and JSON key names never appear here because this only
 * ever runs on `renderPlainText()` output, never on a serialized object.
 */
export function tokenizeToNgrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s.+#/-]/g, " ")
    .split(/\s+/)
    .map(cleanToken)
    .filter(Boolean);

  const grams = new Set<string>();
  const add = (g: string) => {
    grams.add(g);
    const single = singular(g);
    if (single !== g) grams.add(normTerm(single));
  };
  for (let i = 0; i < words.length; i++) {
    const w1 = words[i];
    if (!STOPWORDS.has(w1)) add(normTerm(w1));
    if (i + 1 < words.length) {
      const w2 = words[i + 1];
      add(normTerm(`${w1} ${w2}`));
      if (i + 2 < words.length) {
        const w3 = words[i + 2];
        add(normTerm(`${w1} ${w2} ${w3}`));
      }
    }
    // "React/Node.js" and "CI/CD": match the whole and each side.
    if (w1.includes("/") && w1 !== "ci/cd") {
      for (const part of w1.split("/").map(cleanToken).filter(Boolean)) add(normTerm(part));
    }
  }
  return grams;
}

/**
 * Strips sentence punctuation from the edges of a token so "Docker." and
 * "(React," match. A leading dot is kept only for ".net"; interior dots
 * ("node.js") and symbol suffixes ("c++", "c#") are untouched.
 */
function cleanToken(w: string): string {
  let t = w.replace(/^[-(\[{'"]+/, "").replace(/[-)\]}'",:;!?]+$/, "");
  while (t.endsWith(".")) t = t.slice(0, -1);
  if (t.startsWith(".") && t !== ".net") t = t.replace(/^\.+/, "");
  return t;
}

/**
 * Light plural folding for keyword matching: "APIs" matches "API",
 * "microservices" matches "microservice". Conservative on purpose: words
 * ending in ss/us/is and short tokens are left alone.
 */
export function singular(term: string): string {
  const parts = term.split(" ");
  const last = parts[parts.length - 1];
  if (last.length <= 3 || !last.endsWith("s") || /(ss|us|is|ys)$/.test(last)) return term;
  const base = /ies$/.test(last) ? `${last.slice(0, -3)}y` : last.slice(0, -1);
  parts[parts.length - 1] = base;
  return parts.join(" ");
}

/** Forms of a keyword to look for in a tokenized resume. */
export function termVariants(term: string): string[] {
  const out = new Set([term, normTerm(singular(term))]);
  return [...out];
}
