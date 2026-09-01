import type { ResumeDocument } from "../../src/types";

/** 3rd-year with three real projects but rough execution: only ~30% of
 * bullets quantified, one weak opener, a first-person bullet, an overlong
 * summary with a cliché, some miscasing, no links or CGPA, sparse page.
 * Expected: total in [50, 70]. */
export const mediocre: ResumeDocument = {
  schemaVersion: 2,
  contact: {
    name: "Ananya Sharma",
    email: "ananya.sharma@gmail.com",
    phone: null,
    city: "Nagpur",
    links: [],
  },
  headline: "",
  summary:
    "Third-year information technology student passionate about building web applications, with three completed projects covering frontend and backend development, database design, deployment, and a strong interest in learning modern frameworks, cloud platforms, developer tooling, testing practices, version control workflows, and collaborative software engineering practices used in modern product companies today.",
  order: ["summary", "education", "skills", "projects"],
  skillSections: [
    { category: "Web", items: ["React", "javascript", "HTML", "CSS"], evidence: [] },
  ],
  experience: [],
  projects: [
    {
      title: "Attendance Portal",
      tech: ["React", "Node.js"],
      link: null,
      bullets: [
        { text: "Built an attendance portal used by 4 departments to replace paper registers", evidence: [] },
        { text: "Worked on the admin dashboard with charts for monthly attendance summaries", evidence: [] },
      ],
    },
    {
      title: "Quiz Platform",
      tech: ["React", "Firebase"],
      link: null,
      bullets: [
        { text: "Created a timed quiz platform with 200 questions across 5 subjects", evidence: [] },
        { text: "I designed the leaderboard and scoring logic for weekly contests", evidence: [] },
      ],
    },
    {
      title: "Recipe Finder",
      tech: ["javascript"],
      link: null,
      bullets: [
        { text: "Developed a recipe search tool filtering by ingredients and cooking time", evidence: [] },
        { text: "Added bookmarking so users can save favourite recipes for later viewing", evidence: [] },
      ],
    },
  ],
  education: [
    {
      degree: "B.Tech Information Technology",
      institution: "Government College of Engineering Nagpur",
      start: "2023",
      end: "2027",
      cgpa: null,
    },
  ],
  certifications: [],
  achievements: [],
  atsMeta: null,
};
