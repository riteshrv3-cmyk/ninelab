import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Download, Share2, Pencil, FileText, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { DemoSurface } from "@/components/DemoBanner";
import { scoreBadgeClass } from "@/lib/scoreTone";
import { DEMO_RESUMES } from "@/data/demoStudent";

// Read-only explore-mode view of the resume feature for anonymous visitors
// (no localStorage.studentId). Renders PURELY from fixtures — it never touches
// an authed /students/:id endpoint, so it can't trigger the 401 localStorage
// wipe. Every button funnels to `onStart`, which routes the first real action
// through the NameGate up in Resume.tsx.

export default function ResumeDemo({ onStart }: { onStart: () => void }) {
  const reduce = useReducedMotion();
  const demo = DEMO_RESUMES[0];

  return (
    <div className="min-h-screen bg-canvas">
      <PageHeader
        title="My Resumes"
        subtitle="AI-generated from your real profile · ATS-friendly"
        right={
          <motion.div whileTap={reduce ? undefined : { scale: 0.96 }}>
            <Button
              onClick={onStart}
              className="rounded-full bg-white/15 text-white hover:bg-white/25 font-bold px-4 h-10"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Build
            </Button>
          </motion.div>
        }
      />

      {/* Sheet */}
      <div className="bg-canvas rounded-t-3xl -mt-6 min-h-[60vh] pb-28">
        <div className="p-4 pt-6 max-w-md lg:max-w-2xl mx-auto space-y-5">
          {/* DemoSurface renders the explore banner once and auto-suppresses
              any descendant SampleChips — one demo signal per surface. */}
          <DemoSurface>
            <div className="space-y-3">
              <p className="type-micro font-bold text-ink-muted uppercase tracking-wider">Sample Resume</p>

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                className="bg-paper rounded-2xl shadow-soft p-4 space-y-3"
              >
                {/* Header row: title + ATS badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink type-body">{demo.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="type-micro text-ink-muted font-medium flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {demo.targetRole}
                      </span>
                      <span className="type-micro text-ink-muted">{demo.updatedLabel}</span>
                    </div>
                  </div>
                  <span className={`type-micro font-bold px-2 py-0.5 rounded-full shrink-0 ${scoreBadgeClass(demo.atsScore)}`}>
                    ATS match {demo.atsScore}%
                  </span>
                </div>

                {/* How caption — quietly sells the action that produced this */}
                <p className="type-micro text-ink-muted italic leading-snug">{demo.howCaption}</p>

                {/* Headline + summary */}
                <div className="space-y-1.5 pt-1">
                  <p className="type-caption font-bold text-ink">{demo.headline}</p>
                  <p className="type-caption text-ink-muted">{demo.summary}</p>
                </div>

                {/* Highlights */}
                <div className="space-y-2 pt-1">
                  <p className="type-micro font-bold text-ink-muted uppercase tracking-wider">Highlights</p>
                  <ul className="space-y-1.5">
                    {demo.highlights.map((h, i) => (
                      <li key={i} className="flex gap-2 type-caption text-ink">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-brand shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions — all funnel to onStart */}
                <div className="flex gap-2 flex-wrap pt-2">
                  <Button
                    onClick={onStart}
                    variant="outline"
                    className="flex-1 h-9 rounded-full font-bold text-xs border border-line text-brand"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    onClick={onStart}
                    className="flex-1 h-9 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    PDF
                  </Button>
                  <Button
                    onClick={onStart}
                    variant="outline"
                    className="flex-1 h-9 rounded-full font-bold text-xs border border-line text-ink-muted"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    DOCX
                  </Button>
                  <Button
                    onClick={onStart}
                    variant="outline"
                    className="h-9 w-9 rounded-full border border-line text-ink-muted flex items-center justify-center shrink-0"
                    title="Share"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            </div>

            {/* Primary CTA */}
            <motion.div whileTap={reduce ? undefined : { scale: 0.98 }}>
              <Button
                onClick={onStart}
                className="w-full h-12 rounded-full bg-brand text-white hover:bg-brand/90 font-bold type-body"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Build my resume
              </Button>
            </motion.div>
            <p className="text-center type-caption text-ink-muted -mt-2">
              Built from your GitHub and a job post — yours in minutes.
            </p>
          </DemoSurface>
        </div>
      </div>
    </div>
  );
}
