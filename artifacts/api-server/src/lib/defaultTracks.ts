import { db, learningTracksTable, trackMilestonesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface MilestoneSpec {
  kind: string;
  title: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface TrackTemplate {
  templateKey: string;
  name: string;
  description: string;
  milestones: MilestoneSpec[];
}

/**
 * Shipped default tracks (global templates, collegeId = null). A TPO adopts one
 * by cloning it into a college-owned track. core_placement_v1 is the fallback
 * that unenrolled students (and students without a college track) get.
 */
export const DEFAULT_TRACKS: TrackTemplate[] = [
  {
    templateKey: "sde_placement_v1",
    name: "Placement Ready — SDE",
    description: "The end-to-end path to a software engineering placement: profile, skills, mocks, a completed course, a resume, and applications.",
    milestones: [
      { kind: "complete_profile", title: "Complete your profile", description: "Fill your profile to at least 60% strength.", config: { minStrength: 60 } },
      { kind: "add_skills", title: "Add your core skills", description: "Add at least 3 real technical skills.", config: { count: 3 } },
      { kind: "first_mock", title: "Take your first mock interview", description: "Complete one AI mock interview." },
      { kind: "finish_course", title: "Finish a skill course", description: "Complete any course end to end." },
      { kind: "build_resume", title: "Build your resume", description: "Generate at least one resume." },
      { kind: "mock_series", title: "Practice 3 mock interviews", description: "Complete 3 mock interviews total.", config: { count: 3 } },
      { kind: "mock_score", title: "Score 60+ in a mock", description: "Reach an overall score of 60 or higher in a mock.", config: { minScore: 60 } },
      { kind: "apply_jobs", title: "Apply to 3 opportunities", description: "Add 3 applications to your pipeline.", config: { count: 3 } },
    ],
  },
  {
    templateKey: "core_placement_v1",
    name: "Placement Foundations — All Branches",
    description: "A branch-agnostic foundation: profile, resume, first mock, core skills, applications, and a solid mock score.",
    milestones: [
      { kind: "complete_profile", title: "Complete your profile", description: "Fill your profile to at least 50% strength.", config: { minStrength: 50 } },
      { kind: "build_resume", title: "Build your resume", description: "Generate at least one resume." },
      { kind: "first_mock", title: "Take your first mock interview", description: "Complete one AI mock interview." },
      { kind: "add_skills", title: "Add your core skills", description: "Add at least 3 real skills.", config: { count: 3 } },
      { kind: "apply_jobs", title: "Apply to 5 opportunities", description: "Add 5 applications to your pipeline.", config: { count: 5 } },
      { kind: "mock_score", title: "Score 50+ in a mock", description: "Reach an overall score of 50 or higher in a mock.", config: { minScore: 50 } },
    ],
  },
];

/**
 * Idempotently ensure the shipped global templates exist. Called once at server
 * boot. Uses the templateKey unique index so re-runs are no-ops; milestones are
 * inserted only when the track row was just created, so a later manual edit to a
 * template is never overwritten.
 */
export async function ensureDefaultTracks(): Promise<void> {
  for (const tpl of DEFAULT_TRACKS) {
    const inserted = await db
      .insert(learningTracksTable)
      .values({ collegeId: null, templateKey: tpl.templateKey, name: tpl.name, description: tpl.description, active: true })
      .onConflictDoNothing()
      .returning({ id: learningTracksTable.id });

    if (inserted.length === 0) continue; // already existed

    const trackId = inserted[0].id;
    await db.insert(trackMilestonesTable).values(
      tpl.milestones.map((m, i) => ({
        trackId,
        position: i,
        kind: m.kind,
        title: m.title,
        description: m.description ?? "",
        config: m.config ?? {},
      })),
    );
  }
}

/** Load a template (with milestones) by key — used when a TPO clones it. */
export async function loadTemplateWithMilestones(templateKey: string) {
  const [track] = await db
    .select()
    .from(learningTracksTable)
    .where(eq(learningTracksTable.templateKey, templateKey))
    .limit(1);
  if (!track) return null;
  const milestones = await db
    .select()
    .from(trackMilestonesTable)
    .where(eq(trackMilestonesTable.trackId, track.id))
    .orderBy(trackMilestonesTable.position);
  return { track, milestones };
}
