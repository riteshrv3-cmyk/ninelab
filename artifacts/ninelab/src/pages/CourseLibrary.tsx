import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { useListCourses } from "@workspace/api-client-react";
import { DOMAINS, type Domain, type SubDomain } from "@/data/domains";
import { useStudentId } from "@/hooks/useStudentId";
import { useNameGate } from "@/components/NameGate";
import { DemoSurface } from "@/components/DemoBanner";
import { DEMO_ENROLLMENT, DEMO_STUDENT_NAME } from "@/data/demoStudent";

// Every course in the library is 5 modules x 3 lessons.
const LESSONS_PER_COURSE = 15;

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

  const openCourse = (domain: Domain, sub: SubDomain) => {
    // Starting a course is the first real action for an anonymous visitor —
    // route it through the NameGate, which creates a guest row then runs this.
    requireStudent(
      () => {
        // EXACT 7-field shape written by Opportunities.navigateToCourse.
        sessionStorage.setItem(
          "courseContext",
          JSON.stringify({
            subDomainId: sub.id,
            subDomainName: sub.name,
            domainName: domain.name,
            domainColor: domain.color,
            domainBg: domain.bg,
            domainEmoji: domain.emoji,
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
              className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-[11px] font-bold text-white uppercase tracking-wider"
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
          {isDemo && (
            <div className="mb-4">
              <DemoSurface className="mb-2">
                {/* Honest caption, not a pill — this is a state line, not an
                    affordance. */}
                <p className="type-caption text-ink-muted px-1">
                  Sample — {DEMO_STUDENT_NAME.split(" ")[0]}'s progress:{" "}
                  {DEMO_ENROLLMENT.subDomainName} · {DEMO_ENROLLMENT.progressPct}%
                </p>
              </DemoSurface>
            </div>
          )}
          <AnimatePresence mode="wait">
            {!selectedDomain ? (
              <motion.div
                key="domains"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
              >
                <p className="text-[12px] font-bold text-ink-muted uppercase tracking-wider mb-3 px-1">
                  Explore {DOMAINS.length} domains
                </p>
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                  {DOMAINS.map((domain, i) => (
                    <motion.button
                      key={domain.id}
                      initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={reduce ? undefined : { delay: i * 0.04 }}
                      whileTap={reduce ? undefined : { scale: 0.94 }}
                      onClick={() => setSelectedDomain(domain)}
                      className="rounded-2xl p-3 flex flex-col items-center text-center gap-1.5 bg-brand-soft transition-colors"
                      data-testid={`card-domain-${domain.id}`}
                    >
                      <span className="text-3xl">{domain.emoji}</span>
                      <span className="text-[11px] font-bold leading-tight text-brand">
                        {domain.name}
                      </span>
                    </motion.button>
                  ))}
                </div>
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
                  <span className="text-4xl">{selectedDomain.emoji}</span>
                  <div>
                    <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                      Domain
                    </p>
                    <p className="text-[18px] font-extrabold text-ink">
                      {selectedDomain.name}
                    </p>
                    <p className="text-[12px] text-ink-muted">
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
                        <p className="text-[11px] text-ink-muted mt-1.5">
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
