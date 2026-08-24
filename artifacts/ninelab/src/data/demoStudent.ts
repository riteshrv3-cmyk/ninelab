// Sample-student fixtures for explore mode (anonymous visitors, no account).
//
// A lazy first-time visitor should see a living, believable app — not empty
// states — before deciding to act. These fixtures back every PERSONAL surface
// (resume, interview report, profile, course progress, matched jobs) with one
// realistic student, "Priya Sharma". Live no-input surfaces (jobs feed, course
// catalog, interview library) render real content instead and are NOT covered
// here.
//
// Quality bar: believable college, real-sounding projects, and UNEVEN scores
// (never a wall of 8/10) so it reads like a real person, plus a short "how"
// caption per surface that quietly sells the action that produced it.
//
// These are plain data objects. Consuming demo components (ResumeDemo,
// ProfileDemo, the home teasers) adapt them to their local view types — keep
// this module free of imports so it can't drag page code into a cycle.

export const DEMO_STUDENT_NAME = "Priya Sharma";

export interface DemoProfile {
  name: string;
  field: string;
  year: number;
  college: string;
  city: string;
  targetRole: string;
  targetBatch: number;
  githubUrl: string;
  skills: Record<string, number>;
  xp: number;
  level: number;
  streakCount: number;
}

export const DEMO_PROFILE: DemoProfile = {
  name: DEMO_STUDENT_NAME,
  field: "Computer Science",
  year: 3,
  college: "MIT-WPU, Pune",
  city: "Pune",
  targetRole: "Frontend Developer",
  targetBatch: 2027,
  githubUrl: "github.com/priya-sharma",
  // Uneven on purpose — a real ledger is lumpy.
  skills: {
    React: 82,
    JavaScript: 78,
    TypeScript: 64,
    "Node.js": 55,
    CSS: 71,
    Python: 48,
    Git: 69,
    SQL: 42,
  },
  xp: 640,
  level: 3,
  streakCount: 5,
};

export interface DemoResume {
  id: number;
  title: string;
  targetRole: string;
  atsScore: number;
  updatedLabel: string;
  howCaption: string;
  headline: string;
  summary: string;
  highlights: string[];
}

export const DEMO_RESUMES: DemoResume[] = [
  {
    id: -1,
    title: "Frontend Developer — Razorpay",
    targetRole: "Frontend Developer",
    atsScore: 82,
    updatedLabel: "Updated 2 days ago",
    howCaption: "Built from her GitHub + one job post in about 4 minutes.",
    headline: "Frontend Developer · React · TypeScript",
    summary:
      "Third-year CS student who ships. Built and deployed 3 React apps used by 400+ campus users; comfortable owning a feature from Figma to production.",
    highlights: [
      "Cut initial load 2.4s → 0.9s on the college fest site by code-splitting routes and lazy-loading the gallery",
      "Shipped a React + TypeScript attendance tracker adopted by 6 clubs (400+ monthly users)",
      "Owned the design-system refactor that removed 1,900 lines of duplicated CSS",
    ],
  },
];

export interface DemoInterviewReport {
  company: string;
  role: string;
  round: string;
  overallScore: number; // out of 10
  dateLabel: string;
  howCaption: string;
  strongPoint: string;
  weakPoint: string;
  questionScores: { area: string; score: number }[];
}

export const DEMO_INTERVIEW_REPORT: DemoInterviewReport = {
  company: "Zoho",
  role: "SDE",
  round: "Technical",
  overallScore: 7.4,
  dateLabel: "3 days ago",
  howCaption: "A 5-question voice mock, scored by AI — done in 12 minutes.",
  strongPoint:
    "Explained the React reconciliation trade-off clearly with a concrete example.",
  weakPoint:
    "Rushed the time-complexity answer — stated O(n) where the nested loop made it O(n²).",
  // Uneven, like a real report.
  questionScores: [
    { area: "Communication", score: 8 },
    { area: "DSA / problem solving", score: 6 },
    { area: "React fundamentals", score: 9 },
    { area: "System thinking", score: 7 },
    { area: "Confidence", score: 7 },
  ],
};

export interface DemoEnrollment {
  subDomainName: string;
  domainName: string;
  progressPct: number;
  completedModules: number;
  totalModules: number;
  howCaption: string;
}

export const DEMO_ENROLLMENT: DemoEnrollment = {
  subDomainName: "React Development",
  domainName: "Frontend Engineering",
  progressPct: 64,
  completedModules: 3,
  totalModules: 5,
  howCaption: "Free course · 3 of 5 modules done, quiz-gated.",
};

export interface DemoMatchedJob {
  company: string;
  role: string;
  location: string;
  matchPct: number;
  tags: string[];
}

export const DEMO_MATCHED_TEASER: DemoMatchedJob[] = [
  {
    company: "Razorpay",
    role: "Frontend Engineer (Fresher)",
    location: "Bengaluru · Hybrid",
    matchPct: 88,
    tags: ["React", "TypeScript"],
  },
  {
    company: "Postman",
    role: "SDE-1, Web",
    location: "Bengaluru",
    matchPct: 81,
    tags: ["JavaScript", "Node.js"],
  },
  {
    company: "Zomato",
    role: "Frontend Developer Intern",
    location: "Gurugram · Remote",
    matchPct: 76,
    tags: ["React", "CSS"],
  },
];
