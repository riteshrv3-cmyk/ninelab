import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api/authFetch";
import { Toko } from "@/components/ninelab/Toko";

interface NotebookEvent {
  action: string;
  description: string;
  date: string;
  milestone: boolean;
}

interface NotebookWeek {
  weekKey: string;
  summary: { tasksDone: number; practiceSessionsDone: number; applicationsAdded: number };
  events: NotebookEvent[];
}

function weekLabel(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  return `Week ${weekStr}, ${yearStr}`;
}

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

async function shareWeek(week: NotebookWeek) {
  const text = `This week on ninelab: ${week.summary.tasksDone} tasks done, ${week.summary.practiceSessionsDone} practice sessions, ${week.summary.applicationsAdded} applications added. Toko's been keeping track.`;
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // clipboard unavailable — silently no-op, nothing more we can do here
  }
}

export default function Notebook() {
  const [, setLocation] = useLocation();
  const [weeks, setWeeks] = useState<NotebookWeek[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedWeek, setCopiedWeek] = useState<string | null>(null);

  useEffect(() => {
    const sid = localStorage.getItem("studentId");
    if (!sid) { setLocation("/"); return; }
    apiFetch(`/api/students/${sid}/notebook`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setWeeks(d.weeks as NotebookWeek[]))
      .catch((e) => setError(e.message));
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <div className="sticky top-0 z-10 bg-paper px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 lg:max-w-2xl lg:mx-auto">
          <button
            onClick={() => setLocation("/home")}
            className="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-display text-[30px] lg:text-[36px] font-extrabold text-ink leading-[1.06] tracking-tight">Toko's Notebook</h1>
            <p className="text-[13px] text-ink-muted">Everything Toko has noticed about your journey</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-6 lg:max-w-2xl lg:mx-auto">
        {error && (
          <div className="bg-paper rounded-2xl shadow-soft p-4">
            <p className="text-[14px] font-bold text-danger">Couldn't load your notebook</p>
            <p className="text-[13px] text-ink-muted mt-1">{error}</p>
          </div>
        )}

        {!error && weeks === null && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          </div>
        )}

        {weeks && weeks.length === 0 && (
          <div className="py-12 flex flex-col items-center text-center">
            <Toko pose="shrug" size={64} className="mb-3" />
            <p className="text-[14px] text-ink">Nothing here yet.</p>
            <p className="text-[13px] text-ink-muted mt-1">Complete a task or take a mock interview — Toko starts noticing from day one.</p>
          </div>
        )}

        {weeks && weeks.map((week, wi) => (
          <motion.div
            key={week.weekKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(wi, 6) * 0.05 }}
            className="bg-paper rounded-2xl shadow-soft overflow-hidden"
          >
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">{weekLabel(week.weekKey)}</p>
                <p className="text-[13px] font-semibold text-ink mt-0.5">
                  {week.summary.tasksDone} tasks · {week.summary.practiceSessionsDone} practice · {week.summary.applicationsAdded} applications
                </p>
              </div>
              <button
                onClick={async () => {
                  await shareWeek(week);
                  setCopiedWeek(week.weekKey);
                  setTimeout(() => setCopiedWeek((k) => (k === week.weekKey ? null : k)), 2000);
                }}
                className="w-9 h-9 rounded-full bg-brand-soft flex items-center justify-center text-brand shrink-0"
                aria-label="Share this week's progress"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
            {copiedWeek === week.weekKey && (
              <p className="px-4 pb-2 text-[13px] font-semibold text-brand">Copied to clipboard</p>
            )}
            <div className="border-t border-line">
              {week.events.map((e, i) => (
                <div key={i} className="px-4 py-3 border-t border-line first:border-t-0 flex items-start gap-3">
                  {e.milestone ? (
                    <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-line shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">{e.description}</p>
                    <p className="text-[13px] text-ink-muted mt-0.5">{fmtDate(e.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
