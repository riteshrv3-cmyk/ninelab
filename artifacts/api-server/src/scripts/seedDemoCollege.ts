/**
 * Seeds a realistic demo college for the TPO pitch. Idempotent: keyed on a
 * fixed invite code + demo email domain, so re-runs top up rather than
 * duplicate. Targets whatever DATABASE_URL is in the environment — run it
 * against the Neon dev branch during the sprint, and once against prod at ship.
 *
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/seedDemoCollege.ts
 *
 * Readiness + milestone progress are computed by the REAL checkMilestones /
 * readiness code, so the TPO dashboard numbers are provably the production
 * formula, not hand-set.
 */
import { db, pool } from "@workspace/db";
import {
  studentsTable,
  collegesTable,
  collegeAdminsTable,
  learningTracksTable,
  trackMilestonesTable,
  interviewSessionsTable,
  applicationsTable,
  studentResumesTable,
  courseEnrollmentsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { ensureDefaultTracks, loadTemplateWithMilestones } from "../lib/defaultTracks";
import { checkMilestones } from "../lib/trackProgress";

const DEMO_INVITE_CODE = "DEMO2026";
const DEMO_COLLEGE_NAME = "NMAM Institute of Technology, Nitte";
const DEMO_CITY = "Nitte, Karnataka";
const DEMO_TPO_EMAIL = "riteshrv3@gmail.com";
const DEMO_EMAIL_DOMAIN = "@kodetalent.demo";
const SDE_TEMPLATE = "sde_placement_v1";

type ProfileLevel = "full" | "partial" | "minimal" | "none";

interface Tier {
  count: number;
  profile: ProfileLevel;
  skills: number;      // number of non-generic skills
  skillLevel: number;  // avg skill value
  mocks: number;       // completed mock interviews
  mockBase: number;    // first mock score (ascending from here)
  apps: number;
  resume: boolean;
  course: boolean;     // a completed course
  streak: number;
  daysSinceActive: number;
}

// Tuned so readiness spreads across green/amber/red for a credible pitch:
// strong -> ~75-90 (green), mid -> ~40-58 (amber), early -> ~15-30 (red),
// inactive -> ~0-10 (red). profile carries 25% of readiness, so the mid tier
// needs a real (partial) profile to clear the amber threshold.
const TIERS: Tier[] = [
  { count: 5, profile: "full", skills: 5, skillLevel: 82, mocks: 4, mockBase: 58, apps: 4, resume: true, course: true, streak: 9, daysSinceActive: 0 },
  { count: 10, profile: "partial", skills: 3, skillLevel: 58, mocks: 2, mockBase: 48, apps: 2, resume: true, course: false, streak: 3, daysSinceActive: 1 },
  { count: 6, profile: "minimal", skills: 1, skillLevel: 35, mocks: 1, mockBase: 38, apps: 0, resume: false, course: false, streak: 0, daysSinceActive: 2 },
  { count: 3, profile: "none", skills: 0, skillLevel: 0, mocks: 0, mockBase: 0, apps: 0, resume: false, course: false, streak: 0, daysSinceActive: 34 },
];

/** Profile columns per level — drives computeProfileStrength deterministically. */
function profileFields(level: ProfileLevel) {
  const full = {
    githubUrl: "https://github.com/demo",
    linkedinUrl: "https://linkedin.com/in/demo",
    portfolioUrl: "https://demo.dev",
    phone: "9000000000",
    bio: "Final-year student aiming for a strong SDE placement this cycle.",
    projects: [{ id: "p1", title: "Project A" }, { id: "p2", title: "Project B" }, { id: "p3", title: "Project C" }],
    certifications: [{ id: "c1", name: "AWS Cloud Practitioner" }],
    experience: [{ id: "e1", company: "Startup", role: "Intern", period: "2025", bullets: ["Built features"] }],
    preferredLocations: ["Bengaluru", "Remote"],
    expectedSalary: "8 LPA",
  };
  const partial = {
    githubUrl: "https://github.com/demo",
    linkedinUrl: "https://linkedin.com/in/demo",
    portfolioUrl: null,
    phone: null,
    bio: "Third-year student building projects and prepping for placements.",
    projects: [{ id: "p1", title: "Project A" }],
    certifications: [] as unknown[],
    experience: [] as unknown[],
    preferredLocations: [] as unknown[],
    expectedSalary: null,
  };
  const minimal = {
    githubUrl: "https://github.com/demo",
    linkedinUrl: null,
    portfolioUrl: null,
    phone: null,
    bio: "Getting started on KodeTalent.",
    projects: [] as unknown[],
    certifications: [] as unknown[],
    experience: [] as unknown[],
    preferredLocations: [] as unknown[],
    expectedSalary: null,
  };
  const none = {
    githubUrl: null, linkedinUrl: null, portfolioUrl: null, phone: null, bio: null,
    projects: [] as unknown[], certifications: [] as unknown[], experience: [] as unknown[],
    preferredLocations: [] as unknown[], expectedSalary: null,
  };
  return level === "full" ? full : level === "partial" ? partial : level === "minimal" ? minimal : none;
}

const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Ananya", "Diya", "Ishaan", "Kabir", "Saanvi", "Riya", "Arjun", "Sai", "Meera", "Rohan", "Neha", "Karthik", "Pooja", "Rahul", "Sneha", "Tanvi", "Yash", "Ira", "Devansh", "Nikhil", "Anjali"];
const LAST_NAMES = ["Shetty", "Rao", "Nayak", "Hegde", "Bhat", "Kamath", "Pai", "Shenoy", "Kulkarni", "Prabhu", "Acharya", "Kotian"];
const FIELDS = ["Computer Science", "Information Science", "Electronics", "AI & ML"];
const ROLES = ["SDE", "Data/ML", "Frontend", "Backend"];
const SKILL_NAMES = ["React", "Node.js", "TypeScript", "SQL", "System Design", "AWS", "Docker", "Java"];

function istDateStr(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function slug(i: number): string {
  return `demo.student${String(i).padStart(2, "0")}`;
}

async function ensureCollege(): Promise<number> {
  const [existing] = await db.select().from(collegesTable).where(eq(collegesTable.inviteCode, DEMO_INVITE_CODE)).limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(collegesTable)
    .values({ name: DEMO_COLLEGE_NAME, city: DEMO_CITY, inviteCode: DEMO_INVITE_CODE, tpoEmail: DEMO_TPO_EMAIL, tpoName: "Placement Cell" })
    .returning();
  return created.id;
}

async function ensureAdmin(collegeId: number): Promise<void> {
  await db
    .insert(collegeAdminsTable)
    .values({ email: DEMO_TPO_EMAIL.toLowerCase(), name: "Demo TPO", collegeId })
    .onConflictDoUpdate({ target: collegeAdminsTable.email, set: { collegeId } });
}

async function ensureCollegeTrack(collegeId: number): Promise<void> {
  const [active] = await db
    .select({ id: learningTracksTable.id })
    .from(learningTracksTable)
    .where(and(eq(learningTracksTable.collegeId, collegeId), eq(learningTracksTable.active, true)))
    .limit(1);
  if (active) return;

  const tpl = await loadTemplateWithMilestones(SDE_TEMPLATE);
  if (!tpl) throw new Error(`Template ${SDE_TEMPLATE} missing — did ensureDefaultTracks run?`);
  const [track] = await db
    .insert(learningTracksTable)
    .values({ collegeId, templateKey: null, name: tpl.track.name, description: tpl.track.description, active: true })
    .returning();
  await db.insert(trackMilestonesTable).values(
    tpl.milestones.map((m, i) => ({ trackId: track.id, position: i, kind: m.kind, title: m.title, description: m.description, config: (m.config as Record<string, unknown>) ?? {} })),
  );
}

async function seedStudentActivity(studentId: number, tier: Tier): Promise<void> {
  for (let m = 0; m < tier.mocks; m++) {
    const score = Math.min(95, tier.mockBase + m * 6);
    await db.insert(interviewSessionsTable).values({
      studentId,
      company: "Practice",
      round: "Technical|Standard",
      questions: [],
      answers: [],
      overallScore: score,
      evaluation: { communicationScore: score - 4, technicalScore: score, confidenceScore: score - 2, overallRating: score },
      completed: true,
    });
  }
  for (let a = 0; a < tier.apps; a++) {
    await db.insert(applicationsTable).values({
      studentId,
      source: "pasted",
      rawText: "Demo application",
      company: ["Infosys", "TCS", "Wipro", "Zoho", "Freshworks"][a % 5],
      role: "Software Engineer",
      status: "clicked_apply",
    });
  }
  if (tier.resume) {
    await db.insert(studentResumesTable).values({
      studentId,
      name: "My Resume",
      templateId: "classic",
      content: { sections: [] },
      atsScore: 70,
    });
  }
  if (tier.course) {
    await db.insert(courseEnrollmentsTable).values({
      studentId,
      subDomainId: "frontend-react",
      subDomainName: "React Development",
      domainId: "web",
      domainName: "Web Development",
      skills: ["React", "TypeScript"],
      courseData: { modules: [{ id: "m1", lessons: [{ id: "l1" }, { id: "l2" }, { id: "l3" }] }] },
      completedLessonIds: ["l1", "l2", "l3"],
      status: "completed",
      completedAt: new Date(),
    });
  }
}

async function main(): Promise<void> {
  console.log("Seeding demo college…");
  await ensureDefaultTracks();
  const collegeId = await ensureCollege();
  await ensureAdmin(collegeId);
  await ensureCollegeTrack(collegeId);
  console.log(`College id=${collegeId}, invite=${DEMO_INVITE_CODE}, TPO=${DEMO_TPO_EMAIL}`);

  let index = 0;
  const allIds: number[] = [];
  for (let t = 0; t < TIERS.length; t++) {
    const tier = TIERS[t];
    for (let n = 0; n < tier.count; n++) {
      index++;
      const email = `${slug(index)}${DEMO_EMAIL_DOMAIN}`;
      const name = `${FIRST_NAMES[(index - 1) % FIRST_NAMES.length]} ${LAST_NAMES[index % LAST_NAMES.length]}`;
      const skills: Record<string, number> = {};
      for (let s = 0; s < tier.skills; s++) {
        skills[SKILL_NAMES[(index + s) % SKILL_NAMES.length]] = Math.min(95, tier.skillLevel + ((index + s) % 3) * 4);
      }

      const pf = profileFields(tier.profile);
      const baseFields = {
        name,
        college: DEMO_COLLEGE_NAME,
        collegeId,
        city: DEMO_CITY,
        year: 3 + (index % 2),
        field: FIELDS[index % FIELDS.length],
        targetRole: ROLES[index % ROLES.length],
        targetBatch: 2027,
        skills,
        streakCount: tier.streak,
        lastActiveDate: istDateStr(tier.daysSinceActive),
        ...pf,
      };

      const [existing] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.email, email)).limit(1);
      let studentId: number;
      if (existing) {
        // Refresh profile/skills so re-runs pick up tuning changes; activity
        // (mocks/apps/resume/course) is left intact to avoid duplicates.
        studentId = existing.id;
        await db.update(studentsTable).set(baseFields).where(eq(studentsTable.id, studentId));
      } else {
        const [created] = await db.insert(studentsTable).values({ email, ...baseFields }).returning();
        studentId = created.id;
        await seedStudentActivity(studentId, tier);
      }
      allIds.push(studentId);
    }
  }

  // Compute real milestone progress + readiness for every demo student.
  for (const id of allIds) {
    await checkMilestones(id).catch((err) => console.error(`checkMilestones failed for ${id}`, err));
  }

  console.log(`Seeded ${allIds.length} students. Done.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
