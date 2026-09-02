import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import { Toko } from "@/components/ninelab/Toko";
import { TaskRow } from "@/components/ninelab/TaskRow";
import { TrackCard } from "@/components/ninelab/TrackCard";
import { Confetti } from "@/components/ninelab/Confetti";
import { useTodayTasks } from "@/hooks/useTodayTasks";
import { useStudentProfile } from "@/hooks/useStudentProfile";

const XP_PER_LEVEL = 500;

export default function Home() {
  const [, setLocation] = useLocation();
  const [studentId, setStudentId] = useState<string | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const id = localStorage.getItem("studentId");
    if (!id) {
      setLocation("/");
      return;
    }
    setStudentId(id);
  }, [setLocation]);

  const { data: profile } = useStudentProfile(studentId);
  const { tasks, toggleManual, streakCount, xp, level, noticing, isLoading, isError } = useTodayTasks({ studentId });

  const firstName = profile?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  // Late-night study sessions are the norm for this audience, and the old
  // three-band split greeted someone at 2am with "good morning".
  const greeting =
    hour < 5 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "night";
  const goal = profile?.targetRole
    ? `${profile.targetRole}${profile.targetBatch ? ` · Batch ${profile.targetBatch}` : ""}`
    : profile?.field && profile.field !== "Not set"
      ? `${profile.field}${profile.year ? ` · Year ${profile.year}` : ""}`
      : null;

  const allDone = tasks.length > 0 && tasks.every((t) => t.done);
  const xpIntoLevel = xp % XP_PER_LEVEL;

  // Celebrate a streak bump or clearing the whole list — not on first load
  // (an existing streak/finished list arriving from the server is not a new
  // accomplishment), and not repeatedly while already-done tasks sit on
  // screen. `null` is the "haven't seen real data yet" sentinel: the first
  // successful load only records a baseline, it never fires confetti.
  const prevStreak = useRef<number | null>(null);
  const prevAllDone = useRef<boolean | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Before `studentId` loads from localStorage, useTodayTasks's query is
    // disabled — isLoading reads false with no real data yet, not true. Gate
    // on studentId too, or that premature render sets a false 0 baseline and
    // the real data arriving right after reads as "streak just grew".
    if (isLoading || !studentId) return undefined;

    const hasBaseline = prevStreak.current !== null;
    const streakGrew = hasBaseline && streakCount > (prevStreak.current as number);
    const justFinished = hasBaseline && allDone && !prevAllDone.current;
    prevStreak.current = streakCount;
    prevAllDone.current = allDone;

    if (streakGrew || justFinished) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [streakCount, allDone, isLoading]);

  return (
    <div className="min-h-screen bg-canvas pb-24">
      <div className="bg-brand px-6 pt-8 pb-14">
        <div className="lg:max-w-2xl lg:mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wider text-white/70">Good {greeting}</p>
              <h1
                className="text-[34px] font-extrabold text-white leading-[1.04] tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {firstName}.
              </h1>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 mt-1">
              <Toko size={22} />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            {goal && <span className="text-[13px] text-white/70">{goal}</span>}
            {streakCount > 0 && (
              <>
                {goal && <span className="text-white/40">·</span>}
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-white">
                  <Flame className="w-3.5 h-3.5 text-highlight" fill="currentColor" />
                  {streakCount} day{streakCount === 1 ? "" : "s"} in a row
                </span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/50">Level {level}</span>
            <span className="text-[13px] font-semibold text-white/50 tabular-nums">{xpIntoLevel} / {XP_PER_LEVEL} xp</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${(xpIntoLevel / XP_PER_LEVEL) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* The sheet spans the canopy, not the reading column. Clamping the
          sheet itself to lg:max-w-2xl left 144px of bare indigo standing proud
          on each side of its rounded top on desktop — the canopy's flat bottom
          edge showing past the curve that exists to hide it. Content stays at
          2xl via the inner wrapper. */}
      <div className="bg-canvas rounded-t-3xl -mt-6 px-6 pt-6">
        <div className="lg:max-w-2xl lg:mx-auto">
          {isError && (
            <div className="bg-paper rounded-2xl shadow-soft p-4 mb-4">
              <p className="text-[14px] font-bold text-danger">Couldn't load today's tasks</p>
              <p className="text-[13px] text-ink-muted mt-1">Pull down to try again, or check back shortly.</p>
            </div>
          )}

          {isLoading && !isError && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[72px] rounded-2xl bg-paper shadow-soft animate-pulse" />
              ))}
            </div>
          )}

          {!isError && <TrackCard studentId={studentId} />}

          {!isLoading && !isError && noticing && (
            <div className="bg-brand-soft rounded-2xl p-4 mb-4">
              <button
                type="button"
                onClick={() => setLocation(noticing.href)}
                className="w-full flex items-start gap-3 text-left"
              >
                <div className="w-8 h-8 rounded-full bg-toko flex items-center justify-center shrink-0">
                  <Toko size={20} />
                </div>
                <p className="text-[13px] font-medium text-ink leading-snug pt-1">{noticing.text}</p>
              </button>
              <button
                type="button"
                onClick={() => setLocation("/notebook")}
                className="text-[13px] font-bold text-brand mt-2 ml-11"
              >
                See everything Toko has noticed →
              </button>
            </div>
          )}

          {!isLoading && !isError && tasks.length === 0 && (
            <div className="py-12 flex flex-col items-center text-center">
              <Toko pose="shrug" size={64} className="mb-3" />
              <p className="text-[14px] text-ink">Nothing lined up for today yet.</p>
              <button
                type="button"
                onClick={() => setLocation("/practice")}
                className="text-[13px] font-bold text-brand mt-1"
              >
                Head to Prep to get started →
              </button>
            </div>
          )}

          {!isLoading &&
            !isError &&
            tasks.map((task, i) => (
              <motion.div
                key={task.id}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
              >
                <TaskRow
                  label={task.label}
                  sublabel={task.sublabel}
                  done={task.done}
                  hot={task.hot}
                  ctaLabel={task.ctaLabel}
                  onToggle={task.manual ? () => toggleManual(task.id) : undefined}
                  onAction={() => setLocation(task.href)}
                />
              </motion.div>
            ))}

          {!isLoading && !isError && allDone && (
            <div className="py-8 flex flex-col items-center text-center">
              <Toko pose="cheer" size={72} className="mb-2" />
              <p className="text-[14px] font-bold text-ink">All done for today.</p>
              <p className="text-[13px] text-ink-muted mt-0.5">Come back tomorrow to keep the streak going.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>{showConfetti && <Confetti key="confetti" />}</AnimatePresence>
    </div>
  );
}
