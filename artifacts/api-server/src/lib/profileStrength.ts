import { studentsTable } from "@workspace/db";

type Student = typeof studentsTable.$inferSelect;

/**
 * Additive 0-100 profile completeness. Single source of truth: imported by the
 * profile route (which persists it to students.profileStrength) and by the
 * readiness score + the complete_profile track milestone, so all three agree.
 */
export function computeProfileStrength(s: Student): number {
  let score = 0;
  if (s.githubUrl) score += 10;
  if (s.linkedinUrl) score += 15;
  if (s.portfolioUrl) score += 5;
  if (s.phone) score += 5;
  if (s.bio && s.bio.length > 20) score += 10;
  const projects = Array.isArray(s.projects) ? s.projects : [];
  if (projects.length >= 1) score += 20;
  if (projects.length >= 3) score += 5;
  const certs = Array.isArray(s.certifications) ? s.certifications : [];
  if (certs.length >= 1) score += 10;
  const experience = Array.isArray(s.experience) ? s.experience : [];
  if (experience.length >= 1) score += 10;
  const locs = Array.isArray(s.preferredLocations) ? s.preferredLocations : [];
  if (locs.length > 0) score += 5;
  if (s.expectedSalary) score += 5;
  if (s.githubStats) score += 5;
  if (s.linkedinData) score += 5;
  return Math.min(score, 100);
}

export function computeCommitmentScore(s: Student): number {
  const xpScore = Math.min((s.xp / 25), 40);
  const streakScore = s.lastActiveDate ? Math.min(s.streakCount * 3, 30) : 0;
  const overallScore = Math.round((s.overallScore || 0) * 0.3);
  return Math.min(Math.round(xpScore + streakScore + overallScore), 100);
}
