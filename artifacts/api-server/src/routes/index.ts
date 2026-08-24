import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import studentsRouter from "./students";
import questsRouter from "./quests";
import interviewRouter from "./interview";
import jobsRouter from "./jobs";
import leaderboardRouter from "./leaderboard";
import aiRouter from "./ai";
import anthropicRouter from "./anthropic";
import courseRouter from "./course";
import coursesRouter from "./courses";
import courseVideoRouter from "./courseVideo";
import courseLinkRouter from "./courseLink";
import opportunitiesRouter from "./opportunities";
import matchedOpportunitiesRouter from "./matched-opportunities";
import profileRouter from "./profile";
import driveCheckRouter from "./driveCheck";
import resumeRouter from "./resume";
import recruiterRouter from "./recruiter";
import adminRouter from "./admin";
import collegesRouter from "./colleges";
import activityLogRouter from "./activityLog";
import dailyTasksRouter from "./dailyTasks";
import pipelineRouter from "./pipeline";
import notebookRouter from "./notebook";
import collegeAdminRouter from "./collegeAdmin";
import meRouter from "./me";
import tracksRouter from "./tracks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(studentsRouter);
router.use(profileRouter);
router.use(questsRouter);
router.use(interviewRouter);
router.use(jobsRouter);
router.use(leaderboardRouter);
router.use(aiRouter);
router.use(anthropicRouter);
router.use(courseRouter);
router.use(coursesRouter);
router.use(courseVideoRouter);
router.use(courseLinkRouter);
router.use(opportunitiesRouter);
router.use(matchedOpportunitiesRouter);
// (tpoAuthRouter + tpoRouter unmounted: the legacy email/password TPO portal is
//  retired in favor of the Clerk college-admin surface below. Their tables
//  remain; the open, unauthenticated read routes are simply no longer served.)
router.use(driveCheckRouter);
router.use(resumeRouter);
router.use(recruiterRouter);
router.use(adminRouter);
router.use(collegesRouter);
router.use(activityLogRouter);
router.use(dailyTasksRouter);
router.use(pipelineRouter);
router.use(notebookRouter);
router.use(collegeAdminRouter);
router.use(meRouter);
router.use(tracksRouter);

export default router;
