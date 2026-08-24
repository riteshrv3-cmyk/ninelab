import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  studentsTable,
  recruitersTable,
  recruiterJobsTable,
  recruiterInvites,
  driveChecksTable,
  jobsTable,
  mentors,
  interviewSessionsTable,
  tpoAccountsTable,
  curatedOpportunitiesTable,
  collegesTable,
  collegeAdminsTable,
} from "@workspace/db";
import { desc, sql, gte, eq } from "drizzle-orm";
import { timingSafeEqual } from "crypto";

const router = Router();

// Admin token gate: fail-closed if env not set; constant-time compare.
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    res.status(503).json({ error: "Admin API disabled (ADMIN_API_TOKEN not configured)" });
    return;
  }
  const provided = req.header("x-admin-token") || "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }
  next();
}

// Gate every /admin/* route in this file — several below were previously missing this
// individually. Scoped to the "/admin" prefix: this router is mounted at the app root
// alongside every other feature router, so an unscoped router.use(requireAdmin) here
// would intercept ALL requests reaching later-mounted routers, not just admin ones.
router.use("/admin", requireAdmin);

// List pending TPO accounts (admin-only).
router.get("/admin/tpo-accounts", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: tpoAccountsTable.id, email: tpoAccountsTable.email, name: tpoAccountsTable.name,
      college: tpoAccountsTable.college, dept: tpoAccountsTable.dept,
      verified: tpoAccountsTable.verified, verifiedAt: tpoAccountsTable.verifiedAt,
      verifiedBy: tpoAccountsTable.verifiedBy, createdAt: tpoAccountsTable.createdAt,
    })
    .from(tpoAccountsTable)
    .orderBy(desc(tpoAccountsTable.createdAt));
  res.json(rows);
});

// Approve a TPO account (admin-only).
router.post("/admin/tpo-accounts/:id/verify", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [updated] = await db
    .update(tpoAccountsTable)
    .set({ verified: true, verifiedAt: new Date(), verifiedBy: "admin" })
    .where(eq(tpoAccountsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true, account: { id: updated.id, verified: updated.verified } });
});

// Register a college admin (TPO) on the Clerk allowlist. Either pass an existing
// collegeId, or {collegeName, city} to create the college inline in one call.
// When that email later signs in via Clerk, requireCollegeAdmin binds it.
function genInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
async function uniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const c = genInviteCode();
    const [hit] = await db.select({ id: collegesTable.id }).from(collegesTable).where(eq(collegesTable.inviteCode, c));
    if (!hit) return c;
  }
  return genInviteCode();
}

router.post("/admin/college-admins", async (req, res): Promise<void> => {
  const body = req.body as { email?: string; name?: string; collegeId?: number; collegeName?: string; city?: string };
  const email = String(body.email || "").toLowerCase().trim();
  if (!email) { res.status(400).json({ error: "email required" }); return; }
  try {
    let collegeId = Number(body.collegeId);
    if (!Number.isFinite(collegeId)) {
      const collegeName = String(body.collegeName || "").trim();
      if (!collegeName) { res.status(400).json({ error: "collegeId or collegeName required" }); return; }
      const code = await uniqueInviteCode();
      const [college] = await db.insert(collegesTable).values({
        name: collegeName, city: String(body.city || "").trim(), tpoEmail: email, tpoName: body.name || null, inviteCode: code,
      }).returning();
      collegeId = college.id;
    } else {
      const [college] = await db.select({ id: collegesTable.id }).from(collegesTable).where(eq(collegesTable.id, collegeId)).limit(1);
      if (!college) { res.status(404).json({ error: "College not found" }); return; }
    }
    const [admin] = await db
      .insert(collegeAdminsTable)
      .values({ email, name: body.name || null, collegeId })
      .onConflictDoUpdate({ target: collegeAdminsTable.email, set: { collegeId, name: body.name || null } })
      .returning();
    res.status(201).json({ ok: true, admin, collegeId });
  } catch (err) {
    req.log.error({ err }, "Failed to create college admin");
    res.status(500).json({ error: "Failed to create college admin" });
  }
});

router.get("/admin/overview", async (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    studentCountRow,
    recruiterCountRow,
    jobCountRow,
    inviteCountRow,
    driveCheckCountRow,
    mentorCountRow,
    interviewCountRow,
    collegeCountRow,
    openToWorkRow,
    proRow,
    inviteStatusRows,
    driveVerdictRows,
    studentsLast24Row,
    invitesLast24Row,
    driveChecksLast24Row,
    interviewsLast24Row,
    avgScoresRow,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(studentsTable),
    db.select({ c: sql<number>`count(*)::int` }).from(recruitersTable),
    db.select({ c: sql<number>`count(*)::int` }).from(recruiterJobsTable),
    db.select({ c: sql<number>`count(*)::int` }).from(recruiterInvites),
    db.select({ c: sql<number>`count(*)::int` }).from(driveChecksTable),
    db.select({ c: sql<number>`count(*)::int` }).from(mentors),
    db.select({ c: sql<number>`count(*)::int` }).from(interviewSessionsTable),
    db.select({ c: sql<number>`count(distinct ${studentsTable.college})::int` }).from(studentsTable),
    db.select({ c: sql<number>`count(*)::int` }).from(studentsTable).where(sql`${studentsTable.openToWork} = true`),
    db.select({ c: sql<number>`count(*)::int` }).from(studentsTable).where(sql`${studentsTable.isPro} = true`),
    db
      .select({ status: recruiterInvites.status, c: sql<number>`count(*)::int` })
      .from(recruiterInvites)
      .groupBy(recruiterInvites.status),
    db
      .select({ verdict: driveChecksTable.scamVerdict, c: sql<number>`count(*)::int` })
      .from(driveChecksTable)
      .groupBy(driveChecksTable.scamVerdict),
    db.select({ c: sql<number>`count(*)::int` }).from(studentsTable).where(gte(studentsTable.createdAt, since)),
    db.select({ c: sql<number>`count(*)::int` }).from(recruiterInvites).where(gte(recruiterInvites.createdAt, since)),
    db.select({ c: sql<number>`count(*)::int` }).from(driveChecksTable).where(gte(driveChecksTable.createdAt, since)),
    db.select({ c: sql<number>`count(*)::int` }).from(interviewSessionsTable).where(gte(interviewSessionsTable.createdAt, since)),
    db
      .select({
        avgScore: sql<number>`coalesce(round(avg(${studentsTable.overallScore}))::int, 0)`,
        avgStrength: sql<number>`coalesce(round(avg(${studentsTable.profileStrength}))::int, 0)`,
        avgCommitment: sql<number>`coalesce(round(avg(${studentsTable.commitmentScore}))::int, 0)`,
        totalXp: sql<number>`coalesce(sum(${studentsTable.xp})::int, 0)`,
      })
      .from(studentsTable),
  ]);

  res.json({
    counts: {
      students: studentCountRow[0]?.c ?? 0,
      recruiters: recruiterCountRow[0]?.c ?? 0,
      jobs: jobCountRow[0]?.c ?? 0,
      invites: inviteCountRow[0]?.c ?? 0,
      driveChecks: driveCheckCountRow[0]?.c ?? 0,
      mentors: mentorCountRow[0]?.c ?? 0,
      interviews: interviewCountRow[0]?.c ?? 0,
      colleges: collegeCountRow[0]?.c ?? 0,
      openToWork: openToWorkRow[0]?.c ?? 0,
      pro: proRow[0]?.c ?? 0,
    },
    last24h: {
      students: studentsLast24Row[0]?.c ?? 0,
      invites: invitesLast24Row[0]?.c ?? 0,
      driveChecks: driveChecksLast24Row[0]?.c ?? 0,
      interviews: interviewsLast24Row[0]?.c ?? 0,
    },
    averages: avgScoresRow[0] ?? { avgScore: 0, avgStrength: 0, avgCommitment: 0, totalXp: 0 },
    inviteBreakdown: inviteStatusRows,
    driveVerdictBreakdown: driveVerdictRows,
  });
});

router.get("/admin/students", async (_req, res) => {
  const rows = await db.select().from(studentsTable).orderBy(desc(studentsTable.createdAt)).limit(500);
  res.json(rows);
});

router.get("/admin/recruiters", async (_req, res) => {
  const rows = await db.select().from(recruitersTable).orderBy(desc(recruitersTable.createdAt)).limit(500);
  res.json(rows);
});

router.get("/admin/jobs", async (_req, res) => {
  const rows = await db
    .select({
      id: recruiterJobsTable.id,
      title: recruiterJobsTable.title,
      status: recruiterJobsTable.status,
      invitesSent: recruiterJobsTable.invitesSent,
      createdAt: recruiterJobsTable.createdAt,
      parsedRequirements: recruiterJobsTable.parsedRequirements,
      recruiterId: recruiterJobsTable.recruiterId,
      recruiterName: recruitersTable.name,
      recruiterCompany: recruitersTable.company,
    })
    .from(recruiterJobsTable)
    .leftJoin(recruitersTable, sql`${recruiterJobsTable.recruiterId} = ${recruitersTable.id}`)
    .orderBy(desc(recruiterJobsTable.createdAt))
    .limit(500);
  res.json(rows);
});

router.get("/admin/invites", async (_req, res) => {
  const rows = await db
    .select({
      id: recruiterInvites.id,
      studentId: recruiterInvites.studentId,
      studentName: studentsTable.name,
      studentCollege: studentsTable.college,
      recruiterCompany: recruiterInvites.recruiterCompany,
      recruiterName: recruiterInvites.recruiterName,
      role: recruiterInvites.role,
      status: recruiterInvites.status,
      createdAt: recruiterInvites.createdAt,
    })
    .from(recruiterInvites)
    .leftJoin(studentsTable, sql`${recruiterInvites.studentId} = ${studentsTable.id}`)
    .orderBy(desc(recruiterInvites.createdAt))
    .limit(500);
  res.json(rows);
});

router.get("/admin/drive-checks", async (_req, res) => {
  const rows = await db
    .select({
      id: driveChecksTable.id,
      studentId: driveChecksTable.studentId,
      studentName: studentsTable.name,
      studentCollege: studentsTable.college,
      company: driveChecksTable.company,
      role: driveChecksTable.role,
      ctc: driveChecksTable.ctc,
      scamScore: driveChecksTable.scamScore,
      scamVerdict: driveChecksTable.scamVerdict,
      outcome: driveChecksTable.outcome,
      createdAt: driveChecksTable.createdAt,
    })
    .from(driveChecksTable)
    .leftJoin(studentsTable, sql`${driveChecksTable.studentId} = ${studentsTable.id}`)
    .orderBy(desc(driveChecksTable.createdAt))
    .limit(500);
  res.json(rows);
});

router.get("/admin/colleges", async (_req, res) => {
  const rows = await db
    .select({
      college: studentsTable.college,
      students: sql<number>`count(*)::int`,
      avgScore: sql<number>`coalesce(round(avg(${studentsTable.overallScore}))::int, 0)`,
      avgStrength: sql<number>`coalesce(round(avg(${studentsTable.profileStrength}))::int, 0)`,
      openToWork: sql<number>`sum(case when ${studentsTable.openToWork} then 1 else 0 end)::int`,
      totalXp: sql<number>`coalesce(sum(${studentsTable.xp})::int, 0)`,
    })
    .from(studentsTable)
    .groupBy(studentsTable.college)
    .orderBy(desc(sql`count(*)`));
  res.json(rows);
});

router.get("/admin/job-listings", async (_req, res) => {
  const rows = await db.select().from(jobsTable).limit(500);
  res.json(rows);
});

router.get("/admin/activity", async (_req, res) => {
  const [students, invites, drives, interviews] = await Promise.all([
    db
      .select({ id: studentsTable.id, name: studentsTable.name, college: studentsTable.college, createdAt: studentsTable.createdAt })
      .from(studentsTable)
      .orderBy(desc(studentsTable.createdAt))
      .limit(40),
    db
      .select({
        id: recruiterInvites.id,
        studentId: recruiterInvites.studentId,
        studentName: studentsTable.name,
        recruiterCompany: recruiterInvites.recruiterCompany,
        status: recruiterInvites.status,
        createdAt: recruiterInvites.createdAt,
      })
      .from(recruiterInvites)
      .leftJoin(studentsTable, sql`${recruiterInvites.studentId} = ${studentsTable.id}`)
      .orderBy(desc(recruiterInvites.createdAt))
      .limit(40),
    db
      .select({
        id: driveChecksTable.id,
        studentId: driveChecksTable.studentId,
        studentName: studentsTable.name,
        company: driveChecksTable.company,
        verdict: driveChecksTable.scamVerdict,
        score: driveChecksTable.scamScore,
        createdAt: driveChecksTable.createdAt,
      })
      .from(driveChecksTable)
      .leftJoin(studentsTable, sql`${driveChecksTable.studentId} = ${studentsTable.id}`)
      .orderBy(desc(driveChecksTable.createdAt))
      .limit(40),
    db
      .select({
        id: interviewSessionsTable.id,
        studentId: interviewSessionsTable.studentId,
        studentName: studentsTable.name,
        company: interviewSessionsTable.company,
        round: interviewSessionsTable.round,
        createdAt: interviewSessionsTable.createdAt,
      })
      .from(interviewSessionsTable)
      .leftJoin(studentsTable, sql`${interviewSessionsTable.studentId} = ${studentsTable.id}`)
      .orderBy(desc(interviewSessionsTable.createdAt))
      .limit(40),
  ]);

  type Event = { kind: string; at: string; title: string; subtitle: string; entityId: number };
  const events: Event[] = [];

  for (const s of students) {
    events.push({
      kind: "student_signup",
      at: s.createdAt.toISOString(),
      title: `${s.name} joined`,
      subtitle: s.college,
      entityId: s.id,
    });
  }
  for (const inv of invites) {
    events.push({
      kind: "recruiter_invite",
      at: inv.createdAt.toISOString(),
      title: `${inv.recruiterCompany} → ${inv.studentName ?? `student #${inv.studentId}`}`,
      subtitle: `Invite ${inv.status}`,
      entityId: inv.id,
    });
  }
  for (const dc of drives) {
    events.push({
      kind: "drive_check",
      at: dc.createdAt.toISOString(),
      title: `Drive check: ${dc.company ?? "Unknown"}`,
      subtitle: `${dc.studentName ?? `student #${dc.studentId}`} • ${dc.verdict} (${dc.score})`,
      entityId: dc.id,
    });
  }
  for (const it of interviews) {
    events.push({
      kind: "interview",
      at: it.createdAt.toISOString(),
      title: `Mock interview: ${it.company} · ${it.round}`,
      subtitle: it.studentName ?? `student #${it.studentId}`,
      entityId: it.id,
    });
  }
  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  res.json(events.slice(0, 100));
});

// ─── Curated opportunities ───────────────────────────────────────────────────
// The "curated" half of the locked aggregated+curated sourcing model. These
// rows pin above scraped results for a matching role/kind, which is how
// fresher-friendly Indian listings get a quality floor the generic boards
// don't provide.

const CURATED_KINDS = ["jobs", "internship", "freelancing"] as const;

router.get("/admin/curated-opportunities", async (_req, res) => {
  const rows = await db
    .select()
    .from(curatedOpportunitiesTable)
    .orderBy(desc(curatedOpportunitiesTable.createdAt))
    .limit(200);
  res.json(rows);
});

router.post("/admin/curated-opportunities", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const title = str(b.title, 200);
  const company = str(b.company, 120);
  const url = str(b.url, 600);
  const kind = str(b.kind, 20);
  if (!title || !company || !url) {
    return res.status(400).json({ error: "title, company and url are required" });
  }
  if (!CURATED_KINDS.includes(kind as (typeof CURATED_KINDS)[number])) {
    return res.status(400).json({ error: `kind must be one of ${CURATED_KINDS.join("|")}` });
  }
  // Only http(s) — a curated row becomes an Apply button on every matching
  // student's feed, so a javascript:/data: URL here would be stored XSS.
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "url must start with http:// or https://" });
  }

  const tags = Array.isArray(b.tags)
    ? b.tags.filter((t): t is string => typeof t === "string").map(t => t.trim().slice(0, 40)).filter(Boolean).slice(0, 8)
    : [];

  const [row] = await db.insert(curatedOpportunitiesTable).values({
    title,
    company,
    logo: str(b.logo, 600) || null,
    location: str(b.location, 120) || "India",
    pay: str(b.pay, 60) || null,
    tags,
    url,
    source: str(b.source, 60) || "KodeTalent",
    kind,
    role: str(b.role, 120),
    active: b.active !== false,
  }).returning();

  return res.status(201).json(row);
});

router.patch("/admin/curated-opportunities/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { active } = (req.body ?? {}) as { active?: unknown };
  if (typeof active !== "boolean") {
    return res.status(400).json({ error: "active (boolean) is required" });
  }
  const [row] = await db
    .update(curatedOpportunitiesTable)
    .set({ active })
    .where(eq(curatedOpportunitiesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.delete("/admin/curated-opportunities/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db
    .delete(curatedOpportunitiesTable)
    .where(eq(curatedOpportunitiesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true });
});

export default router;
