import { Router } from "express";
import { db } from "@workspace/db";
import { questsTable, studentQuestsTable, studentsTable, studentActivityLogTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireStudent } from "../middlewares/studentAuth";

const router = Router();

// GET /quests
router.get("/quests", async (req, res) => {
  try {
    const { field, year } = req.query;
    let query = db.select().from(questsTable);
    const conditions = [];
    if (field) conditions.push(eq(questsTable.field, field as string));
    if (year) conditions.push(eq(questsTable.year, Number(year)));
    const quests = conditions.length > 0
      ? await db.select().from(questsTable).where(and(...conditions)).orderBy(questsTable.year, questsTable.id)
      : await db.select().from(questsTable).orderBy(questsTable.year, questsTable.id);
    return res.json(quests.map(formatQuest));
  } catch (err) {
    req.log.error({ err }, "Failed to list quests");
    return res.status(500).json({ error: "Failed to list quests" });
  }
});

// GET /students/:id/quests
router.get("/students/:id/quests", requireStudent({ allowGuest: true }), async (req, res) => {
  const studentId = Number(req.params.id);
  if (isNaN(studentId)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const allQuests = await db.select().from(questsTable)
      .where(eq(questsTable.field, student.field))
      .orderBy(questsTable.year, questsTable.id);

    const studentQuests = await db.select().from(studentQuestsTable)
      .where(eq(studentQuestsTable.studentId, studentId));

    const questStatusMap = new Map(studentQuests.map(sq => [sq.questId, sq]));

    return res.json(allQuests.map((quest, idx) => {
      const sq = questStatusMap.get(quest.id);
      let status: "not_started" | "in_progress" | "completed" = "not_started";
      if (sq) {
        status = sq.status as "not_started" | "in_progress" | "completed";
      } else if (quest.year > student.year) {
        status = "not_started";
      }
      return {
        quest: formatQuest(quest),
        status,
        completedAt: sq?.completedAt ? sq.completedAt.toISOString() : null,
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to get student quests");
    return res.status(500).json({ error: "Failed to get student quests" });
  }
});

// POST /students/:id/quests/:questId/complete
router.post("/students/:id/quests/:questId/complete", requireStudent({ allowGuest: true }), async (req, res) => {
  const studentId = Number(req.params.id);
  const questId = Number(req.params.questId);
  if (isNaN(studentId) || isNaN(questId)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [quest] = await db.select().from(questsTable).where(eq(questsTable.id, questId)).limit(1);
    if (!quest) return res.status(404).json({ error: "Quest not found" });

    const existing = await db.select().from(studentQuestsTable)
      .where(and(eq(studentQuestsTable.studentId, studentId), eq(studentQuestsTable.questId, questId)))
      .limit(1);

    if (existing.length > 0 && existing[0].status === "completed") {
      const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
      return res.json(formatStudent(student));
    }

    if (existing.length > 0) {
      await db.update(studentQuestsTable)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(studentQuestsTable.id, existing[0].id));
    } else {
      await db.insert(studentQuestsTable).values({
        studentId,
        questId,
        status: "completed",
        completedAt: new Date(),
      });
    }

    // Award XP and update score
    const [updatedStudent] = await db.update(studentsTable)
      .set({
        xp: sql`${studentsTable.xp} + ${quest.xpReward}`,
        overallScore: sql`LEAST(100, ${studentsTable.overallScore} + 2)`,
        streakCount: sql`${studentsTable.streakCount} + 1`,
        lastActiveDate: new Date().toISOString().split("T")[0],
      })
      .where(eq(studentsTable.id, studentId))
      .returning();

    // Log the activity
    await db.insert(studentActivityLogTable).values({
      studentId,
      action: "quest_completed",
      description: `Completed quest: ${quest.title}`,
      xpAmount: quest.xpReward,
    });

    return res.json(formatStudent(updatedStudent));
  } catch (err) {
    req.log.error({ err }, "Failed to complete quest");
    return res.status(500).json({ error: "Failed to complete quest" });
  }
});

function formatQuest(q: typeof questsTable.$inferSelect) {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    field: q.field,
    year: q.year,
    xpReward: q.xpReward,
    minutes: q.minutes,
    whyItMatters: q.whyItMatters,
    howToDoIt: q.howToDoIt,
  };
}

function formatStudent(s: typeof studentsTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    college: s.college,
    city: s.city,
    year: s.year,
    field: s.field,
    githubUrl: s.githubUrl ?? null,
    overallScore: s.overallScore,
    xp: s.xp,
    level: Math.max(1, Math.floor(s.xp / 500) + 1),
    streakCount: s.streakCount,
    lastActiveDate: s.lastActiveDate ?? null,
    skills: (s.skills as Record<string, number>) || {},
    isPro: s.isPro,
    createdAt: s.createdAt.toISOString(),
  };
}

export default router;
