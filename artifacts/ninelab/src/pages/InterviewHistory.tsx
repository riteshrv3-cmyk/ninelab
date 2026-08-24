import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Calendar, ChevronRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/authFetch";

interface HistoryItem {
  id: number;
  company: string;
  interviewType: string;
  round: string;
  overallScore: number;
  communicationScore: number | null;
  technicalScore: number | null;
  confidenceScore: number | null;
  overallRating: string | null;
  createdAt: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function fmtDateLong(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function InterviewHistory() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sid = localStorage.getItem("studentId");
    if (!sid) { setLocation("/"); return; }
    apiFetch(`/api/interview/students/${sid}/sessions`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => setItems(d.items as HistoryItem[]))
      .catch(e => setError(e.message));
  }, [setLocation]);

  const stats = useMemo(() => {
    if (!items || items.length === 0) return null;
    const scores = items.map(i => i.overallScore);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const best = Math.max(...scores);
    const last = items[items.length - 1].overallScore;
    const first = items[0].overallScore;
    const delta = last - first;
    return { avg, best, total: items.length, delta };
  }, [items]);

  const chartData = useMemo(() => {
    if (!items) return [];
    return items.map((i, idx) => ({
      idx: idx + 1,
      label: fmtDate(i.createdAt),
      score: i.overallScore,
      company: i.company,
    }));
  }, [items]);

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <div className="sticky top-0 z-10 bg-paper px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/practice")}
            className="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-display text-[30px] lg:text-[36px] font-extrabold text-ink leading-[1.06] tracking-tight">Interview History</h1>
            <p className="text-[12px] text-ink-muted">Track your improvement over time</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {error && (
          <div className="bg-paper rounded-2xl shadow-soft p-4">
            <p className="text-[14px] font-bold text-danger">Couldn't load history</p>
            <p className="text-[12px] text-ink-muted mt-1">{error}</p>
          </div>
        )}

        {!error && items === null && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          </div>
        )}

        {items && items.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[14px] text-ink">No interviews yet.</p>
            <p className="text-[12px] text-ink-muted mt-1 mb-5">Finish your first mock interview to start tracking your progress.</p>
            <Button
              onClick={() => setLocation("/practice")}
              className="rounded-full bg-brand text-white font-bold px-4 py-3 hover:bg-brand/90"
            >
              Start Mock Interview
            </Button>
          </div>
        )}

        {items && items.length > 0 && stats && (
          <>
            {/* Stat row */}
            <div className="grid grid-cols-3 divide-x divide-line bg-paper rounded-2xl shadow-soft">
              <div className="px-3 py-4 text-center">
                <div className="text-[26px] font-extrabold text-ink leading-none">{stats.avg}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mt-1.5">Average</div>
              </div>
              <div className="px-3 py-4 text-center">
                <div className="text-[26px] font-extrabold text-ink leading-none">{stats.best}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mt-1.5">Best</div>
              </div>
              <div className="px-3 py-4 text-center">
                <div className="text-[26px] font-extrabold text-ink leading-none">{stats.total}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mt-1.5">Sessions</div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-paper rounded-2xl shadow-soft overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Score Trend</p>
                    <p className="text-[14px] font-bold text-ink">
                      {stats.delta > 0 && <span>+{stats.delta} pts since start</span>}
                      {stats.delta < 0 && <span>{stats.delta} pts since start</span>}
                      {stats.delta === 0 && <span className="text-ink-muted">Steady</span>}
                    </p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-ink-muted" />
                </div>
                <div className="h-48 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="#ececf0" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#9a9aa2", fontSize: 10, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tick={{ fill: "#9a9aa2", fontSize: 10, fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <ReferenceLine y={stats.avg} stroke="#ececf0" strokeDasharray="4 4" label={{ value: "avg", fill: "#9a9aa2", fontSize: 9, fontWeight: 700, position: "right" }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #ececf0", boxShadow: "none", fontSize: 12, fontWeight: 700, color: "#0f0f10" }}
                        formatter={(v: number) => [`${v} / 100`, "Score"]}
                        labelFormatter={(l, p) => {
                          const d = p?.[0]?.payload as { company?: string } | undefined;
                          return d?.company ? `${d.company} · ${l}` : String(l);
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#4a55c7"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#ffffff", stroke: "#4a55c7", strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: "#4a55c7", stroke: "#ffffff", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Session list */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">All Sessions</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-4">
                {[...items].reverse().map((it, i) => (
                  <motion.button
                    key={it.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 8) * 0.04 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setLocation(`/practice/interview/${it.id}`)}
                    className="w-full py-4 border-t border-line flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-brand-soft flex items-center justify-center flex-shrink-0 text-brand font-extrabold text-[16px]">
                        {it.overallScore}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-ink text-[14px] truncate">{it.company}</p>
                        <p className="text-[12px] text-ink-muted truncate">
                          {it.interviewType}
                          {it.overallRating ? ` · ${it.overallRating}` : ""}
                        </p>
                        <p className="text-[12px] text-ink-muted mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {fmtDateLong(it.createdAt)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-muted flex-shrink-0 ml-2" />
                  </motion.button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Suppress unused warning for cn import (kept for future styling extensions)
void cn;
