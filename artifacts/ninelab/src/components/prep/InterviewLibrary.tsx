import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight } from "lucide-react";
import { useCreateInterviewSession } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { PressableCard } from "@/components/PressableCard";
import {
  INTERVIEW_PRESETS,
  INTERVIEW_ROLES,
  type InterviewPreset,
} from "@/data/interviewLibrary";

// Self-contained library of ready-made interviews. No props: it reads the
// studentId from localStorage itself and starts a session with the same
// createInterview.mutateAsync({data:{studentId, company, round}}) contract
// Opportunities.startPractice uses, then routes into the live interview.
export default function InterviewLibrary() {
  const [, setLocation] = useLocation();
  const createInterview = useCreateInterviewSession();

  const [role, setRole] = useState<"all" | InterviewPreset["roleId"]>("all");
  const [practicingId, setPracticingId] = useState<string | null>(null);

  const presets =
    role === "all"
      ? INTERVIEW_PRESETS
      : INTERVIEW_PRESETS.filter((p) => p.roleId === role);

  const start = async (preset: InterviewPreset) => {
    const studentId = localStorage.getItem("studentId");
    if (!studentId) {
      setLocation("/");
      return;
    }
    setPracticingId(preset.id);
    try {
      const session = await createInterview.mutateAsync({
        data: {
          studentId: Number(studentId),
          company: `${preset.company} (${preset.label})`,
          round: `${preset.type}|${preset.difficulty}`,
        },
      });
      setLocation(`/practice/interview/${session.id}`);
    } catch {
      setPracticingId(null);
    }
  };

  const filters: { id: "all" | InterviewPreset["roleId"]; label: string }[] = [
    { id: "all", label: "All" },
    ...INTERVIEW_ROLES.map((r) => ({ id: r.id, label: r.label })),
  ];

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-display text-xl font-bold text-ink">Interview library</h2>
        <p className="text-sm text-ink-muted mt-1">
          Ready-made interviews for real companies — start in one tap.
        </p>
      </div>

      {/* Filter chips stay reachable while scrolling the list: sticky below
          the mobile TopBar (3.5rem + safe area), flush to the top on lg. */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] lg:top-0 z-20 bg-paper -mx-1 px-1 py-2 mb-2 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setRole(f.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors",
              role === f.id
                ? "bg-brand text-white"
                : "bg-brand-soft text-brand hover:bg-brand-soft/70"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Compact rows, not cards — 14 presets should scan, not scroll. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {presets.map((preset) => {
          const loading = practicingId === preset.id;
          return (
            <PressableCard
              key={preset.id}
              onClick={() => start(preset)}
              disabled={loading}
              aria-label={`${preset.company} — ${preset.label}`}
              className="w-full bg-paper rounded-xl shadow-soft border border-line px-3.5 py-2.5 flex items-center gap-3 disabled:opacity-70"
            >
              <div className="flex-1 min-w-0">
                <div className="type-micro font-bold text-ink-muted uppercase tracking-wider truncate">
                  {preset.roleLabel}
                </div>
                <div className="type-body font-bold text-ink truncate">
                  {preset.company}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand type-micro font-bold">
                  {preset.type}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand type-micro font-bold">
                  {preset.difficulty}
                </span>
              </div>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
              )}
            </PressableCard>
          );
        })}
      </div>
    </section>
  );
}
