import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Check, ChevronRight } from "lucide-react";
import { useStudentTrack, type ReadinessBreakdown } from "@/hooks/useStudentTrack";

const BREAKDOWN_LABELS: { key: keyof ReadinessBreakdown; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "skills", label: "Skills" },
  { key: "track", label: "Track" },
  { key: "mocks", label: "Mock interviews" },
];

export default function TrackView() {
  const [, setLocation] = useLocation();
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("studentId");
    if (!id) {
      setLocation("/");
      return;
    }
    setStudentId(id);
  }, [setLocation]);

  const { data, isLoading, isError } = useStudentTrack(studentId);

  return (
    <div className="min-h-screen bg-canvas pb-24">
      <div className="bg-brand px-6 pt-8 pb-14">
        <div className="lg:max-w-2xl lg:mx-auto">
          <p className="text-[12px] font-medium uppercase tracking-wider text-white/70">Your learning track</p>
          <h1 className="text-[28px] font-extrabold text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {data?.track?.name ?? "Track"}
          </h1>
          {data?.track?.description && (
            <p className="text-[13px] text-white/80 mt-1 leading-snug">{data.track.description}</p>
          )}
        </div>
      </div>

      <div className="bg-canvas rounded-t-3xl -mt-6 px-6 pt-6">
        <div className="lg:max-w-2xl lg:mx-auto">
          {isLoading && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[64px] rounded-2xl bg-paper shadow-soft animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <div className="bg-paper rounded-2xl shadow-soft p-4">
              <p className="text-[14px] font-bold text-danger">Couldn't load your track</p>
            </div>
          )}

          {!isLoading && !isError && data && !data.track && (
            <div className="py-12 text-center">
              <p className="text-[14px] text-ink">No track assigned yet.</p>
              <p className="text-[13px] text-ink-muted mt-1">Join your college to get a curated track, or keep building your profile.</p>
            </div>
          )}

          {!isLoading && !isError && data?.track && (
            <>
              {/* Readiness breakdown */}
              <div className="bg-paper rounded-2xl shadow-soft p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-bold text-ink">Readiness score</p>
                  <p className="text-[22px] font-extrabold text-brand tabular-nums leading-none">{data.readiness.score}</p>
                </div>
                <div className="space-y-2">
                  {BREAKDOWN_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-[13px] text-ink-muted w-28 shrink-0">{label}</span>
                      <div className="h-1.5 rounded-full bg-canvas overflow-hidden flex-1">
                        <div className="h-full bg-brand rounded-full" style={{ width: `${data.readiness.breakdown[key]}%` }} />
                      </div>
                      <span className="text-[13px] font-semibold text-ink-muted tabular-nums w-8 text-right">
                        {data.readiness.breakdown[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-bold text-ink">Milestones</p>
                <p className="text-[13px] font-semibold text-ink-muted">{data.done} of {data.total} done</p>
              </div>

              <div className="space-y-2.5">
                {data.milestones.map((m) => {
                  const isNext = !m.done && data.milestones.find((x) => !x.done)?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-2xl p-4 flex items-center gap-3 ${
                        isNext ? "bg-brand-soft ring-1 ring-brand/20" : "bg-paper shadow-soft"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          m.done ? "bg-emerald-500 text-white" : "border-2 border-line text-transparent"
                        }`}
                      >
                        <Check className="w-4 h-4" strokeWidth={3} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-bold leading-tight ${m.done ? "text-ink-muted line-through" : "text-ink"}`}>
                          {m.title}
                        </p>
                        {m.description && <p className="text-[13px] text-ink-muted mt-0.5 leading-snug">{m.description}</p>}
                      </div>
                      {!m.done && (
                        <button
                          type="button"
                          onClick={() => setLocation(m.href)}
                          className="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-bold text-brand"
                        >
                          Go <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
