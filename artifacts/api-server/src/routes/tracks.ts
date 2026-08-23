import { Router } from "express";
import { requireStudent, StudentAuthedRequest } from "../middlewares/studentAuth";
import { checkMilestones } from "../lib/trackProgress";

const router = Router();

/**
 * GET /students/:id/track — the student's learning track with per-milestone
 * done state + readiness breakdown. Runs checkMilestones so the view self-heals
 * (any milestone the student has since satisfied flips here on read).
 */
router.get("/students/:id/track", requireStudent({ allowGuest: true }), async (req: StudentAuthedRequest, res) => {
  const id = Number(req.params.id);
  try {
    const progress = await checkMilestones(id);
    return res.json({
      track: progress.track,
      milestones: progress.milestones,
      done: progress.done,
      total: progress.total,
      status: progress.status,
      readiness: progress.readiness,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load track");
    return res.status(500).json({ error: "Failed to load track" });
  }
});

export default router;
