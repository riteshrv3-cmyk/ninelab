import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronRight, ArrowLeft, ChevronDown, PlayCircle } from "lucide-react";
import { useListCourses } from "@workspace/api-client-react";
import { DOMAINS, type Domain, type SubDomain } from "@/data/domains";
import { cn } from "@/lib/utils";
import { useStudentId } from "@/hooks/useStudentId";
import { useNameGate } from "@/components/NameGate";
import { DemoSurface } from "@/components/DemoBanner";
import { DEMO_ENROLLMENT, DEMO_PROFILE, DEMO_STUDENT_NAME } from "@/data/demoStudent";

// Every course in the library is 5 modules x 3 lessons.
const LESSONS_PER_COURSE = 15;

/** Same collapse rule as Opportunities — 2 rows of 3 before the toggle. */
const DOMAIN_PREVIEW_COUNT = 6;

/**
 * The course Priya is mid-way through. `data/demoStudent.ts` describes it in
 * prose ("React Development" / "Frontend Engineering") but carries no taxonomy
 * id, so it is pinned to the real `webdev` › `frontend` course here — that is
 * the course her targetRole ("Frontend Developer") maps to, and it is what
 * Continue must open for the card to be honest about where it goes.
 */
const DEMO_COURSE_SUB_ID = "frontend";

/**
 * Tracks a frontend student advances into next. Hand-picked: the taxonomy in
 * `data/domains.ts` has no "what comes after this" edge to derive from, and the
 * alphabetical siblings of `frontend` (WordPress/CMS et al) are not a
 * recommendation anyone would stand behind.
 */
const RECOMMENDED_SUB_IDS = ["fullstack", "web-perf", "design-systems"];

function findSub(subId: string): { domain: Domain; sub: SubDomain } | null {
  for (const domain of DOMAINS) {
    const sub = domain.subDomains.find(s => s.id === subId);
    if (sub) return { domain, sub };
  }
  return null;
}

export default function CourseLibrary() {
  const [, setLocation] = useLocation();
  const reduce = useReducedMotion();
  const { isDemo } = useStudentId();
  const { requireStudent } = useNameGate();
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  // Continue chips: match in_progress enrollments to subdomain cards by
  // subDomainId. studentId absent or the request failing must not crash the
  // page — the enabled guard keeps the query idle, and `data` stays undefined.
  const rawId =
    typeof window !== "undefined" ? localStorage.getItem("studentId") : null;
  const studentId = rawId != null ? Number(rawId) : NaN;
  const hasStudent = Number.isFinite(studentId);
  const { data: enrollments } = useListCourses(studentId, {
    query: { enabled: hasStudent } as any,
  });

  const inProgressSubIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of enrollments ?? []) {
      if (e.status === "in_progress") set.add(e.subDomainId);
    }
    return set;
  }, [enrollments]);

  const [showAllDomains, setShowAllDomains] = useState(false);
  const visibleDomains = showAllDomains ? DOMAINS : DOMAINS.slice(0, DOMAIN_PREVIEW_COUNT);

  /**
   * The one course to resume, first on the page. Explore mode gets Priya's
   * sample enrollment; a real student gets their own most recently touched
   * in-progress course (progress derived from completed lessons, since the
   * enrollment row carries the ids, not a percentage). Null when there is
   * nothing to continue — the section is then simply absent.
   */
  const continueCourse = useMemo(() => {
    if (isDemo) {
      const dest = findSub(DEMO_COURSE_SUB_ID);
      if (!dest) return null;
      return {
        dest,
        title: DEMO_ENROLLMENT.subDomainName,
        subtitle: DEMO_ENROLLMENT.domainName,
        pct: DEMO_ENROLLMENT.progressPct,
        detail: `${DEMO_ENROLLMENT.completedModules} of ${DEMO_ENROLLMENT.totalModules} modules done`,
      };
    }
    const live = (enrollments ?? [])
      .filter(e => e.status === "in_progress")
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
    if (!live) return null;
    const dest = findSub(live.subDomainId);
    if (!dest) return null;
    const done = live.completedLessonIds?.length ?? 0;
    return {
      dest,
      title: live.subDomainName,
      subtitle: live.domainName,
      pct: Math.min(100, Math.round((done / LESSONS_PER_COURSE) * 100)),
      detail: `${done} of ${LESSONS_PER_COURSE} lessons done`,
    };
  }, [isDemo, enrollments]);

  const recommended = useMemo(
    () =>
      RECOMMENDED_SUB_IDS.map(findSub).filter(
        (r): r is { domain: Domain; sub: SubDomain } =>
          r !== null && r.sub.id !== continueCourse?.dest.sub.id,
      ),
    [continueCourse],
  );

  const openCourse = (domain: Domain, sub: SubDomain) => {
    // Starting a course is the first real action for an anonymous visitor —
    // route it through the NameGate, which creates a guest row then runs this.
    requireStudent(
      () => {
        // EXACT 6-field shape written by Opportunities.navigateToCourse.
        // domainEmoji dropped — domains.ts now carries a lucide icon rather
        // than a glyph, and Course.tsx's CourseContext.domainEmoji is optional.
        sessionStorage.setItem(
          "courseContext",
          JSON.stringify({
            subDomainId: sub.id,
            subDomainName: sub.name,
            domainName: domain.name,
            domainColor: domain.color,
            domainBg: domain.bg,
            skills: sub.skills,
          }),
        );
        setLocation("/opportunities/course");
      },
      { title: "Starting this course" },
    );
  };

  return (
    <div className="pb-28 min-h-screen bg-canvas">
      {/* Canopy header */}
      <div className="bg-brand px-4 pt-6 pb-10">
        <div className="max-w-md lg:max-w-2xl mx-auto">
          {selectedDomain && (
            <button
              onClick={() => setSelectedDomain(null)}
              className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-[12px] font-bold text-white uppercase tracking-wider"
              data-testid="button-course-library-back"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All domains
            </button>
          )}
          <h1 className="text-display text-2xl font-extrabold text-white">
            Course library
          </h1>
          <p className="text-sm text-white/70 mt-1">
            Learn the skills your target role needs — free, at your pace.
          </p>
        </div>
      </div>

      {/* Sheet */}
      <div className="bg-paper rounded-t-3xl -mt-6 min-h-[60vh]">
        <div className="p-4 pt-6 max-w-md lg:max-w-2xl mx-auto">
          {isDemo && <DemoSurface className="mb-4">{null}</DemoSurface>}
          <AnimatePresence mode="wait">
            {!selectedDomain ? (
              <motion.div
                key="domains"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
              >
                {/* 1 — the one thing to resume, before any browsing decision. */}
                {continueCourse && (
                  <div className="mb-6" data-testid="card-continue-course">
                    <p className="text-[12px] font-bold text-ink-muted uppercase tracking-wider mb-2 px-1">
                      {isDemo
                        ? `${DEMO_STUDENT_NAME.split(" ")[0]}'s course in progress`
                        : "Continue where you left off"}
                    </p>
                    <div className="bg-paper rounded-2xl shadow-soft p-4">
                      <div className="flex items-start gap-3">
                        <span className="w-11 h-11 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
                          <continueCourse.dest.domain.icon
                            className="w-5 h-5 text-brand"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-extrabold text-ink leading-tight truncate">
                            {continueCourse.title}
                          </p>
                          <p className="text-[13px] text-ink-muted truncate">
                            {continueCourse.subtitle} · {continueCourse.detail}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-semibold text-ink-muted">Progress</span>
                          <span className="text-[13px] font-semibold text-ink-muted tabular-nums">
                            {continueCourse.pct}%
                          </span>
                        </div>
                        <div
                          className="h-1.5 rounded-full bg-line overflow-hidden"
                          role="progressbar"
                          aria-valuenow={continueCourse.pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${continueCourse.title} progress`}
                        >
                          <div
                            className="h-full bg-brand rounded-full transition-all"
                            style={{ width: `${continueCourse.pct}%` }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openCourse(continueCourse.dest.domain, continueCourse.dest.sub)
                        }
                        className="mt-4 w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand text-white font-bold text-[13px]"
                        data-testid="button-continue-course"
                      >
                        <PlayCircle className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {/* 2 — three tracks to go to next, named for the role. */}
                {recommended.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[12px] font-bold text-ink-muted uppercase tracking-wider mb-2 px-1">
                      {isDemo
                        ? `Recommended for ${DEMO_PROFILE.targetRole}`
                        : "Recommended next"}
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {recommended.map(({ domain, sub }, i) => (
                        <motion.button
                          key={sub.id}
                          initial={reduce ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={reduce ? undefined : { delay: i * 0.06 }}
                          whileTap={reduce ? undefined : { scale: 0.98 }}
                          onClick={() => openCourse(domain, sub)}
                          className="w-full bg-paper rounded-2xl shadow-soft p-4 flex items-center gap-3 text-left"
                          data-testid={`card-recommended-${sub.id}`}
                        >
                          <span className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
                            <domain.icon className="w-5 h-5 text-brand" strokeWidth={1.75} aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-bold text-ink leading-tight line-clamp-2">
                              {sub.name}
                            </p>
                            <p className="text-[13px] text-ink-muted line-clamp-1">
                              {domain.name} · {LESSONS_PER_COURSE} lessons
                            </p>
                          </div>
                          {/* The 3-up desktop column is too narrow to spare the
                              affordance width; the whole card is the target. */}
                          <ChevronRight className="w-4 h-4 text-ink-muted shrink-0 lg:hidden" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3 — the full taxonomy, collapsed. */}
                <p className="text-[12px] font-bold text-ink-muted uppercase tracking-wider mb-2 px-1">
                  Explore {DOMAINS.length} domains
                </p>
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                  {visibleDomains.map((domain, i) => (
                    <motion.button
                      key={domain.id}
                      initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={reduce ? undefined : { delay: Math.min(i, DOMAIN_PREVIEW_COUNT) * 0.04 }}
                      whileTap={reduce ? undefined : { scale: 0.94 }}
                      onClick={() => setSelectedDomain(domain)}
                      className="rounded-2xl p-3 flex flex-col items-center text-center gap-1.5 bg-brand-soft transition-colors"
                      data-testid={`card-domain-${domain.id}`}
                    >
                      <domain.icon className="w-6 h-6 text-brand" strokeWidth={1.75} aria-hidden />
                      <span className="text-[13px] font-bold leading-tight text-brand">
                        {domain.name}
                      </span>
                    </motion.button>
                  ))}
                </div>

                {DOMAINS.length > DOMAIN_PREVIEW_COUNT && (
                  <button
                    type="button"
                    onClick={() => setShowAllDomains(v => !v)}
                    aria-expanded={showAllDomains}
                    className="mt-3 mx-auto flex items-center gap-1.5 rounded-full bg-paper text-brand border border-line px-5 py-2.5 text-[13px] font-bold"
                    data-testid="button-toggle-domains"
                  >
                    {showAllDomains ? "Show fewer" : `Show all ${DOMAINS.length} domains`}
                    <ChevronDown
                      className={cn("w-4 h-4 transition-transform", showAllDomains && "rotate-180")}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="subdomains"
                initial={reduce ? false : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: 20 }}
                className="space-y-2"
              >
                {/* Domain banner */}
                <div className="rounded-2xl bg-canvas p-4 mb-4 flex items-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-brand-soft flex items-center justify-center shrink-0">
                    <selectedDomain.icon className="w-6 h-6 text-brand" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div>
                    <p className="text-[12px] font-bold text-ink-muted uppercase tracking-wider">
                      Domain
                    </p>
                    <p className="text-[18px] font-extrabold text-ink">
                      {selectedDomain.name}
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      {selectedDomain.subDomains.length} specialisations
                    </p>
                  </div>
                </div>

                {selectedDomain.subDomains.map((sd, i) => {
                  const inProgress = inProgressSubIds.has(sd.id);
                  return (
                    <motion.button
                      key={sd.id}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reduce ? undefined : { delay: i * 0.06 }}
                      whileTap={reduce ? undefined : { scale: 0.97 }}
                      onClick={() => openCourse(selectedDomain, sd)}
                      className="w-full bg-canvas rounded-2xl p-4 flex items-center justify-between text-left"
                      data-testid={`card-subdomain-${sd.id}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-ink text-[15px]">
                            {sd.name}
                          </p>
                          {inProgress && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand text-white uppercase tracking-wider">
                              Continue
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {sd.skills.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-line text-ink-muted"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                        <p className="text-[13px] text-ink-muted mt-1.5">
                          {LESSONS_PER_COURSE} lessons
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full border border-line flex items-center justify-center flex-shrink-0 ml-3">
                        <ChevronRight className="w-4 h-4 text-ink" />
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
