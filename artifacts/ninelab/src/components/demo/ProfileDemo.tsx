import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Github, Target, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoSurface } from "@/components/DemoBanner";
import { DEMO_PROFILE } from "@/data/demoStudent";

// Read-only explore-mode view of the profile for anonymous visitors (no
// localStorage.studentId). Renders PURELY from the DEMO_PROFILE fixture — it
// never touches an authed /students/:id endpoint, so it can't trigger the 401
// localStorage wipe. The single primary button funnels to `onStart`, which
// routes the first real action through the NameGate up in Profile.tsx.

export default function ProfileDemo({ onStart }: { onStart: () => void }) {
  const reduce = useReducedMotion();
  const p = DEMO_PROFILE;
  const initials = p.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Skills render on the same 0-100 scale the real profile uses, top-first so
  // it reads like a real, lumpy ledger rather than a flat list.
  const skills = Object.entries(p.skills).sort(([, a], [, b]) => b - a);

  return (
    <div className="pb-28 max-w-md lg:max-w-none mx-auto min-h-screen bg-canvas">
      {/* ── Canopy header (mirrors Profile.tsx) ── */}
      <div className="relative bg-brand pt-8 pb-10 px-6">
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center text-[24px] font-extrabold text-white">
            {initials}
          </div>
        </div>

        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Sample profile
          </span>
        </div>

        <h1 className="text-display text-[30px] lg:text-[36px] font-extrabold text-white leading-[1.06] tracking-tight mt-3">
          {p.name}
        </h1>
        <p className="text-[12px] text-white/70 mt-1">{p.college}</p>
        <p className="text-[12px] text-white/70 mt-0.5">
          {p.field} · Year {p.year} · {p.city}
        </p>
      </div>

      {/* ── Sheet ── one demo signal per surface: the canopy SAMPLE PROFILE
          chip plus the single banner DemoSurface renders here. */}
      <div className="relative bg-canvas -mt-6 rounded-t-3xl pt-6 space-y-4">
        <DemoSurface className="mx-4">
        <div className="px-4 space-y-4">
          {/* Target role */}
          <div className="bg-paper rounded-2xl shadow-soft p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="type-body font-bold text-ink flex items-center gap-2">
                <Target className="w-4 h-4 text-ink" /> Target role
              </h3>
            </div>
            <p className="text-[18px] font-extrabold text-ink">{p.targetRole}</p>
            <p className="text-[12px] text-ink-muted mt-0.5">
              Batch of {p.targetBatch} · {p.githubUrl}
            </p>
          </div>

          {/* Skills as labeled 0-100 bars, rendered as "N%" */}
          <div className="bg-paper rounded-2xl shadow-soft p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="type-body font-bold text-ink flex items-center gap-2">
                <Code2 className="w-4 h-4 text-ink" /> Skills
              </h3>
            </div>
            <div className="space-y-3">
              {skills.map(([name, value], i) => (
                <motion.div
                  key={name}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  transition={reduce ? undefined : { delay: i * 0.04 }}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[13px] font-semibold text-ink">{name}</span>
                    <span className="text-[12px] font-bold text-ink-muted tabular-nums">
                      {value}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-line overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* GitHub teaser row */}
          <div className="bg-paper rounded-2xl shadow-soft p-5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-soft flex items-center justify-center text-brand shrink-0">
              <Github className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-ink">Built from her GitHub</p>
              <p className="text-[12px] text-ink-muted">
                Projects, skills and scores fill in automatically once you connect yours.
              </p>
            </div>
          </div>

          {/* Primary CTA */}
          <motion.div whileTap={reduce ? undefined : { scale: 0.98 }}>
            <Button
              onClick={onStart}
              className="w-full h-12 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-[15px]"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start my own profile
            </Button>
          </motion.div>
          <p className="text-center text-[12px] text-ink-muted -mt-2">
            Add your GitHub or a resume — your profile builds itself.
          </p>
        </div>
        </DemoSurface>
      </div>
    </div>
  );
}
