import { useLocation } from "wouter";
import { ArrowLeft, Check } from "lucide-react";
import { useTpoStudent } from "@/hooks/useTpo";

const BREAKDOWN: { key: "profile" | "skills" | "track" | "mocks"; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "skills", label: "Skills" },
  { key: "track", label: "Track" },
  { key: "mocks", label: "Mock interviews" },
];

export default function TpoStudentDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useTpoStudent(id);

  if (isLoading) return <div className="h-[400px] rounded-2xl bg-paper shadow-soft animate-pulse" />;
  if (isError || !data) {
    return (
      <div>
        <button type="button" onClick={() => setLocation("/")} className="inline-flex items-center gap-1 text-[13px] font-bold text-brand mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-paper rounded-2xl shadow-soft p-6 text-center text-[14px] text-danger">Student not found.</div>
      </div>
    );
  }

  const { student, readiness, track, mockHistory } = data;
  const maxScore = Math.max(100, ...mockHistory.map((m) => m.overallScore));

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => setLocation("/")} className="inline-flex items-center gap-1 text-[13px] font-bold text-brand">
        <ArrowLeft className="w-4 h-4" /> All students
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink leading-tight" style={{ fontFamily: "var(--font-display)" }}>{student.name}</h1>
          <p className="text-[13px] text-ink-muted">{student.email}</p>
          <p className="text-[13px] text-ink-muted mt-0.5">{student.field} · Year {student.year}{student.targetRole ? ` · ${student.targetRole}` : ""}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">Readiness</p>
          <p className="text-[30px] font-extrabold text-brand tabular-nums leading-none">{readiness.score}</p>
        </div>
      </div>

      {/* Readiness breakdown */}
      <div className="bg-paper rounded-2xl shadow-soft p-4">
        <p className="text-[13px] font-bold text-ink mb-3">Readiness breakdown</p>
        <div className="space-y-2">
          {BREAKDOWN.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-[13px] text-ink-muted w-28 shrink-0">{label}</span>
              <div className="h-1.5 rounded-full bg-canvas overflow-hidden flex-1">
                <div className="h-full bg-brand rounded-full" style={{ width: `${readiness.breakdown[key]}%` }} />
              </div>
              <span className="text-[13px] font-semibold text-ink-muted tabular-nums w-8 text-right">{readiness.breakdown[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Milestone checklist */}
      {track?.track && (
        <div className="bg-paper rounded-2xl shadow-soft p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold text-ink">{track.track.name}</p>
            <p className="text-[13px] font-semibold text-ink-muted">{track.done} of {track.total}</p>
          </div>
          <div className="space-y-2">
            {track.milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${m.done ? "bg-emerald-500 text-white" : "border-2 border-line text-transparent"}`}>
                  <Check className="w-3 h-3" strokeWidth={3} />
                </div>
                <span className={`text-[13px] ${m.done ? "text-ink-muted line-through" : "text-ink"}`}>{m.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mock score trend */}
      <div className="bg-paper rounded-2xl shadow-soft p-4">
        <p className="text-[13px] font-bold text-ink mb-3">Mock interview scores</p>
        {mockHistory.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No completed mock interviews yet.</p>
        ) : (
          <div className="flex items-end gap-2 h-28">
            {mockHistory.map((m) => (
              <div key={m.id} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                <span className="text-[10px] font-bold text-ink-muted tabular-nums">{m.overallScore}</span>
                <div className="w-full bg-brand rounded-t-md" style={{ height: `${(m.overallScore / maxScore) * 100}%`, minHeight: 4 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
