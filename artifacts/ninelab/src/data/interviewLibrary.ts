// Ready-made mock-interview presets for the browsable Interview Library.
// Each preset maps to a real, India-relevant hiring bar so a student can
// start a grounded practice run in one tap. The `round` sent to the API is
// `${type}|${difficulty}` — the same contract Prep.tsx / Opportunities.tsx use.

export interface InterviewPreset {
  id: string;
  roleId: "sde" | "data" | "appdev" | "cyber";
  roleLabel: string;
  company: string;
  label: string;
  type: "Technical" | "Behavioral" | "Mixed";
  difficulty: "Standard" | "Challenging";
  topic: string;
}

export const INTERVIEW_ROLES = [
  { id: "sde", label: "Software Engineer" },
  { id: "data", label: "Data / ML" },
  { id: "appdev", label: "App Developer" },
  { id: "cyber", label: "Cybersecurity" },
] as const;

export const INTERVIEW_PRESETS: InterviewPreset[] = [
  // Software Engineer
  {
    id: "sde-tcs-nqt",
    roleId: "sde",
    roleLabel: "Software Engineer",
    company: "TCS",
    label: "NQT",
    type: "Technical",
    difficulty: "Standard",
    topic: "DSA + fundamentals",
  },
  {
    id: "sde-infosys-dse",
    roleId: "sde",
    roleLabel: "Software Engineer",
    company: "Infosys",
    label: "DSE",
    type: "Technical",
    difficulty: "Standard",
    topic: "Coding + CS core",
  },
  {
    id: "sde-zoho",
    roleId: "sde",
    roleLabel: "Software Engineer",
    company: "Zoho",
    label: "SDE",
    type: "Technical",
    difficulty: "Challenging",
    topic: "Problem solving",
  },
  {
    id: "sde-google-swe",
    roleId: "sde",
    roleLabel: "Software Engineer",
    company: "Google",
    label: "SWE",
    type: "Technical",
    difficulty: "Challenging",
    topic: "DSA + system design",
  },

  // Data / ML
  {
    id: "data-flipkart-analyst",
    roleId: "data",
    roleLabel: "Data / ML",
    company: "Flipkart",
    label: "Data Analyst",
    type: "Technical",
    difficulty: "Standard",
    topic: "SQL + analytics",
  },
  {
    id: "data-fractal",
    roleId: "data",
    roleLabel: "Data / ML",
    company: "Fractal Analytics",
    label: "Analyst",
    type: "Mixed",
    difficulty: "Standard",
    topic: "Case + stats",
  },
  {
    id: "data-mu-sigma",
    roleId: "data",
    roleLabel: "Data / ML",
    company: "Mu Sigma",
    label: "Decision Scientist",
    type: "Behavioral",
    difficulty: "Standard",
    topic: "Problem solving mindset",
  },
  {
    id: "data-amazon-bi",
    roleId: "data",
    roleLabel: "Data / ML",
    company: "Amazon",
    label: "BI Engineer",
    type: "Technical",
    difficulty: "Challenging",
    topic: "SQL + metrics",
  },

  // App Developer
  {
    id: "appdev-zomato",
    roleId: "appdev",
    roleLabel: "App Developer",
    company: "Zomato",
    label: "Mobile Engineer",
    type: "Technical",
    difficulty: "Standard",
    topic: "React Native",
  },
  {
    id: "appdev-paytm",
    roleId: "appdev",
    roleLabel: "App Developer",
    company: "Paytm",
    label: "Android Developer",
    type: "Technical",
    difficulty: "Standard",
    topic: "Android",
  },
  {
    id: "appdev-swiggy",
    roleId: "appdev",
    roleLabel: "App Developer",
    company: "Swiggy",
    label: "Mobile Engineer",
    type: "Technical",
    difficulty: "Challenging",
    topic: "Flutter + architecture",
  },

  // Cybersecurity
  {
    id: "cyber-deloitte-soc",
    roleId: "cyber",
    roleLabel: "Cybersecurity",
    company: "Deloitte",
    label: "SOC Analyst",
    type: "Technical",
    difficulty: "Standard",
    topic: "Threat analysis",
  },
  {
    id: "cyber-tcs",
    roleId: "cyber",
    roleLabel: "Cybersecurity",
    company: "TCS",
    label: "Cyber",
    type: "Mixed",
    difficulty: "Standard",
    topic: "Security fundamentals",
  },
  {
    id: "cyber-crowdstrike",
    roleId: "cyber",
    roleLabel: "Cybersecurity",
    company: "CrowdStrike",
    label: "Security Engineer",
    type: "Technical",
    difficulty: "Challenging",
    topic: "Incident response",
  },
];
