import type { ResumeDocument } from "../../src/types";

/** 2nd-year, tier-3 college archetype: first-person cliché summary, one
 * rambling unquantified bullet, duplicate miscased skills, no links, mixed
 * date formats, an emoji, no education entry. Expected: total in [20, 40]
 * with 6+ auto-fixable failures. */
export const weak: ResumeDocument = {
  schemaVersion: 2,
  contact: {
    name: "Rohan Patil",
    email: "rohan_cool123@gmail.com",
    phone: "09876543",
    city: null,
    links: [],
  },
  headline: "",
  summary: "I am a passionate hardworking student and a quick learner  looking for opportunities.",
  order: ["summary", "education", "skills", "experience", "projects", "certifications", "achievements"],
  skillSections: [
    { category: "Skills", items: ["c++", "C++", "java"], evidence: [] },
  ],
  experience: [
    {
      company: "Local Shop",
      role: "Intern",
      start: "June 2024",
      end: "2024",
      bullets: [
        { text: "Build dashboards for the team", evidence: [] },
      ],
    },
  ],
  projects: [
    {
      title: "Food App",
      tech: ["java"],
      link: null,
      bullets: [
        {
          text: "Worked on a food delivery application project for college with java and also worked on the frontend part and the backend part and the database part of the whole application 😊",
          evidence: [],
        },
      ],
    },
  ],
  education: [],
  certifications: [],
  achievements: [],
  atsMeta: null,
};
