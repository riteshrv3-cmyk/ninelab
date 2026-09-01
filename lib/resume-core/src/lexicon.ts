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
