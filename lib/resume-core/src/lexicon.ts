// A curated dictionary of resume-relevant technical terms, used as a fallback
// keyword source when stage 1's LLM extraction misses something, and as the
// deterministic path when there is no JD text at all (tags/role-title only).
// Not exhaustive by design — it exists to catch common terms a JD mentions in
// passing, not to replace stage 1's contextual grading.

const LANGUAGES = [
  "javascript", "typescript", "python", "java", "c++", "c#", "c", "go", "golang",
  "rust", "kotlin", "swift", "ruby", "php", "scala", "r", "matlab", "dart",
  "objective-c", "perl", "haskell", "elixir", "clojure", "lua", "julia", "sql",
];

const FRONTEND = [
  "react", "vue", "angular", "svelte", "next.js", "nuxt", "remix", "redux",
  "zustand", "mobx", "tailwindcss", "tailwind", "sass", "less", "webpack",
  "vite", "html", "css", "jquery", "graphql", "apollo", "storybook",
];

const BACKEND = [
  "node.js", "express", "nestjs", "django", "flask", "fastapi", "spring",
  "spring boot", "rails", "laravel", "asp.net", ".net", "gin", "fiber",
  "rest apis", "grpc", "graphql", "websockets", "microservices", "api gateway",
];

const DATABASES = [
  "postgresql", "mysql", "mongodb", "redis", "sqlite", "cassandra",
  "dynamodb", "elasticsearch", "neo4j", "firebase", "firestore", "supabase",
  "snowflake", "bigquery", "clickhouse", "influxdb",
];

const CLOUD_DEVOPS = [
  "aws", "amazon web services", "gcp", "google cloud platform", "azure",
  "docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions",
  "gitlab ci", "ci/cd", "nginx", "linux", "bash", "cloudformation",
  "prometheus", "grafana", "datadog", "kafka", "rabbitmq", "sqs", "lambda",
  "ec2", "s3", "cloudfront", "vercel", "netlify", "render", "heroku",
];

const DATA_ML = [
  "machine learning", "deep learning", "tensorflow", "pytorch", "keras",
  "scikit-learn", "pandas", "numpy", "nlp", "computer vision", "opencv",
  "data analytics", "data science", "spark", "hadoop", "airflow", "dbt",
  "tableau", "power bi", "matplotlib", "seaborn", "llm", "artificial intelligence",
  "generative ai", "prompt engineering", "rag", "vector databases", "langchain",
];

const MOBILE = [
  "android", "ios", "react native", "flutter", "swiftui", "jetpack compose",
  "xcode", "android studio", "core data", "realm",
];

const TESTING_QA = [
  "jest", "mocha", "chai", "cypress", "selenium", "playwright", "junit",
  "pytest", "unit testing", "integration testing", "test automation", "tdd",
  "bdd", "postman", "load testing",
];

const TOOLS_PRACTICES = [
  "git", "github", "gitlab", "bitbucket", "jira", "confluence", "agile",
  "scrum", "kanban", "figma", "system design", "dsa",
  "data structures", "algorithms", "oop", "design patterns", "clean code",
  "sql optimization", "distributed systems", "load balancing", "caching",
  "security", "oauth", "jwt", "authentication", "authorization",
];

const SECURITY = [
  "cybersecurity", "penetration testing", "owasp", "vulnerability assessment",
  "network security", "cryptography", "siem", "burp suite", "nmap", "wireshark",
];

export const TECH_LEXICON: ReadonlySet<string> = new Set(
  [
    ...LANGUAGES,
    ...FRONTEND,
    ...BACKEND,
    ...DATABASES,
    ...CLOUD_DEVOPS,
    ...DATA_ML,
    ...MOBILE,
    ...TESTING_QA,
    ...TOOLS_PRACTICES,
    ...SECURITY,
  ].map((t) => t.toLowerCase()),
);

export function isTechTerm(term: string): boolean {
  return TECH_LEXICON.has(term.toLowerCase().trim());
}

/**
 * Scan raw text for lexicon terms that appear, longest-match-first so
 * "machine learning" is caught before "learning" would be (which isn't in
 * the lexicon anyway, but the ordering matters for future additions).
 */
export function scanLexicon(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const sorted = [...TECH_LEXICON].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    // Word-boundary check so "go" doesn't match inside "google" or "algorithm".
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
    if (pattern.test(lower)) found.push(term);
  }
  return found;
}

// ─── Writing-quality word lists ──────────────────────────────────────────────
// Shared by the deterministic quality rules (quality.ts), the auto-fixer
// (autofix.ts), and the drafting/rewrite prompts, so the rules that score a
// resume and the prompts that write one can never drift apart.

/** Weak bullet openers that describe presence, not action. */
export const WEAK_OPENERS = [
  "responsible for", "worked on", "helped", "assisted", "involved in",
  "participated in", "was part of", "part of", "tasked with", "handled",
] as const;

/** Corporate filler verbs an engineer would never say out loud. */
export const FILLER_VERBS = [
  "utilized", "utilised", "leveraged", "spearheaded", "synergized",
  "endeavored", "facilitated",
] as const;

/** Self-congratulating adjectives — claims without evidence. */
export const SELF_ADJECTIVES = [
  "robust", "scalable", "seamless", "cutting-edge", "state-of-the-art",
  "world-class", "innovative", "dynamic", "efficient and effective",
] as const;

/** Phrases that appear on lakhs of resumes and carry zero signal. */
export const CLICHES = [
  "passionate", "highly motivated", "hardworking", "hard-working", "team player",
  "results-driven", "result oriented", "detail-oriented", "go-getter", "self-starter",
  "think outside the box", "proven track record", "dynamic individual", "quick learner",
  "fast learner", "seeking an opportunity", "aspiring", "enthusiastic learner",
  "excellent communication skills", "go the extra mile", "works well under pressure",
  "dedicated professional",
] as const;

/** Words/marks that signal a stated outcome inside a bullet. */
export const OUTCOME_CUES = [
  "reduced", "increased", "improved", "cut", "saved", "grew", "accelerated",
  "decreased", "boosted", "achieved", "shipped", "launched", "scaled",
  "automated", "sped up", "%", "x faster",
] as const;

/**
 * Lowercase lexicon term -> canonical display casing. Only terms in this map
 * are ever recased by the auto-fixer; unknown terms are NEVER touched.
 */
export const CANONICAL_CASE: Record<string, string> = {
  // "golang" -> "Go" would be a rename, not a recase, so it's absent.
  "javascript": "JavaScript", "typescript": "TypeScript", "python": "Python", "java": "Java",
  "c++": "C++", "c#": "C#", "rust": "Rust", "kotlin": "Kotlin",
  "swift": "Swift", "ruby": "Ruby", "php": "PHP", "scala": "Scala", "dart": "Dart",
  "sql": "SQL", "html": "HTML", "css": "CSS", "matlab": "MATLAB",
  "react": "React", "vue": "Vue", "angular": "Angular", "svelte": "Svelte",
  "next.js": "Next.js", "nuxt": "Nuxt", "remix": "Remix", "redux": "Redux",
  "zustand": "Zustand", "mobx": "MobX", "tailwindcss": "TailwindCSS", "tailwind": "Tailwind",
  "sass": "Sass", "webpack": "Webpack", "vite": "Vite", "jquery": "jQuery",
  "graphql": "GraphQL", "apollo": "Apollo", "storybook": "Storybook",
  "node.js": "Node.js", "express": "Express", "nestjs": "NestJS", "django": "Django",
  "flask": "Flask", "fastapi": "FastAPI", "spring": "Spring", "spring boot": "Spring Boot",
  "rails": "Rails", "laravel": "Laravel", "asp.net": "ASP.NET", ".net": ".NET",
  "grpc": "gRPC", "websockets": "WebSockets", "rest apis": "REST APIs",
  "postgresql": "PostgreSQL", "mysql": "MySQL", "mongodb": "MongoDB", "redis": "Redis",
  "sqlite": "SQLite", "cassandra": "Cassandra", "dynamodb": "DynamoDB",
  "elasticsearch": "Elasticsearch", "neo4j": "Neo4j", "firebase": "Firebase",
  "firestore": "Firestore", "supabase": "Supabase", "snowflake": "Snowflake",
  "bigquery": "BigQuery", "clickhouse": "ClickHouse", "influxdb": "InfluxDB",
  "aws": "AWS", "gcp": "GCP", "azure": "Azure", "docker": "Docker",
  "kubernetes": "Kubernetes", "terraform": "Terraform", "ansible": "Ansible",
  "jenkins": "Jenkins", "github actions": "GitHub Actions", "gitlab ci": "GitLab CI",
  "ci/cd": "CI/CD", "nginx": "Nginx", "linux": "Linux", "bash": "Bash",
  "cloudformation": "CloudFormation", "prometheus": "Prometheus", "grafana": "Grafana",
  "datadog": "Datadog", "kafka": "Kafka", "rabbitmq": "RabbitMQ", "sqs": "SQS",
  "lambda": "Lambda", "ec2": "EC2", "s3": "S3", "cloudfront": "CloudFront",
  // "render" is deliberately absent — it's a common English verb in bullets.
  "vercel": "Vercel", "netlify": "Netlify", "heroku": "Heroku",
  "tensorflow": "TensorFlow", "pytorch": "PyTorch", "keras": "Keras",
  "scikit-learn": "scikit-learn", "pandas": "pandas", "numpy": "NumPy",
  "nlp": "NLP", "opencv": "OpenCV", "spark": "Spark", "hadoop": "Hadoop",
  "airflow": "Airflow", "dbt": "dbt", "tableau": "Tableau", "power bi": "Power BI",
  "matplotlib": "Matplotlib", "seaborn": "Seaborn", "llm": "LLM", "rag": "RAG",
  "langchain": "LangChain",
  "android": "Android", "ios": "iOS", "react native": "React Native",
  "flutter": "Flutter", "swiftui": "SwiftUI", "jetpack compose": "Jetpack Compose",
  "xcode": "Xcode", "android studio": "Android Studio", "realm": "Realm",
  "jest": "Jest", "mocha": "Mocha", "chai": "Chai", "cypress": "Cypress",
  "selenium": "Selenium", "playwright": "Playwright", "junit": "JUnit",
  "pytest": "pytest", "tdd": "TDD", "bdd": "BDD", "postman": "Postman",
  "git": "Git", "github": "GitHub", "gitlab": "GitLab", "bitbucket": "Bitbucket",
  "jira": "Jira", "confluence": "Confluence", "agile": "Agile", "scrum": "Scrum",
  "kanban": "Kanban", "figma": "Figma", "dsa": "DSA", "oop": "OOP",
  "oauth": "OAuth", "jwt": "JWT", "owasp": "OWASP", "siem": "SIEM",
  "burp suite": "Burp Suite", "nmap": "Nmap", "wireshark": "Wireshark",
};

// ─── Honesty-gate vocabulary ─────────────────────────────────────────────────

/**
 * Lexicon entries that are ordinary practices or concepts, not a specific
 * technology a student can be caught lying about. Naming "security" or
 * "agile" in a summary is not a fabricated stack claim.
 */
export const PRACTICE_TERMS: ReadonlySet<string> = new Set([
  "agile", "scrum", "kanban", "system design", "dsa", "data structures", "algorithms",
  "oop", "design patterns", "clean code", "sql optimization", "distributed systems",
  "load balancing", "caching", "security", "authentication", "authorization",
  "data analytics", "data science", "unit testing", "integration testing",
  "test automation", "load testing", "tdd", "bdd", "microservices", "rest apis",
  "machine learning", "deep learning", "artificial intelligence", "generative ai",
  "prompt engineering", "computer vision", "nlp", "cybersecurity", "network security",
  "vulnerability assessment", "penetration testing", "cryptography", "ci/cd",
]);

/**
 * Tech names that are also everyday English words. They count as a tech claim
 * only when written the way the technology is written (capitalised, not at
 * the start of a sentence), so "go live", "render", "express interest" or
 * "less than" never trip the honesty gate.
 */
const AMBIGUOUS_TECH = new Set([
  "go", "r", "c", "express", "render", "lambda", "spark", "swift", "rust", "ruby",
  "dart", "julia", "lua", "less", "spring", "gin", "fiber", "rails", "realm",
  "apollo", "remix", "vite", "jest", "mocha", "chai", "gatsby", "flask", "fastapi",
  "android", "linux", "git", "rag",
]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Specific technologies the text claims, for the honesty gate. Practices are
 * ignored, and ambiguous English words only count in tech casing mid-sentence.
 */
export function scanClaimedTech(text: string): string[] {
  const found: string[] = [];
  for (const term of scanLexicon(text)) {
    if (PRACTICE_TERMS.has(term)) continue;
    if (!AMBIGUOUS_TECH.has(term)) {
      found.push(term);
      continue;
    }
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(term)}(?![A-Za-z0-9+#])`, "gi");
    let m: RegExpExecArray | null;
    let claimed = false;
    while ((m = re.exec(text)) !== null) {
      const word = m[0];
      const before = text.slice(0, m.index).trimEnd();
      const sentenceStart = before === "" || /[.!?:;\n•\-–—|]$/.test(before);
      const techCased = term.length === 1 ? word === word.toUpperCase() : /^[A-Z]/.test(word);
      // "C." / "R." read as initials, not languages.
      const initial = term.length === 1 && text[m.index + 1] === ".";
      if (techCased && !sentenceStart && !initial) {
        claimed = true;
        break;
      }
    }
    if (claimed) found.push(term);
  }
  return found;
}

// ─── Spelling ────────────────────────────────────────────────────────────────

/**
 * Misspellings that show up on real student resumes, mapped to the fix.
 * A curated list rather than a dictionary: every hit is a certain error, so
 * the rule never flags a correct tech name or an Indian proper noun.
 */
export const MISSPELLINGS: Readonly<Record<string, string>> = {
  acheived: "achieved", achived: "achieved", acheive: "achieve", accomodate: "accommodate",
  adress: "address", algorithim: "algorithm", algoritm: "algorithm", analysys: "analysis",
  appication: "application", applicaton: "application",
  architecure: "architecture", begining: "beginning", calender: "calendar",
  collabrated: "collaborated", colaborated: "collaborated", comunication: "communication",
  communcation: "communication", commited: "committed", completly: "completely",
  concious: "conscious", databse: "database", definately: "definitely",
  deployement: "deployment", develope: "develop", developped: "developed",
  developement: "development", devlopment: "development", efficency: "efficiency",
  enviroment: "environment", enviornment: "environment", excercise: "exercise",
  existance: "existence", experiance: "experience", expirience: "experience",
  familar: "familiar", funtionality: "functionality", functionallity: "functionality",
  goverment: "government", guidence: "guidance", immediatly: "immediately",
  implimented: "implemented", implemeted: "implemented", improvment: "improvement",
  independant: "independent", informations: "information", integeration: "integration",
  intergration: "integration", knowlege: "knowledge", knowledgable: "knowledgeable",
  langauge: "language", languge: "language", maintainance: "maintenance",
  maintenence: "maintenance", managment: "management", mangement: "management",
  neccessary: "necessary", necesary: "necessary", occured: "occurred", occurence: "occurrence",
  optimzed: "optimized", optmized: "optimized",
  perfomance: "performance", performace: "performance", persue: "pursue",
  prefered: "preferred", proffesional: "professional", profesional: "professional",
  programing: "programming", recieve: "receive", recieved: "received",
  reccomend: "recommend", recomend: "recommend", relevent: "relevant",
  reponsive: "responsive", resposive: "responsive", responsibilty: "responsibility",
  responsiblity: "responsibility", seperate: "separate", seperately: "separately",
  sofware: "software", softwere: "software", sucessful: "successful",
  successfull: "successful", sucessfully: "successfully", succesfully: "successfully",
  sytem: "system", systme: "system", techincal: "technical", tehnical: "technical",
  technolgy: "technology", techonology: "technology", teh: "the", thier: "their",
  untill: "until", usefull: "useful", wich: "which", writting: "writing",
  achievment: "achievement", acheivement: "achievement", strenght: "strength",
  aplication: "application", buisness: "business", bussiness: "business",
  certificaton: "certification", certifcation: "certification", intership: "internship",
  internshp: "internship", projct: "project", porject: "project", devloped: "developed",
  desinged: "designed", desgined: "designed", analized: "analyzed",
};

/** Misspelled words in `text`, with their corrections. */
export function findMisspellings(text: string): Array<{ wrong: string; right: string }> {
  const out: Array<{ wrong: string; right: string }> = [];
  for (const word of text.match(/[A-Za-z]+/g) ?? []) {
    const right = MISSPELLINGS[word.toLowerCase()];
    if (right) out.push({ wrong: word, right });
  }
  return out;
}

/** Fixes every known misspelling, keeping the original capitalisation. */
export function fixMisspellings(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) => {
    const right = MISSPELLINGS[word.toLowerCase()];
    if (!right) return word;
    if (word === word.toUpperCase() && word.length > 1) return right.toUpperCase();
    if (word[0] === word[0].toUpperCase()) return right[0].toUpperCase() + right.slice(1);
    return right;
  });
}

// ─── Passive voice ───────────────────────────────────────────────────────────

const IRREGULAR_PARTICIPLES = "built|made|written|done|given|taken|shown|led|set|run|kept|held|sent|won|chosen|drawn|driven|grown|known|seen|taught|brought|bought|found|put|read|split|spent|begun";

/** "was developed", "were built by", "has been designed": passive, not action. */
export const PASSIVE_RE = new RegExp(
  `\\b(?:was|were|is|are|been|being|be)\\s+(?:\\w+ly\\s+)?(?:\\w{3,}ed|${IRREGULAR_PARTICIPLES})\\b`,
  "i",
);
