import type { ResumeDocument } from "../../src/types";

/** Final-year student with an internship: everything quantified, consistent
 * dates, canonical casing, complete contact block. Expected: total >= 85 and
 * zero auto-fixes. */
export const strong: ResumeDocument = {
  schemaVersion: 2,
  contact: {
    name: "Priya Deshmukh",
    email: "priya.deshmukh@gmail.com",
    phone: "+91 98765 43210",
    city: "Pune",
    links: [
      { label: "github.com/priyadesh", url: "https://github.com/priyadesh", kind: "github" },
      { label: "www.linkedin.com/in/priyadesh", url: "https://www.linkedin.com/in/priyadesh", kind: "linkedin" },
      { label: "priyadesh.dev", url: "https://priyadesh.dev", kind: "portfolio" },
    ],
  },
  headline: "Backend Developer | Node.js, PostgreSQL",
  summary:
    "Final-year computer engineering student with backend internship experience in Node.js and PostgreSQL, having shipped 3 production services and cut API response times by 40% at scale.",
  order: ["summary", "education", "skills", "experience", "projects", "certifications", "achievements"],
  skillSections: [
    { category: "Languages", items: ["Python", "TypeScript", "SQL"], evidence: [] },
    { category: "Backend", items: ["Node.js", "Express", "PostgreSQL", "Redis"], evidence: [] },
    { category: "Tools", items: ["Docker", "Git", "GitHub Actions"], evidence: [] },
  ],
  experience: [
    {
      company: "Finlok Systems",
      role: "Backend Intern",
      start: "Jun 2025",
      end: "Aug 2025",
      bullets: [
        { text: "Built 4 REST endpoints in Node.js serving 12,000 daily requests for the payments dashboard", evidence: ["EX:1"] },
        { text: "Reduced PostgreSQL query latency by 40% through indexing and query rewrites across 6 tables", evidence: ["EX:1"] },
        { text: "Automated 3 recurring reconciliation reports with Python, saving the team 5 hours weekly", evidence: ["EX:1"] },
      ],
    },
  ],
  projects: [
    {
      title: "Campus Mess Tracker",
      tech: ["Node.js", "PostgreSQL", "React"],
      link: "https://github.com/priyadesh/mess-tracker",
      bullets: [
        { text: "Shipped a meal booking system in React used by 300 hostel students across 2 campuses", evidence: ["PR:1"] },
        { text: "Cut duplicate bookings to 0 by adding row-level locking in PostgreSQL transactions", evidence: ["PR:1"] },
      ],
    },
    {
      title: "Log Alert Pipeline",
      tech: ["Python", "Redis", "Docker"],
      link: "https://github.com/priyadesh/log-alerts",
      bullets: [
        { text: "Built a Redis-backed alerting pipeline in Python processing 50,000 log lines per minute", evidence: ["PR:2"] },
        { text: "Improved incident detection time from 15 minutes to under 2 minutes for 8 services", evidence: ["PR:2"] },
      ],
    },
  ],
  education: [
    {
      degree: "B.E. Computer Engineering",
      institution: "Pune Institute of Computer Technology",
      start: "2022",
      end: "2026",
      cgpa: "8.7",
    },
  ],
  certifications: [
    { name: "AWS Cloud Practitioner", issuer: "Amazon Web Services", date: "Mar 2025", link: null },
  ],
  achievements: [
    { text: "Won 1st place among 42 teams at the PICT Hackathon 2025 for a campus logistics app", evidence: ["GO:1"] },
  ],
  atsMeta: null,
};
