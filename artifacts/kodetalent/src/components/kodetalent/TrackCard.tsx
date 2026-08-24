import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { useStudentTrack } from "@/hooks/useStudentTrack";

/**
 * Home dashboard card: the student's track progress + readiness at a glance.
 * Links to the full /track view. Renders nothing until a track resolves (a
 * brand-new student before the default track seeds) so Home degrades cleanly.
 */
export function TrackCard({ studentId }: { studentId: string | null }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useStudentTrack(studentId);

  if (isLoading) {
    return <div className="h-[104px] rounded-2xl bg-paper shadow-soft animate-pulse mb-4" />;
  }
  if (!data || !data.track) return null;

  const { track, done, total, readiness, milestones } = data;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const next = milestones.find((m) => !m.done);
  const readinessColor =
    readiness.score >= 60 ? "text-emerald-600" : readiness.score >= 35 ? "text-amber-600" : "text-rose-600";

  return (
    <button
      type="button"
      onClick={() => setLocation("/track")}
      className="w-full text-left bg-paper rounded-2xl shadow-soft p-4 mb-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Your track</p>
          <p className="text-[15px] font-extrabold text-ink leading-tight truncate">{track.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Readiness</p>
          <p className={`text-[20px] font-extrabold tabular-nums leading-none ${readinessColor}`}>{readiness.score}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-ink-muted">{done} of {total} milestones</span>
          <span className="text-[11px] font-semibold text-ink-muted tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-canvas overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {next && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[12px] text-ink-muted truncate">Next: <span className="font-semibold text-ink">{next.title}</span></span>
          <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
        </div>
      )}
    </button>
  );
}
