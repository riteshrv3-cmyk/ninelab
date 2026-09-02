import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useUser } from "@clerk/react";
import {
  ArrowLeft, BookOpen, CreditCard, HelpCircle, CheckCircle2,
  XCircle, RotateCcw, Star, AlertTriangle, Trophy, ChevronRight,
  ChevronDown, PlayCircle, FileText, PenLine, Hammer, ExternalLink,
  Clock, Lock, X, Loader2, Eye, Award, Download, Sparkles, Mic,
  Rocket, Frown, Meh, ThumbsUp, Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/authFetch";
import { DOMAINS } from "@/data/domains";
import { Confetti } from "@/components/ninelab/Confetti";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentId } from "@/hooks/useStudentId";
import { useNameGate } from "@/components/NameGate";
import { DemoBanner, SampleChip } from "@/components/DemoBanner";
import { DEMO_ENROLLMENT, DEMO_STUDENT_NAME } from "@/data/demoStudent";
import { generateCertificatePdf } from "@/lib/certificate-pdf";
import type { CertificateData } from "@/lib/certificate-pdf";
import {
  useEnrollCourse, useUpdateCourseProgress, useSubmitModuleQuiz,
  useGenerateFinalExam, useSubmitFinalExam, useLinkCertificateInterview,
  useConfirmSkill, useIssueCertificate, useCreateInterviewSession,
  getInterviewSession, getCourseEnrollment,
} from "@workspace/api-client-react";
import type {
  CourseEnrollment, EnrollCourseBodyCourseData, QuizResult,
  FinalExam, ExamResult, CertificateInterviewResult, CourseCertificate,
} from "@workspace/api-client-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CourseContext {
  subDomainId: string;
  subDomainName: string;
  domainName: string;
  domainColor: string;
  domainBg: string;
  domainEmoji?: string;
  skills: string[];
}

interface Lesson {
  id: string;
  title: string;
  type: "video" | "reading" | "exercise" | "project";
  duration: string;
  description: string;
  keyPoints: string[];
  searchQuery: string;
}

interface CourseModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  emoji: string;
  topics: string[];
  lessons: Lesson[];
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  topic: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  moduleId?: string;   // present on newly-generated cache; older cache is untagged
}

interface CourseData {
  modules: CourseModule[];
  flashcards: Flashcard[];
  quizQuestions: QuizQuestion[];
}

interface CardSM2 {
  n: number;
  EF: number;
  I: number;
  due: string;
  lapses: number;
}

type Tab = "roadmap" | "flashcards" | "quiz";

// ─── SM-2 Utilities ───────────────────────────────────────────────────────────

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

function sm2Update(state: CardSM2, grade: 1 | 3 | 4 | 5): CardSM2 {
  const { n, EF, I } = state;
  const due = new Date();
  if (grade >= 3) {
    const newI = n === 0 ? 1 : n === 1 ? 6 : Math.round(I * EF);
    const newEF = Math.max(1.3, EF + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    due.setDate(due.getDate() + newI);
    return { n: n + 1, EF: newEF, I: newI, due: due.toISOString(), lapses: state.lapses };
  }
  due.setDate(due.getDate() + 1);
  return { n: 0, EF: state.EF, I: 1, due: due.toISOString(), lapses: state.lapses + 1 };
}

function getCardDifficulty(ef: number): "easy" | "moderate" | "hard" {
  if (ef >= 2.5) return "easy";
  if (ef >= 1.8) return "moderate";
  return "hard";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ─── YouTube helpers ──────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    // youtube.com/watch?v=<id>  or  youtube.com/embed/<id>
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/");
      const embedIdx = parts.indexOf("embed");
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Lesson type config ───────────────────────────────────────────────────────

const LESSON_TYPE = {
  video:    { Icon: PlayCircle,  label: "Video" },
  reading:  { Icon: FileText,    label: "Reading" },
  exercise: { Icon: PenLine,     label: "Exercise" },
  project:  { Icon: Hammer,      label: "Project" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Course() {
  const [, setLocation] = useLocation();
  const reduced = useReducedMotion();
  const { isDemo } = useStudentId();
  const { requireStudent } = useNameGate();

  const [ctx, setCtx] = useState<CourseContext | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [animReady, setAnimReady] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("roadmap");

  // ── Roadmap state ──────────────────────────────────────────────────────────
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  // ── In-app YouTube player ──────────────────────────────────────────────────
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);   // "lessonId|ytId" when playing
  const [videoLoading, setVideoLoading] = useState<string | null>(null);       // lessonId being fetched
  const [videoFallbackId, setVideoFallbackId] = useState<string | null>(null); // lessonId with no video result
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());  // lesson IDs of watched videos

  // ── Flashcard state ────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [progress, setProgress] = useState<Record<string, CardSM2>>({});
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [streak, setStreak] = useState(0);
  const [newCardsToday, setNewCardsToday] = useState(0);
  const DAILY_NEW_LIMIT = 20;

  // ── Backend enrollment + per-module quiz state ─────────────────────────────
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [passedModules, setPassedModules] = useState<Set<string>>(new Set());
  const [moduleQuizAnswer, setModuleQuizAnswer] = useState<Record<string, string>>({});    // moduleId -> chosen letter
  const [moduleQuizResult, setModuleQuizResult] = useState<Record<string, QuizResult>>({}); // moduleId -> server result
  const [moduleQuizSubmitting, setModuleQuizSubmitting] = useState<string | null>(null);    // moduleId in flight

  // ── Final-exam + certificate state ─────────────────────────────────────────
  const [exam, setExam] = useState<FinalExam | null>(null);                                 // generated exam
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});               // questionId -> chosen letter
  const [examResult, setExamResult] = useState<ExamResult | null>(null);                     // last submit result
  const [examPassedFlag, setExamPassedFlag] = useState(false);                               // sticky pass (survives reload)
  const [certInterviewResult, setCertInterviewResult] = useState<CertificateInterviewResult | null>(null);
  const [interviewPassedFlag, setInterviewPassedFlag] = useState(false);                     // sticky interview gate
  const [linkingInterview, setLinkingInterview] = useState(false);                           // mount-effect link in flight
  const [certificate, setCertificate] = useState<CourseCertificate | null>(null);            // issued certificate
  const [confirmedSkills, setConfirmedSkills] = useState<Set<string>>(new Set());
  const [confirmingSkill, setConfirmingSkill] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { isLoaded, isSignedIn } = useUser();
  const studentProfile = useStudentProfile(localStorage.getItem("studentId"));

  const enrollCourse = useEnrollCourse();
  const updateCourseProgress = useUpdateCourseProgress();
  const submitModuleQuiz = useSubmitModuleQuiz();
  const generateFinalExam = useGenerateFinalExam();
  const submitFinalExam = useSubmitFinalExam();
  const linkCertificateInterview = useLinkCertificateInterview();
  const confirmSkill = useConfirmSkill();
  const issueCertificate = useIssueCertificate();
  const createInterview = useCreateInterviewSession();

  const hasFetched = useRef(false);
  const hasEnrolled = useRef(false);
  const progressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextProgressSync = useRef(false);
  const certLinkRan = useRef(false);
  const confettiShown = useRef(false);

  const LOAD_MSGS = [
    "Mapping your learning path...",
    "Building lesson modules...",
    "Crafting flashcards...",
    "Writing quiz questions...",
    "Personalising the content...",
    "Almost ready...",
  ];
  const MIN_ANIM_MS = 3000;

  // ── Animation clock — rotates messages and enforces minimum display time ────
  useEffect(() => {
    const msgTimer = setInterval(() => setMsgIndex(i => (i + 1) % LOAD_MSGS.length), 520);
    const doneTimer = setTimeout(() => setAnimReady(true), MIN_ANIM_MS);
    return () => { clearInterval(msgTimer); clearTimeout(doneTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem("courseContext");
    if (!raw) { setLocation("/practice/courses"); return; }
    const c: CourseContext = JSON.parse(raw);
    setCtx(c);

    // Persist as "last opened course" for Home's Resume card
    try {
      localStorage.setItem("lastCourseContext", JSON.stringify({ ...c, openedAt: new Date().toISOString() }));
    } catch {/* quota — ignore */}

    // Load lesson progress
    const lp = localStorage.getItem(`lesson_progress_${c.subDomainId}`);
    if (lp) setCompletedLessons(new Set(JSON.parse(lp)));

    // Load watched video history
    const wv = localStorage.getItem(`watched_videos_${c.subDomainId}`);
    if (wv) setWatchedVideos(new Set(JSON.parse(wv)));

    // v2 cache key — includes lesson data
    const cacheKey = `course_content_v3_${c.subDomainId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setCourseData(JSON.parse(cached));
      setDataReady(true);
      return;
    }

    if (hasFetched.current) return;
    hasFetched.current = true;

    (async () => {
      try {
        const resp = await fetch("/api/course/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subDomainName: c.subDomainName, domainName: c.domainName, skills: c.skills }),
        });
        if (!resp.ok) throw new Error("Failed");
        const data: CourseData = await resp.json();
        localStorage.setItem(cacheKey, JSON.stringify(data));
        setCourseData(data);
        setDataReady(true);
      } catch {
        setError("Couldn't generate course. Please try again.");
        setDataReady(true);
      }
    })();
  }, [setLocation]);

  // (Progress now syncs to the enrollment via the debounced
  //  updateCourseProgress PATCH below — the old course-progress POST endpoint
  //  and students.lastCourse column were removed.)

  // ── Enroll on mount (idempotent server-side) + seed local from server ───────
  useEffect(() => {
    if (!courseData || !ctx || hasEnrolled.current) return;
    const sid = Number(localStorage.getItem("studentId"));
    if (!sid || Number.isNaN(sid)) return;
    hasEnrolled.current = true;

    // domains.ts carries the domain id; courseContext only has the domain name.
    const domain = DOMAINS.find(d => d.subDomains.some(s => s.id === ctx.subDomainId));
    const domainId = domain?.id ?? ctx.domainName.toLowerCase().trim().replace(/\s+/g, "-");

    enrollCourse.mutateAsync({
      id: sid,
      data: {
        subDomainId: ctx.subDomainId,
        subDomainName: ctx.subDomainName,
        domainId,
        domainName: ctx.domainName,
        skills: ctx.skills,
        courseData: courseData as unknown as EnrollCourseBodyCourseData,
      },
    }).then(enr => {
      setEnrollment(enr);
      setPassedModules(new Set(enr.passedModuleIds));
      // Breadcrumb for Home's Continue chip. href is /practice/courses (not /opportunities/course) because Course redirects there without sessionStorage.courseContext, which won't survive a new session.
      try { localStorage.setItem("kt:lastActivity", JSON.stringify({ label: "your course — " + ctx.subDomainName, href: "/practice/courses" })); } catch { /* quota — non-fatal */ }

      // Server is the cross-device source of truth: seed local when it has more.
      const localLessons: string[] = JSON.parse(localStorage.getItem(`lesson_progress_${ctx.subDomainId}`) || "[]");
      if (enr.completedLessonIds.length > localLessons.length) {
        setCompletedLessons(new Set(enr.completedLessonIds));
        localStorage.setItem(`lesson_progress_${ctx.subDomainId}`, JSON.stringify(enr.completedLessonIds));
      }
      const localVideos: string[] = JSON.parse(localStorage.getItem(`watched_videos_${ctx.subDomainId}`) || "[]");
      if (enr.watchedVideoIds.length > localVideos.length) {
        setWatchedVideos(new Set(enr.watchedVideoIds));
        localStorage.setItem(`watched_videos_${ctx.subDomainId}`, JSON.stringify(enr.watchedVideoIds));
      }
      // Don't echo the just-seeded arrays straight back to the server.
      skipNextProgressSync.current = true;
    }).catch(() => { hasEnrolled.current = false; });
  }, [courseData, ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced progress persistence — localStorage is instant UI, server durable ─
  useEffect(() => {
    if (!enrollment) return;
    if (skipNextProgressSync.current) { skipNextProgressSync.current = false; return; }
    const sid = Number(localStorage.getItem("studentId"));
    if (!sid || Number.isNaN(sid)) return;
    if (progressDebounce.current) clearTimeout(progressDebounce.current);
    progressDebounce.current = setTimeout(() => {
      updateCourseProgress.mutateAsync({
        id: sid,
        enrollmentId: enrollment.id,
        data: {
          completedLessonIds: [...completedLessons],
          watchedVideoIds: [...watchedVideos],
        },
      }).catch(() => { /* fire-and-forget */ });
    }, 600);
    return () => { if (progressDebounce.current) clearTimeout(progressDebounce.current); };
  }, [completedLessons, watchedVideos, enrollment]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build flashcard queue ──────────────────────────────────────────────────
  useEffect(() => {
    if (!courseData || !ctx) return;
    const stored: Record<string, CardSM2> = JSON.parse(localStorage.getItem(`flashcards_progress_${ctx.subDomainId}`) || "{}");
    setProgress(stored);
    const todayCount = parseInt(localStorage.getItem(`daily_new_${ctx.subDomainId}_${todayKey()}`) || "0", 10);
    setNewCardsToday(todayCount);
    const now = new Date();
    const due = courseData.flashcards
      .filter(c => stored[c.id] && new Date(stored[c.id].due) <= now)
      .sort((a, b) => new Date(stored[a.id].due).getTime() - new Date(stored[b.id].due).getTime());
    const newC = fisherYatesShuffle(courseData.flashcards.filter(c => !stored[c.id])).slice(0, Math.max(0, DAILY_NEW_LIMIT - todayCount));
    setQueue([...due, ...newC]);
    setQueueIndex(0);
    const last = localStorage.getItem("flashcard_last_study");
    const today = todayKey();
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);
    const s = parseInt(localStorage.getItem("flashcard_streak") || "0", 10);
    setStreak(last === today || last === yestStr ? s : 0);
  }, [courseData, ctx]);

  // ── Mark video as watched ──────────────────────────────────────────────────
  const markVideoWatched = useCallback((lessonId: string) => {
    if (!ctx) return;
    setWatchedVideos(prev => {
      if (prev.has(lessonId)) return prev;
      const next = new Set(prev);
      next.add(lessonId);
      localStorage.setItem(`watched_videos_${ctx.subDomainId}`, JSON.stringify([...next]));
      return next;
    });
  }, [ctx]);

  // ── Toggle lesson complete ─────────────────────────────────────────────────
  const toggleLesson = useCallback((lessonId: string) => {
    if (!ctx) return;
    setCompletedLessons(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId); else next.add(lessonId);
      localStorage.setItem(`lesson_progress_${ctx.subDomainId}`, JSON.stringify([...next]));
      return next;
    });
  }, [ctx]);

  // ── Grade card ─────────────────────────────────────────────────────────────
  const gradeCard = useCallback((grade: 1 | 3 | 4 | 5) => {
    if (!ctx || queue.length === 0) return;
    const card = queue[queueIndex];
    const existing: CardSM2 = progress[card.id] || { n: 0, EF: 2.5, I: 0, due: new Date().toISOString(), lapses: 0 };
    const updated = sm2Update(existing, grade);
    const isNew = !progress[card.id];
    const newProg = { ...progress, [card.id]: updated };
    setProgress(newProg);
    localStorage.setItem(`flashcards_progress_${ctx.subDomainId}`, JSON.stringify(newProg));
    if (isNew) {
      const dk = `daily_new_${ctx.subDomainId}_${todayKey()}`;
      const nc = newCardsToday + 1;
      setNewCardsToday(nc);
      localStorage.setItem(dk, String(nc));
    }
    const correct = grade >= 3;
    setSessionStats(s => ({ reviewed: s.reviewed + 1, correct: s.correct + (correct ? 1 : 0) }));
    const today = todayKey();
    const last = localStorage.getItem("flashcard_last_study");
    if (last !== today) {
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const cur = parseInt(localStorage.getItem("flashcard_streak") || "0", 10);
      const ns = last === yest.toISOString().slice(0, 10) ? cur + 1 : 1;
      setStreak(ns);
      localStorage.setItem("flashcard_streak", String(ns));
      localStorage.setItem("flashcard_last_study", today);
    }
    setIsFlipped(false);
    setTimeout(() => setQueueIndex(i => i + 1), 200);
  }, [ctx, queue, queueIndex, progress, sessionStats, newCardsToday]);

  // ── Per-module quiz ──────────────────────────────────────────────────────────
  const submitModuleQuizAnswer = useCallback(async (moduleId: string, answer: string) => {
    if (!enrollment) return;
    const sid = Number(localStorage.getItem("studentId"));
    if (!sid || Number.isNaN(sid)) return;
    setModuleQuizSubmitting(moduleId);
    try {
      const res = await submitModuleQuiz.mutateAsync({
        id: sid,
        enrollmentId: enrollment.id,
        moduleId,
        data: { answers: [answer] },
      });
      setModuleQuizResult(r => ({ ...r, [moduleId]: res }));
      if (res.passed) {
        setPassedModules(prev => { const n = new Set(prev); n.add(moduleId); return n; });
        setEnrollment(prev => prev
          ? { ...prev, passedModuleIds: prev.passedModuleIds.includes(moduleId) ? prev.passedModuleIds : [...prev.passedModuleIds, moduleId] }
          : prev);
      }
    } catch {
      /* leave the module un-passed; the Retry button re-enables submission */
    } finally {
      setModuleQuizSubmitting(null);
    }
  }, [enrollment, submitModuleQuiz]);

  const retryModuleQuiz = useCallback((moduleId: string) => {
    setModuleQuizResult(r => { const n = { ...r }; delete n[moduleId]; return n; });
    setModuleQuizAnswer(a => { const n = { ...a }; delete n[moduleId]; return n; });
  }, []);

  // ── Rehydrate sticky certificate gates + issued cert once the enrollment loads ─
  // The enrollment payload doesn't carry the exam/interview gate flags, so the
  // pass state is persisted locally (keyed by enrollment id) to survive reloads.
  useEffect(() => {
    if (!enrollment) return;
    const eid = enrollment.id;
    if (localStorage.getItem(`cert_exam_passed_${eid}`) === "1") setExamPassedFlag(true);
    if (localStorage.getItem(`cert_interview_passed_${eid}`) === "1") setInterviewPassedFlag(true);
    const rawCert = localStorage.getItem(`cert_issued_${eid}`);
    if (rawCert) { try { setCertificate(JSON.parse(rawCert) as CourseCertificate); } catch {/* corrupt — ignore */} }
  }, [enrollment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On return from a certificate interview: link the completed, scored session ─
  useEffect(() => {
    if (!enrollment || certLinkRan.current) return;
    const forEnrollment = sessionStorage.getItem("certInterviewFor");
    if (!forEnrollment || forEnrollment !== String(enrollment.id)) return;
    const sid = Number(localStorage.getItem("studentId"));
    if (!sid || Number.isNaN(sid)) return;
    const interviewSessionId = Number(sessionStorage.getItem("certInterviewSession"));
    if (!interviewSessionId || Number.isNaN(interviewSessionId)) {
      sessionStorage.removeItem("certInterviewFor"); // stale marker, nothing to link
      return;
    }
    certLinkRan.current = true;
    setLinkingInterview(true);
    (async () => {
      try {
        const session = await getInterviewSession(interviewSessionId);
        if (!session.completed || session.overallScore == null) {
          // Not finished/scored yet — allow a later pass to retry.
          certLinkRan.current = false;
          return;
        }
        const res = await linkCertificateInterview.mutateAsync({
          id: sid, enrollmentId: enrollment.id, interviewSessionId,
        });
        setCertInterviewResult(res);
        if (res.passed) {
          setInterviewPassedFlag(true);
          localStorage.setItem(`cert_interview_passed_${enrollment.id}`, "1");
        }
        sessionStorage.removeItem("certInterviewFor");
        sessionStorage.removeItem("certInterviewSession");
        setActiveTab("quiz");
        // Refetch enrollment so passedModuleIds / status reflect the server.
        try {
          const fresh = await getCourseEnrollment(sid, enrollment.id);
          skipNextProgressSync.current = true;
          setEnrollment(fresh);
          setPassedModules(new Set(fresh.passedModuleIds));
        } catch {/* keep current enrollment */}
      } catch {
        certLinkRan.current = false; // transient failure — retry on next mount
      } finally {
        setLinkingInterview(false);
      }
    })();
  }, [enrollment]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fire confetti once both certificate gates are satisfied ──────────────────
  useEffect(() => {
    if (!courseData || confettiShown.current || reduced) return;
    const allPassed = courseData.modules.length > 0 && courseData.modules.every(m => passedModules.has(m.id));
    const done = allPassed && (examPassedFlag || !!examResult?.passed) && (interviewPassedFlag || !!certInterviewResult?.passed);
    if (!done) return;
    confettiShown.current = true;
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 2500);
    return () => clearTimeout(t);
  }, [courseData, passedModules, examPassedFlag, examResult, interviewPassedFlag, certInterviewResult, reduced]);

  if (!ctx) return null;

  // domains.ts carries the domain icon; courseContext only has the domain name.
  const domain = DOMAINS.find(d => d.subDomains.some(s => s.id === ctx.subDomainId));
  const DomainIcon = domain?.icon ?? BookOpen;

  const isLoading = !dataReady || !animReady;

  // ── Live-generation animation ──────────────────────────────────────────────
  if (isLoading) {
    const steps = [
      { label: "Analysing domain", done: msgIndex >= 1 },
      { label: "Building lesson modules", done: msgIndex >= 2 },
      { label: "Creating flashcards", done: msgIndex >= 4 },
      { label: "Writing quiz questions", done: msgIndex >= 5 },
    ];
    const progressPct = Math.min(100, Math.round((msgIndex / (LOAD_MSGS.length - 1)) * 100));

    return (
      <div className="min-h-screen bg-paper flex flex-col px-6 pb-28 pt-16 lg:max-w-2xl lg:mx-auto">
        {/* Domain pill */}
        <div className="flex justify-center mb-8">
          <span className="text-xs font-extrabold px-3 py-1 rounded-full border border-line text-ink-muted inline-flex items-center gap-1.5">
            <DomainIcon className="w-5 h-5 text-brand" strokeWidth={1.75} aria-hidden />
            {ctx.domainName}
          </span>
        </div>

        {/* Pulsing domain icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-2xl flex items-center justify-center bg-brand-soft"
          >
            <DomainIcon className="w-8 h-8 text-brand" strokeWidth={1.75} aria-hidden />
          </motion.div>
        </div>

        {/* Title */}
        <h2 className="text-display text-xl font-extrabold text-ink text-center mb-1">
          {ctx.subDomainName} Course
        </h2>
        <p className="text-[13px] text-ink-muted text-center mb-8">AI is building your personalised course</p>

        {/* Progress bar */}
        <div className="w-full bg-line rounded-full h-2 mb-3 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-brand"
            initial={{ width: "4%" }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="text-[13px] font-extrabold text-center mb-8 text-ink">{progressPct}%</p>

        {/* Rotating message */}
        <div className="h-8 flex items-center justify-center mb-10">
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-sm font-bold text-ink-muted text-center"
            >
              {LOAD_MSGS[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Step checklist */}
        <div>
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
              className="flex items-center gap-3 py-4 border-t border-line first:border-t-0"
            >
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500",
                step.done ? "bg-done" : "border border-line"
              )}>
                {step.done && (
                  <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} viewBox="0 0 12 12" className="w-3 h-3">
                    <polyline points="1.5,6 5,9.5 10.5,2.5" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </motion.svg>
                )}
              </div>
              <p className={cn("text-[13px] font-bold", step.done ? "text-ink" : "text-ink-muted")}>
                {step.label}
              </p>
              {!step.done && (
                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-brand" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !courseData) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 pb-28 lg:max-w-2xl lg:mx-auto">
        <h2 className="text-display text-lg font-extrabold text-ink mb-2">Something went wrong</h2>
        <p className="text-sm text-ink-muted text-center mb-6">{error}</p>
        <Button onClick={() => { setDataReady(false); setAnimReady(false); setMsgIndex(0); hasFetched.current = false; }} className="bg-brand hover:bg-brand/90 text-paper font-bold rounded-xl px-6">
          Try again
        </Button>
      </div>
    );
  }

  // Computed values
  const totalLessons = courseData.modules.reduce((s, m) => s + (m.lessons?.length ?? 0), 0);
  const completedCount = completedLessons.size;
  const overallPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const currentCard = queue[queueIndex];
  const cardsLeft = queue.length - queueIndex;
  const accuracy = sessionStats.reviewed > 0 ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;

  // ── Certificate gate derivations ─────────────────────────────────────────────
  const totalModules = courseData.modules.length;
  const passedModuleCount = courseData.modules.filter(m => passedModules.has(m.id)).length;
  const allModulesPassed = totalModules > 0 && passedModuleCount === totalModules;
  const examPassed = examPassedFlag || !!examResult?.passed;
  const interviewPassed = interviewPassedFlag || !!certInterviewResult?.passed;
  const bothGatesPassed = allModulesPassed && examPassed && interviewPassed;
  const examPct = examResult && examResult.total > 0 ? Math.round((examResult.score / examResult.total) * 100) : 0;
  const isGuest = isLoaded && !isSignedIn;

  // ── Certificate flow handlers ────────────────────────────────────────────────
  const handleGenerateExam = async () => {
    if (!enrollment) return;
    const sid = Number(localStorage.getItem("studentId"));
    if (!sid || Number.isNaN(sid)) return;
    setCertError(null);
    setExamResult(null);
    setExamAnswers({});
    try {
      const generated = await generateFinalExam.mutateAsync({ id: sid, enrollmentId: enrollment.id });
      setExam(generated);
    } catch {
      setCertError("Couldn't generate the exam. Please try again.");
    }
  };

  const handleSubmitExam = async () => {
    if (!enrollment || !exam) return;
    const sid = Number(localStorage.getItem("studentId"));
    if (!sid || Number.isNaN(sid)) return;
    setCertError(null);
    const answers = exam.questions.map(q => examAnswers[q.id] ?? "");
    try {
      const res = await submitFinalExam.mutateAsync({ id: sid, enrollmentId: enrollment.id, data: { answers } });
      setExamResult(res);
      if (res.passed) {
        setExamPassedFlag(true);
        localStorage.setItem(`cert_exam_passed_${enrollment.id}`, "1");
      }
    } catch {
      setCertError("Couldn't submit the exam. Please try again.");
    }
  };

  const handleRetakeExam = () => {
    setExam(null);
    setExamResult(null);
    setExamAnswers({});
    setCertError(null);
  };

  const handleStartCertInterview = async () => {
    if (!enrollment) return;
    const sid = Number(localStorage.getItem("studentId"));
    if (!sid || Number.isNaN(sid)) return;
    setCertError(null);
    try {
      const session = await createInterview.mutateAsync({
        data: { studentId: sid, company: `${ctx.subDomainName} Certificate Interview`, round: "Mixed|Standard" },
      });
      sessionStorage.setItem("certInterviewFor", String(enrollment.id));
      sessionStorage.setItem("certInterviewSession", String(session.id));
      certLinkRan.current = false;
      setLocation(`/practice/interview/${session.id}`);
    } catch {
      setCertError("Couldn't start the interview. Please try again.");
    }
  };

  const handleConfirmSkill = async (skill: string) => {
    if (confirmedSkills.has(skill)) return;
    const sid = Number(localStorage.getItem("studentId"));
    if (!sid || Number.isNaN(sid)) return;
    setConfirmingSkill(skill);
    try {
      // Skills are a 0-100 scale in the UI (rendered as "N%"); a freshly
      // certified skill reads as proficient, aligned with the 70% exam bar.
      await confirmSkill.mutateAsync({ id: sid, data: { skillName: skill, proficiency: 70 } });
      setConfirmedSkills(prev => { const n = new Set(prev); n.add(skill); return n; });
    } catch {
      /* leave the chip un-confirmed so it can be retried */
    } finally {
      setConfirmingSkill(null);
    }
  };

  const handleIssueCertificate = async () => {
    if (!enrollment) return;
    // Guests can't be issued a certificate (server returns 401/403) — send them to sign up first.
    if (isGuest) { setLocation("/sign-up"); return; }
    const sid = Number(localStorage.getItem("studentId"));
    if (!sid || Number.isNaN(sid)) return;
    setCertError(null);
    try {
      const cert = await issueCertificate.mutateAsync({ id: sid, enrollmentId: enrollment.id });
      setCertificate(cert);
      localStorage.setItem(`cert_issued_${enrollment.id}`, JSON.stringify(cert));
    } catch {
      setCertError("Couldn't issue the certificate. Make sure you're signed in and try again.");
    }
  };

  const handleDownloadCertificate = async () => {
    if (!certificate) return;
    setDownloadingPdf(true);
    setCertError(null);
    try {
      const data: CertificateData = {
        studentName: studentProfile.data?.name || "Student",
        certificateCode: certificate.certificateCode,
        subDomainName: certificate.subDomainName,
        domainName: certificate.domainName,
        skillsCovered: certificate.skillsCovered,
        finalExamScore: certificate.finalExamScore,
        issuedAt: certificate.issuedAt,
        verifyUrl: `${window.location.origin}/certs/${certificate.verifySlug}`,
      };
      const blob = await generateCertificatePdf(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${certificate.certificateCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setCertError("Couldn't generate the PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const TABS = [
    { id: "roadmap" as Tab, label: "Course", icon: BookOpen },
    { id: "flashcards" as Tab, label: "Flashcards", icon: CreditCard },
    { id: "quiz" as Tab, label: "Final Exam", icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-paper pb-28">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-paper px-4 pt-4 pb-0">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setLocation("/opportunities")}
            className="w-9 h-9 rounded-full border border-line flex items-center justify-center flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold uppercase tracking-wider text-ink-muted truncate flex items-center gap-1.5">
              <DomainIcon className="w-5 h-5 text-brand shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{ctx.domainName}</span>
            </p>
            <h1 className="text-display text-[18px] font-extrabold text-ink truncate">{ctx.subDomainName}</h1>
          </div>
        </div>
        <div className="flex gap-2 mb-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[13px] font-extrabold transition-colors",
                  active ? "bg-brand text-paper" : "text-ink-muted border border-line")}>
                <Icon className="w-3.5 h-3.5" />{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-3">
        <AnimatePresence mode="wait">

          {/* ══════════════════════════════════════════════════════
              ROADMAP / COURSE TAB — Coursera-style
          ══════════════════════════════════════════════════════ */}
          {activeTab === "roadmap" && (
            <motion.div key="roadmap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="lg:max-w-3xl lg:mx-auto">

              {isDemo && (
                <div className="mb-4 space-y-2">
                  <DemoBanner />
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3.5 py-2.5">
                    <SampleChip />
                    <p className="text-[13px] font-semibold text-ink">
                      {DEMO_STUDENT_NAME} · {DEMO_ENROLLMENT.subDomainName} {DEMO_ENROLLMENT.progressPct}%
                    </p>
                  </div>
                </div>
              )}

              {/* Hero progress banner */}
              <div className="rounded-2xl bg-paper shadow-soft p-4 mb-4">
                <div className="flex items-center gap-4">
                  {/* Circular progress ring */}
                  <div className="relative flex-shrink-0 w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" fill="none" className="stroke-line" strokeWidth="6" />
                      <circle cx="32" cy="32" r="26" fill="none" className="stroke-brand transition-all duration-700" strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 26}`}
                        strokeDashoffset={`${2 * Math.PI * 26 * (1 - overallPct / 100)}`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-ink font-extrabold text-[13px]">{overallPct}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-extrabold text-base leading-tight text-ink">{ctx.subDomainName} Course</p>
                    <p className="text-[13px] text-ink-muted mt-0.5">{completedCount} / {totalLessons} lessons complete</p>
                    <p className="text-[13px] text-ink-muted mt-1">{courseData.modules.length} modules · {ctx.skills.slice(0, 2).join(", ")}</p>
                  </div>
                </div>
              </div>

              {/* ── Build a Project CTA ─────────────────────────────── */}
              <button
                onClick={() => {
                  const params = new URLSearchParams({
                    addProject: "1",
                    from: ctx.subDomainName,
                    tech: ctx.skills.slice(0, 4).join(","),
                  });
                  setLocation(`/profile?${params.toString()}`);
                }}
                data-testid="cta-build-project"
                className="w-full mb-4 rounded-2xl p-4 text-left bg-paper shadow-soft hover:shadow-md transition-shadow flex items-center gap-3 group"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-soft">
                  <Rocket className="w-5 h-5 text-brand" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-ink text-[14px] leading-tight">
                    {overallPct === 100 ? "Course complete! Ship a project →" : "Build a project with what you've learned →"}
                  </p>
                  <p className="text-[13px] text-ink-muted mt-0.5 truncate">
                    Add a {ctx.subDomainName} project to your profile — recruiters &amp; TPOs will see it
                  </p>
                </div>
                <ArrowLeft className="w-4 h-4 text-ink-muted rotate-180 group-hover:text-ink flex-shrink-0" />
              </button>

              {/* Module accordion */}
              <div>
                {courseData.modules.map((mod, modIdx) => {
                  const lessons = mod.lessons ?? [];
                  const modCompleted = lessons.filter(l => completedLessons.has(l.id)).length;
                  const modPct = lessons.length > 0 ? Math.round((modCompleted / lessons.length) * 100) : 0;
                  const isExpanded = expandedModule === mod.id;
                  // Real gate: module N is locked until the previous module's quiz is passed. Module 1 is always open.
                  const prevMod = modIdx > 0 ? courseData.modules[modIdx - 1] : null;
                  const isLocked = prevMod ? !passedModules.has(prevMod.id) : false;

                  return (
                    <motion.div key={mod.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: modIdx * 0.07 }}
                      className={cn("border-t border-line first:border-t-0", isLocked && "opacity-60")}>
                      {/* Module header */}
                      <button
                        onClick={() => { if (isLocked) return; setExpandedModule(isExpanded ? null : mod.id); setExpandedLesson(null); }}
                        disabled={isLocked}
                        className="w-full overflow-hidden text-left disabled:cursor-not-allowed"
                      >
                        <div className="py-4">
                          <div className="flex items-center gap-3">
                            {/* Module icon circle */}
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl border border-line bg-paper">
                              {modCompleted === lessons.length && lessons.length > 0
                                ? <CheckCircle2 className="w-5 h-5 text-done" />
                                : <span>{mod.emoji}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
                                    Module {modIdx + 1}
                                  </p>
                                  <p className="font-extrabold text-ink text-[14px] leading-tight">{mod.title}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {isLocked && <Lock className="w-3.5 h-3.5 text-ink-muted" />}
                                  <ChevronDown className={cn("w-4 h-4 text-ink-muted transition-transform duration-200", isExpanded && "rotate-180")} />
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${modPct}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-ink-muted whitespace-nowrap">
                                  {modCompleted}/{lessons.length} · <Clock className="w-2.5 h-2.5 inline" /> {mod.duration}
                                </span>
                              </div>
                              {isLocked && (
                                <p className="flex items-center gap-1 text-[10px] font-bold text-ink-muted mt-1.5">
                                  <Lock className="w-2.5 h-2.5" /> Pass module {modIdx}'s quiz to unlock
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Lesson list — shown when expanded */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: "easeInOut" }}
                              className="overflow-hidden border-t border-line"
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="pl-3 py-1">
                                {lessons.map((lesson, lessonIdx) => {
                                  const cfg = LESSON_TYPE[lesson.type] ?? LESSON_TYPE.video;
                                  const LIcon = cfg.Icon;
                                  const done = completedLessons.has(lesson.id);
                                  const lessonOpen = expandedLesson === lesson.id;

                                  return (
                                    <div key={lesson.id} className="border-t border-line first:border-t-0">
                                      {/* Lesson row */}
                                      <button
                                        onClick={() => setExpandedLesson(lessonOpen ? null : lesson.id)}
                                        className="w-full flex items-center gap-3 py-3 text-left"
                                      >
                                        {/* Type icon */}
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border border-line">
                                          {done
                                            ? <CheckCircle2 className="w-4 h-4 text-done" />
                                            : <LIcon className="w-4 h-4 text-ink-muted" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className={cn("text-[13px] font-bold leading-tight",
                                            done ? "text-ink-muted line-through" : "text-ink")}>
                                            {lessonIdx + 1}. {lesson.title}
                                          </p>
                                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-line text-ink-muted">
                                              {cfg.label}
                                            </span>
                                            <span className="text-[10px] text-ink-muted font-bold flex items-center gap-1">
                                              <Clock className="w-2.5 h-2.5" />{lesson.duration}
                                            </span>
                                            {lesson.type === "video" && watchedVideos.has(lesson.id) && (
                                              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-line text-ink-muted">
                                                <Eye className="w-2.5 h-2.5" /> Watched
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <ChevronRight className={cn("w-4 h-4 text-ink-muted transition-transform flex-shrink-0", lessonOpen && "rotate-90")} />
                                      </button>

                                      {/* Lesson detail — inline expand */}
                                      <AnimatePresence>
                                        {lessonOpen && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="ml-11 mb-3 rounded-2xl overflow-hidden bg-paper shadow-soft">
                                              {/* Description */}
                                              <div className="p-4 pb-3">
                                                <p className="text-xs text-ink font-bold leading-relaxed mb-3">
                                                  {lesson.description}
                                                </p>

                                                {/* Key points */}
                                                {lesson.keyPoints?.length > 0 && (
                                                  <div className="space-y-1.5 mb-4">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                                                      What you'll learn
                                                    </p>
                                                    {lesson.keyPoints.map((pt, i) => (
                                                      <div key={i} className="flex items-start gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-brand" />
                                                        <p className="text-[13px] text-ink font-bold leading-snug">{pt}</p>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}

                                                {/* Actions */}
                                                <div className="flex gap-2">
                                                  {lesson.type === "video" ? (
                                                    /* ── In-app YouTube embed for video lessons ── */
                                                    playingVideoId?.startsWith(lesson.id + "|") ? (
                                                      /* Playing — show close button */
                                                      <button
                                                        onClick={() => setPlayingVideoId(null)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-[13px] border border-line text-ink"
                                                      >
                                                        <X className="w-4 h-4" /> Close video
                                                      </button>
                                                    ) : (
                                                      <>
                                                        <button
                                                          onClick={async () => {
                                                            const q = lesson.searchQuery || lesson.title;
                                                            setVideoFallbackId(null);
                                                            setVideoLoading(lesson.id);
                                                            try {
                                                              const r = await fetch(`/api/course/best-video?q=${encodeURIComponent(q)}`);
                                                              const data = r.ok ? await r.json() as { watchUrl?: string | null } : null;
                                                              const ytId = data?.watchUrl ? extractYouTubeId(data.watchUrl) : null;
                                                              if (ytId) {
                                                                setPlayingVideoId(lesson.id + "|" + ytId);
                                                                markVideoWatched(lesson.id);
                                                              } else {
                                                                /* no embeddable video — show in-card search link */
                                                                setVideoFallbackId(lesson.id);
                                                              }
                                                            } catch {
                                                              setVideoFallbackId(lesson.id);
                                                            } finally {
                                                              setVideoLoading(null);
                                                            }
                                                          }}
                                                          disabled={videoLoading === lesson.id}
                                                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-[13px] bg-brand text-paper disabled:opacity-70"
                                                        >
                                                          {videoLoading === lesson.id
                                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</>
                                                            : <><PlayCircle className="w-4 h-4" /> Watch video</>}
                                                        </button>
                                                        {videoFallbackId === lesson.id && (
                                                          <a
                                                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lesson.searchQuery || lesson.title)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-[13px] font-semibold text-ink underline underline-offset-2 whitespace-nowrap self-center"
                                                          >
                                                            Search on YouTube <ExternalLink className="w-3 h-3" />
                                                          </a>
                                                        )}
                                                      </>
                                                    )
                                                  ) : (
                                                    /* ── External link for reading / exercise / project ── */
                                                    (() => {
                                                      const q = lesson.searchQuery || lesson.title;
                                                      const ACTION = {
                                                        reading:  { label: "Read tutorial",  endpoint: `/api/course/best-link?kind=reading&q=${encodeURIComponent(q)}`,  fallback: `https://www.google.com/search?q=${encodeURIComponent(`${q} tutorial site:w3schools.com OR site:developer.mozilla.org OR site:geeksforgeeks.org`)}`, pickUrl: (d: { url?: string | null }) => d?.url ?? null },
                                                        exercise: { label: "Try exercises",  endpoint: `/api/course/best-link?kind=exercise&q=${encodeURIComponent(q)}`, fallback: `https://www.google.com/search?q=${encodeURIComponent(`${q} practice site:leetcode.com OR site:hackerrank.com OR site:geeksforgeeks.org`)}`,         pickUrl: (d: { url?: string | null }) => d?.url ?? null },
                                                        project:  { label: "Find project",   endpoint: `/api/course/best-link?kind=project&q=${encodeURIComponent(q)}`,  fallback: `https://www.google.com/search?q=${encodeURIComponent(`${q} project ideas site:github.com OR site:freecodecamp.org`)}`,                              pickUrl: (d: { url?: string | null }) => d?.url ?? null },
                                                      } as const;
                                                      const a = ACTION[lesson.type as keyof typeof ACTION];
                                                      if (!a) return null;
                                                      return (
                                                        <button
                                                          onClick={async () => {
                                                            const win = window.open("about:blank", "_blank");
                                                            try {
                                                              const r = await fetch(a.endpoint);
                                                              const data = r.ok ? await r.json() : null;
                                                              const target = (data && a.pickUrl(data)) || a.fallback;
                                                              if (win) win.location.href = target;
                                                              else window.location.href = target;
                                                            } catch {
                                                              if (win) win.location.href = a.fallback;
                                                              else window.location.href = a.fallback;
                                                            }
                                                          }}
                                                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-[13px] bg-brand text-paper"
                                                        >
                                                          <ExternalLink className="w-4 h-4" />
                                                          {a.label}
                                                        </button>
                                                      );
                                                    })()
                                                  )}
                                                  {/* Mark complete */}
                                                  <button
                                                    onClick={() => toggleLesson(lesson.id)}
                                                    className={cn(
                                                      "flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-[13px] border transition-colors",
                                                      done
                                                        ? "bg-line border-line text-ink"
                                                        : "bg-paper border-line text-ink"
                                                    )}
                                                  >
                                                    <CheckCircle2 className={cn("w-4 h-4", done && "text-done")} />
                                                    {done ? "Done!" : "Mark Done"}
                                                  </button>
                                                </div>

                                                {/* ── Inline YouTube player ── */}
                                                {lesson.type === "video" && playingVideoId?.startsWith(lesson.id + "|") && (() => {
                                                  const ytId = playingVideoId.split("|")[1];
                                                  return (
                                                    <>
                                                      <div className="mt-3 rounded-xl overflow-hidden border border-line bg-ink" style={{ aspectRatio: "16/9" }}>
                                                        <iframe
                                                          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                                                          title={lesson.title}
                                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                          allowFullScreen
                                                          className="w-full h-full border-0"
                                                        />
                                                      </div>
                                                      {/* Mark done prompt */}
                                                      {!done && (
                                                        <motion.div
                                                          initial={{ opacity: 0, y: 6 }}
                                                          animate={{ opacity: 1, y: 0 }}
                                                          transition={{ delay: 0.4 }}
                                                          className="mt-2 flex items-center justify-between gap-2 bg-paper rounded-xl px-3 py-2.5 border border-line"
                                                        >
                                                          <p className="text-[13px] font-bold text-ink leading-tight">
                                                            Mark this lesson done?
                                                          </p>
                                                          <button
                                                            onClick={() => toggleLesson(lesson.id)}
                                                            className="flex items-center gap-1 text-[13px] font-extrabold px-3 py-1.5 rounded-lg bg-brand text-paper flex-shrink-0"
                                                          >
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                                                          </button>
                                                        </motion.div>
                                                      )}
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* ── Per-module quiz — gates the next module ── */}
                              {(() => {
                                const moduleQuiz = courseData.quizQuestions.find(q => q.moduleId === mod.id)
                                  ?? courseData.quizQuestions[modIdx]; // fallback for old untagged cache
                                if (!moduleQuiz) return null;
                                const chosen = moduleQuizAnswer[mod.id];
                                const result = moduleQuizResult[mod.id];
                                const submitted = !!result;
                                const submitting = moduleQuizSubmitting === mod.id;
                                return (
                                  <div className="pl-3 pb-4 pt-1 border-t border-line" onClick={e => e.stopPropagation()}>
                                    <div className="rounded-2xl bg-paper shadow-soft p-4">
                                      <div className="flex items-center gap-1.5 mb-2">
                                        <HelpCircle className="w-3.5 h-3.5 text-ink-muted" />
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Module quiz</p>
                                        {passedModules.has(mod.id) && (
                                          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-done">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[13px] font-extrabold text-ink leading-snug mb-3">{moduleQuiz.question}</p>
                                      <div className="space-y-2 mb-3">
                                        {moduleQuiz.options.map(opt => {
                                          const letter = opt.charAt(0);
                                          const isChosen = chosen === letter;
                                          const isAnswer = letter === moduleQuiz.answer;
                                          let optBg = "bg-paper", optBorder = "border-line";
                                          let mark: "correct" | "incorrect" | null = null;
                                          if (submitted) {
                                            if (isAnswer) { optBg = "bg-done/10"; optBorder = "border-done"; mark = "correct"; }
                                            else if (isChosen) { optBg = "bg-danger/10"; optBorder = "border-danger"; mark = "incorrect"; }
                                          } else if (isChosen) { optBg = "bg-brand-soft"; optBorder = "border-brand"; }
                                          return (
                                            <button
                                              key={opt}
                                              disabled={submitted || submitting}
                                              onClick={() => setModuleQuizAnswer(a => ({ ...a, [mod.id]: letter }))}
                                              className={cn("w-full flex items-center gap-2 text-left p-3 rounded-xl border font-bold text-[13px] text-ink transition-colors disabled:cursor-default", optBg, optBorder)}
                                            >
                                              <span className="flex-1">{opt}</span>
                                              {mark === "correct" && <CheckCircle2 className="w-4 h-4 text-done flex-shrink-0" />}
                                              {mark === "incorrect" && <XCircle className="w-4 h-4 text-danger flex-shrink-0" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {!submitted ? (
                                        <Button
                                          disabled={submitting || (!isDemo && (!chosen || !enrollment))}
                                          onClick={() => {
                                            if (isDemo) {
                                              requireStudent(() => {}, {
                                                title: "Starting this course",
                                              });
                                              return;
                                            }
                                            if (chosen) submitModuleQuizAnswer(mod.id, chosen);
                                          }}
                                          className="w-full h-10 rounded-xl font-bold bg-brand hover:bg-brand/90 text-paper text-[13px] disabled:opacity-60"
                                        >
                                          {submitting
                                            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Submitting…</>
                                            : "Submit answer"}
                                        </Button>
                                      ) : (
                                        <motion.div initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                                          <div className="flex items-center gap-2 mb-1">
                                            {result.passed ? <CheckCircle2 className="w-4 h-4 text-done" /> : <XCircle className="w-4 h-4 text-danger" />}
                                            <p className="text-[13px] font-extrabold text-ink">
                                              {result.passed ? "Passed — next module unlocked!" : `Not quite. Correct answer: ${moduleQuiz.answer}`}
                                            </p>
                                          </div>
                                          <p className="text-xs text-ink-muted leading-relaxed mb-3">{moduleQuiz.explanation}</p>
                                          {!result.passed && (
                                            <Button
                                              variant="outline"
                                              onClick={() => retryModuleQuiz(mod.id)}
                                              className="w-full h-10 rounded-xl font-bold border border-line text-brand bg-paper hover:bg-brand-soft text-[13px]"
                                            >
                                              <RotateCcw className="w-4 h-4 mr-1.5" /> Retry
                                            </Button>
                                          )}
                                        </motion.div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Bottom CTA */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="mt-4 rounded-2xl bg-paper shadow-soft p-4">
                <p className="text-sm font-extrabold mb-1 text-ink">
                  {overallPct === 100 ? "Course complete! Now test yourself." : "Learning tip"}
                </p>
                <p className="text-xs text-ink-muted mb-3">
                  {overallPct === 100
                    ? "You've finished all lessons. Reinforce your knowledge with flashcards and the quiz."
                    : "After each lesson, review flashcards and take the quiz to lock in what you learned."}
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setActiveTab("flashcards")} className="flex-1 h-10 rounded-xl bg-brand hover:bg-brand/90 text-paper font-bold text-[13px]">
                    <CreditCard className="w-4 h-4 mr-1.5" /> Flashcards
                  </Button>
                  <Button onClick={() => setActiveTab("quiz")} variant="outline" className="flex-1 h-10 rounded-xl font-bold text-[13px] border border-line text-brand bg-paper hover:bg-brand-soft">
                    <Trophy className="w-4 h-4 mr-1.5" /> Final Exam
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════
              FLASHCARDS TAB
          ══════════════════════════════════════════════════════ */}
          {activeTab === "flashcards" && (
            <motion.div key="flashcards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="lg:max-w-2xl lg:mx-auto">
              {/* Stats bar */}
              <div className="flex gap-2 mb-4">
                {[
                  { label: "Reviewed", value: sessionStats.reviewed },
                  { label: "Accuracy", value: `${accuracy}%` },
                  { label: "Streak", value: `🔥 ${streak}` },
                ].map(s => (
                  <div key={s.label} className="flex-1 rounded-xl bg-paper shadow-soft p-3 text-center">
                    <p className="text-[13px] text-ink-muted font-bold">{s.label}</p>
                    <p className="text-lg font-extrabold text-ink">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[13px] font-bold text-ink-muted">
                  {cardsLeft > 0 ? `${queueIndex + 1} / ${queue.length} cards` : "Session complete!"}
                </p>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-ink-muted" />
                  <p className="text-[13px] font-bold text-ink-muted">{cardsLeft} remaining</p>
                </div>
              </div>
              {queue.length > 0 && (
                <div className="h-1.5 bg-line rounded-full mb-4 overflow-hidden">
                  <div className="h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${(queueIndex / queue.length) * 100}%` }} />
                </div>
              )}

              {cardsLeft === 0 ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl bg-paper shadow-soft p-8 text-center">
                  {/* Milestone moments are the one place personality is allowed —
                      see the Phase 3 call to keep rare celebrations despite the
                      monochrome palette. */}
                  <h2 className="text-display text-xl font-extrabold text-ink mb-1">
                    {sessionStats.reviewed > 0 ? "Session complete! 🎉" : "All caught up!"}
                  </h2>
                  <p className="text-sm text-ink-muted mb-4">
                    {sessionStats.reviewed > 0
                      ? `You reviewed ${sessionStats.reviewed} cards with ${accuracy}% accuracy.`
                      : "No cards due right now. Come back tomorrow!"}
                  </p>
                  <Button onClick={() => setActiveTab("quiz")} className="w-full h-11 rounded-xl font-bold bg-brand hover:bg-brand/90 text-paper">
                    Go to Final Exam <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </motion.div>
              ) : (
                <AnimatePresence mode="wait">
                  {currentCard && (
                    <motion.div key={currentCard.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
                      {/* Flip card */}
                      <div className="relative cursor-pointer select-none mb-4" style={{ perspective: "1200px", height: 240 }}
                        onClick={() => setIsFlipped(f => !f)}>
                        <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.45, ease: "easeInOut" }}
                          style={{ transformStyle: "preserve-3d", width: "100%", height: "100%" }}>
                          {/* Front */}
                          <div className="absolute inset-0 bg-paper shadow-soft rounded-2xl flex flex-col items-center justify-center p-6 text-center"
                            style={{ backfaceVisibility: "hidden" }}>
                            {progress[currentCard.id] && (
                              <div className="absolute top-3 right-3">
                                <div className={cn("w-2.5 h-2.5 rounded-full", {
                                  "bg-line": getCardDifficulty(progress[currentCard.id].EF) === "easy",
                                  "bg-ink-muted": getCardDifficulty(progress[currentCard.id].EF) === "moderate",
                                  "bg-ink": getCardDifficulty(progress[currentCard.id].EF) === "hard",
                                })} />
                              </div>
                            )}
                            {progress[currentCard.id]?.lapses > 4 && (
                              <div className="absolute top-3 left-3 flex items-center gap-1 text-ink-muted">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold">Leech card</span>
                              </div>
                            )}
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-ink-muted">
                              {currentCard.topic}
                            </p>
                            <p className="text-base font-extrabold text-ink leading-snug">{currentCard.front}</p>
                            <p className="text-[13px] text-ink-muted mt-4">Tap to reveal answer</p>
                          </div>
                          {/* Back */}
                          <div className="absolute inset-0 rounded-2xl bg-paper shadow-soft flex flex-col items-center justify-center p-6 text-center"
                            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-ink-muted">Answer</p>
                            <p className="text-[14px] font-bold text-ink leading-relaxed">{currentCard.back}</p>
                          </div>
                        </motion.div>
                      </div>

                      <AnimatePresence>
                        {isFlipped && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="grid grid-cols-4 gap-2">
                            {[
                              { grade: 1 as const, label: "Again", icon: Frown },
                              { grade: 3 as const, label: "Hard",  icon: Meh },
                              { grade: 4 as const, label: "Good",  icon: ThumbsUp },
                              { grade: 5 as const, label: "Easy",  icon: Smile },
                            ].map(g => (
                              <button key={g.grade} onClick={() => gradeCard(g.grade)}
                                className="flex flex-col items-center py-2.5 rounded-xl font-bold border border-line text-ink bg-paper hover:bg-line active:bg-line transition-colors active:scale-95">
                                <g.icon className="w-5 h-5 mb-0.5 text-brand" strokeWidth={1.75} aria-hidden />
                                <span className="text-[13px]">{g.label}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════
              QUIZ TAB
          ══════════════════════════════════════════════════════ */}
          {activeTab === "quiz" && (
            <motion.div key="quiz" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="lg:max-w-2xl lg:mx-auto">

              {/* ── LOCKED: finish the module quizzes first ── */}
              {!allModulesPassed && (
                <div className="rounded-2xl bg-paper shadow-soft p-6 text-center">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-line">
                    <Lock className="w-7 h-7 text-ink-muted" />
                  </div>
                  <h2 className="text-display text-xl font-extrabold text-ink mb-1">Final exam</h2>
                  <p className="text-sm text-ink-muted mb-4">
                    Pass all {totalModules} module quizzes to unlock the final exam.
                  </p>
                  <div className="h-1.5 bg-line rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${totalModules > 0 ? (passedModuleCount / totalModules) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[13px] font-bold text-ink-muted mb-5">{passedModuleCount} / {totalModules} modules passed</p>
                  <Button disabled className="w-full h-11 rounded-xl font-bold bg-brand text-paper opacity-50 cursor-not-allowed">
                    <Lock className="w-4 h-4 mr-1.5" /> Locked
                  </Button>
                </div>
              )}

              {/* ── COMPLETION: both gates satisfied ── */}
              {allModulesPassed && bothGatesPassed && (
                <>
                  {showConfetti && !reduced && <Confetti />}
                  {!certificate ? (
                    <div className="rounded-2xl bg-paper shadow-soft p-6">
                      <div className="text-center mb-5">
                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 bg-brand-soft">
                          <Award className="w-8 h-8 text-brand" />
                        </div>
                        <h2 className="text-display text-xl font-extrabold text-ink mb-1">You did it! 🎉</h2>
                        <p className="text-sm text-ink-muted">
                          You've passed every module, the final exam, and your certificate interview.
                        </p>
                      </div>

                      {/* Skill confirm chips */}
                      {ctx.skills.length > 0 && (
                        <div className="mb-5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-2">Confirm your skills</p>
                          <div className="flex flex-wrap gap-2">
                            {ctx.skills.map(skill => {
                              const added = confirmedSkills.has(skill);
                              const busy = confirmingSkill === skill;
                              return (
                                <button
                                  key={skill}
                                  onClick={() => handleConfirmSkill(skill)}
                                  disabled={added || busy}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-bold transition-colors disabled:cursor-default",
                                    added ? "bg-brand border-brand text-paper" : "bg-paper border-line text-ink hover:bg-brand-soft",
                                  )}
                                >
                                  {busy
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : added
                                      ? <CheckCircle2 className="w-3.5 h-3.5" />
                                      : <Sparkles className="w-3.5 h-3.5" />}
                                  {skill}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {isGuest && (
                        <p className="text-[13px] font-bold text-ink-muted text-center mb-3">
                          Sign in to claim and keep your certificate.
                        </p>
                      )}

                      <Button
                        onClick={handleIssueCertificate}
                        disabled={issueCertificate.isPending}
                        className="w-full h-11 rounded-xl font-bold bg-brand hover:bg-brand/90 text-paper disabled:opacity-60"
                      >
                        {issueCertificate.isPending
                          ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Issuing…</>
                          : <><Award className="w-4 h-4 mr-1.5" /> Issue certificate</>}
                      </Button>
                      {certError && <p className="text-[13px] font-bold text-danger text-center mt-3">{certError}</p>}
                    </div>
                  ) : (
                    /* ── Issued certificate card ── */
                    <div className="rounded-2xl bg-paper shadow-soft p-6 text-center">
                      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 bg-brand-soft">
                        <Award className="w-8 h-8 text-brand" />
                      </div>
                      <h2 className="text-display text-xl font-extrabold text-ink mb-1">Certificate earned</h2>
                      <p className="text-sm font-bold text-ink">{certificate.subDomainName}</p>
                      <p className="text-[13px] text-ink-muted mb-1">{certificate.domainName}</p>
                      <p className="text-[13px] font-bold text-ink-muted mb-5">
                        {certificate.certificateCode} · Final exam {certificate.finalExamScore}%
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleDownloadCertificate}
                          disabled={downloadingPdf}
                          className="flex-1 h-11 rounded-xl font-bold bg-brand hover:bg-brand/90 text-paper text-[13px] disabled:opacity-60"
                        >
                          {downloadingPdf
                            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Preparing…</>
                            : <><Download className="w-4 h-4 mr-1.5" /> Download PDF</>}
                        </Button>
                        <a
                          href={`/certs/${certificate.verifySlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 h-11 rounded-xl font-bold text-[13px] border border-line text-brand bg-paper hover:bg-brand-soft flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-4 h-4" /> View public link
                        </a>
                      </div>
                      {certError && <p className="text-[13px] font-bold text-danger mt-3">{certError}</p>}
                    </div>
                  )}
                </>
              )}

              {/* ── EXAM STEP: modules passed, final exam not yet passed ── */}
              {allModulesPassed && !bothGatesPassed && !examPassed && (
                examResult && !examResult.passed ? (
                  /* Fail screen — unlimited retakes */
                  <div className="rounded-2xl bg-paper shadow-soft p-6 text-center">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-line">
                      <XCircle className="w-8 h-8 text-danger" />
                    </div>
                    <h2 className="text-display text-xl font-extrabold text-ink mb-1">Not quite — {examPct}%</h2>
                    <p className="text-sm text-ink-muted mb-1">
                      You scored {examResult.score} / {examResult.total}. You need 70% to earn your certificate.
                    </p>
                    <p className="text-[13px] text-ink-muted mb-5">Unlimited retakes — a fresh exam is generated each time.</p>
                    <Button
                      onClick={handleRetakeExam}
                      disabled={generateFinalExam.isPending}
                      className="w-full h-11 rounded-xl font-bold bg-brand hover:bg-brand/90 text-paper"
                    >
                      <RotateCcw className="w-4 h-4 mr-1.5" /> Retake exam
                    </Button>
                  </div>
                ) : exam ? (
                  /* Questions on one page */
                  <div className="rounded-2xl bg-paper shadow-soft p-5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Trophy className="w-3.5 h-3.5 text-ink-muted" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Final exam</p>
                      <span className="ml-auto text-[10px] font-bold text-ink-muted">
                        {exam.questions.filter(q => examAnswers[q.id]).length} / {exam.questions.length} answered
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-muted mb-2">Score 70% or higher to earn your certificate.</p>
                    {exam.questions.map((q, qi) => (
                      <div key={q.id} className="border-t border-line py-4">
                        <p className="text-[13px] font-extrabold text-ink leading-snug mb-3">{qi + 1}. {q.question}</p>
                        <div className="space-y-2">
                          {q.options.map(opt => {
                            const letter = opt.charAt(0);
                            const chosen = examAnswers[q.id] === letter;
                            return (
                              <button
                                key={opt}
                                disabled={submitFinalExam.isPending}
                                onClick={() => setExamAnswers(a => ({ ...a, [q.id]: letter }))}
                                className={cn(
                                  "w-full flex items-center gap-2 text-left p-3 rounded-xl border font-bold text-[13px] text-ink transition-colors disabled:cursor-default",
                                  chosen ? "bg-brand-soft border-brand" : "bg-paper border-line",
                                )}
                              >
                                <span className="flex-1">{opt}</span>
                                {chosen && <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={handleSubmitExam}
                      disabled={submitFinalExam.isPending || !exam.questions.every(q => examAnswers[q.id])}
                      className="w-full h-11 rounded-xl font-bold bg-brand hover:bg-brand/90 text-paper mt-4 disabled:opacity-60"
                    >
                      {submitFinalExam.isPending
                        ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Submitting…</>
                        : "Submit exam"}
                    </Button>
                    {!exam.questions.every(q => examAnswers[q.id]) && (
                      <p className="text-[13px] font-bold text-ink-muted text-center mt-2">Answer all {exam.questions.length} questions to submit.</p>
                    )}
                    {certError && <p className="text-[13px] font-bold text-danger text-center mt-3">{certError}</p>}
                  </div>
                ) : (
                  /* Generate state */
                  <div className="rounded-2xl bg-paper shadow-soft p-6 text-center">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-line">
                      <Trophy className="w-8 h-8 text-ink" />
                    </div>
                    <h2 className="text-display text-xl font-extrabold text-ink mb-1">Final exam</h2>
                    <p className="text-sm text-ink-muted mb-5">
                      You passed all {totalModules} module quizzes. Score 70% or higher to earn your certificate. Unlimited retakes.
                    </p>
                    <Button
                      onClick={handleGenerateExam}
                      disabled={generateFinalExam.isPending}
                      className="w-full h-11 rounded-xl font-bold bg-brand hover:bg-brand/90 text-paper disabled:opacity-60"
                    >
                      {generateFinalExam.isPending
                        ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generating…</>
                        : <>Generate exam <ChevronRight className="w-4 h-4 ml-1" /></>}
                    </Button>
                    {certError && <p className="text-[13px] font-bold text-danger mt-3">{certError}</p>}
                  </div>
                )
              )}

              {/* ── INTERVIEW STEP: exam passed, certificate interview not yet linked ── */}
              {allModulesPassed && !bothGatesPassed && examPassed && (
                <div className="rounded-2xl bg-paper shadow-soft p-6 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    <CheckCircle2 className="w-4 h-4 text-done" />
                    <p className="text-[13px] font-extrabold text-done">Final exam passed</p>
                  </div>
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-line">
                    <Mic className="w-7 h-7 text-ink" />
                  </div>
                  <h2 className="text-display text-xl font-extrabold text-ink mb-1">Certificate interview</h2>
                  <p className="text-sm text-ink-muted mb-5">
                    One last step: pass an AI mock interview with a score of 60 or higher to earn your certificate.
                  </p>
                  {linkingInterview && (
                    <div className="flex items-center justify-center gap-2 text-[13px] font-bold text-ink-muted mb-4">
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking your interview…
                    </div>
                  )}
                  {certInterviewResult && !certInterviewResult.passed && (
                    <p className="text-[13px] font-bold text-danger mb-4">
                      Your interview scored {certInterviewResult.overallScore}. You need 60 or higher — give it another try.
                    </p>
                  )}
                  <Button
                    onClick={handleStartCertInterview}
                    disabled={createInterview.isPending || linkingInterview}
                    className="w-full h-11 rounded-xl font-bold bg-brand hover:bg-brand/90 text-paper disabled:opacity-60"
                  >
                    {createInterview.isPending
                      ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Starting…</>
                      : <><Mic className="w-4 h-4 mr-1.5" /> {certInterviewResult && !certInterviewResult.passed ? "Retry interview" : "Start certificate interview"}</>}
                  </Button>
                  {certError && <p className="text-[13px] font-bold text-danger mt-3">{certError}</p>}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
