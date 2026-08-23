import { Router } from "express";
import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireStudent, StudentAuthedRequest } from "../middlewares/studentAuth";
import { getTodayTasks, completeTask, addFollowupTask, autoCompleteTaskKind, formatDailyTask, istToday } from "../lib/dailyTasks";
import { logEvent } from "../lib/events";
import { getTopNoticing } from "../lib/noticings";
import { checkMilestones } from "../lib/trackProgress";

const router = Router();

// GET /students/:id/today-tasks
router.get("/students/:id/today-tasks", requireStudent({ allowGuest: true }), async (req: StudentAuthedRequest, res) => {
  const id = Number(req.params.id);
  const student = req.student!;
  try {
    // Self-heal track progress before building tasks: this marks any milestone
    // the student has since satisfied, persists readiness, and yields the next
    // incomplete milestone to surface as today's track_step task. Wrapped so a
    // checker fault never breaks the Home load.
    let trackStep = null;
    try {
      const progress = await checkMilestones(id);
      trackStep = progress.nextTask;
    } catch (err) {
      req.log.error({ err }, "checkMilestones failed (non-fatal)");
    }
    // getTodayTasks and getTopNoticing are independent of each other — run them
    // concurrently. Both work off the same pre-fetched `student` snapshot, so the
    // noticing rules (comeback/streak_risk) still see pre-request state regardless
    // of ordering, preserving the "compute noticing before advancing lastActiveDate"
    // requirement below.
    const [{ date, tasks }, noticing] = await Promise.all([
      getTodayTasks(id, student, trackStep),
      getTopNoticing(id, student),
    ]);
    const today = istToday();
    if (student.lastActiveDate !== today) {
      await db.update(studentsTable).set({ lastActiveDate: today }).where(eq(studentsTable.id, id));
    }
    return res.json({
      date,
      tasks: tasks.map(formatDailyTask),
      streakCount: student.streakCount ?? 0,
      xp: student.xp ?? 0,
      level: student.level ?? 1,
      noticing: noticing ? { text: noticing.text, href: noticing.href } : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load today's tasks");
    return res.status(500).json({ error: "Failed to load today's tasks" });
  }
});

// POST /students/:id/tasks/:taskId/complete
router.post("/students/:id/tasks/:taskId/complete", requireStudent({ allowGuest: true }), async (req: StudentAuthedRequest, res) => {
  const id = Number(req.params.id);
  const taskId = Number(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: "Invalid taskId" });
  try {
    const result = await completeTask(id, taskId, true);
    if (!result) return res.status(404).json({ error: "Task not found" });
    logEvent(id, "task_completed", result.task.label, { date: result.task.date });
    const { tasks: todayTasks } = await getTodayTasks(id, req.student!);
    if (todayTasks.length > 0 && todayTasks.every((t) => t.done)) {
      logEvent(id, "all_tasks_done", "Completed all tasks for the day", { date: result.task.date });
    }
    return res.json({ task: formatDailyTask(result.task), streakCount: result.streakCount, xp: result.xp, level: result.level });
  } catch (err) {
    req.log.error({ err }, "Failed to complete task");
    return res.status(500).json({ error: "Failed to complete task" });
  }
});

// POST /students/:id/tasks/:taskId/uncomplete
router.post("/students/:id/tasks/:taskId/uncomplete", requireStudent({ allowGuest: true }), async (req, res) => {
  const id = Number(req.params.id);
  const taskId = Number(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: "Invalid taskId" });
  try {
    const result = await completeTask(id, taskId, false);
    if (!result) return res.status(404).json({ error: "Task not found" });
    return res.json({ task: formatDailyTask(result.task), streakCount: result.streakCount, xp: result.xp, level: result.level });
  } catch (err) {
    req.log.error({ err }, "Failed to uncomplete task");
    return res.status(500).json({ error: "Failed to uncomplete task" });
  }
});

// POST /students/:id/tasks — R6 writer, called by an interview report's "Add" button.
router.post("/students/:id/tasks", requireStudent(), async (req, res) => {
  const id = Number(req.params.id);
  const { label, sublabel, href } = req.body as { label?: string; sublabel?: string; href?: string };
  if (!label?.trim() || !href?.trim()) return res.status(400).json({ error: "label and href are required" });
  try {
    const row = await addFollowupTask(id, label.trim(), sublabel?.trim(), href.trim());
    if (!row) return res.status(200).json({ ok: true, alreadyExists: true });
    return res.status(201).json(formatDailyTask(row));
  } catch (err) {
    req.log.error({ err }, "Failed to add followup task");
    return res.status(500).json({ error: "Failed to add followup task" });
  }
});

// (Course progress now lives on the enrollment via
// PATCH /students/:id/courses/:enrollmentId/progress in routes/courses.ts —
// the old students.lastCourse write endpoint was removed with that column.)

export default router;
