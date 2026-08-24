import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Copy, Check, Search } from "lucide-react";
import { useTpoDashboard, type TpoStudentRow } from "@/hooks/useTpo";

function readinessPill(score: number): string {
  if (score >= 60) return "bg-emerald-100 text-emerald-700";
  if (score >= 35) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-paper rounded-2xl shadow-soft p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="text-[26px] font-extrabold text-ink tabular-nums leading-tight mt-1">{value}</p>
    </div>
  );
}

export default function TpoDashboard() {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useTpoDashboard();
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const rows = data?.students ?? [];
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((s) => s.name.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle));
  }, [data, q]);

  const inviteUrl = data?.college ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/join/${data.college.inviteCode}` : "";

  const copyInvite = () => {
    if (!inviteUrl) return;
    navigator.clipboard?.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] rounded-2xl bg-paper shadow-soft animate-pulse" />)}
        </div>
        <div className="h-[300px] rounded-2xl bg-paper shadow-soft animate-pulse" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className="bg-paper rounded-2xl shadow-soft p-6 text-center text-[14px] text-danger">Couldn't load the dashboard.</div>;
  }

  const dist = data.distribution;
  const distTotal = Math.max(1, dist.red + dist.amber + dist.green);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-extrabold text-ink leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          {data.college?.name ?? "Your college"}
        </h1>
        <p className="text-[13px] text-ink-muted">{data.college?.city}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Students" value={data.stats.studentCount} />
        <StatCard label="Avg readiness" value={data.stats.avgReadiness} />
        <StatCard label="Placement-ready" value={data.stats.readyCount} />
        <StatCard label="Active today" value={data.stats.activeToday} />
      </div>

      {/* Readiness distribution */}
      <div className="bg-paper rounded-2xl shadow-soft p-4">
        <p className="text-[13px] font-bold text-ink mb-2">Readiness distribution</p>
        <div className="h-3 rounded-full overflow-hidden flex bg-canvas">
          <div className="bg-rose-400 h-full" style={{ width: `${(dist.red / distTotal) * 100}%` }} />
          <div className="bg-amber-400 h-full" style={{ width: `${(dist.amber / distTotal) * 100}%` }} />
          <div className="bg-emerald-400 h-full" style={{ width: `${(dist.green / distTotal) * 100}%` }} />
        </div>
        <div className="flex gap-4 mt-2 text-[11px] font-semibold">
          <span className="text-rose-600">At risk {dist.red}</span>
          <span className="text-amber-600">Developing {dist.amber}</span>
          <span className="text-emerald-600">Ready {dist.green}</span>
        </div>
      </div>

      {/* Invite */}
      {data.college && (
        <div className="bg-brand-soft rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-ink">Invite students</p>
            <p className="text-[12px] text-ink-muted truncate">{inviteUrl}</p>
          </div>
          <button
            type="button"
            onClick={copyInvite}
            className="shrink-0 inline-flex items-center gap-1.5 bg-brand text-white text-[12px] font-bold px-3 py-2 rounded-xl"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}

      {/* Students table */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <p className="text-[15px] font-bold text-ink">Students</p>
          <div className="relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="pl-9 pr-3 h-9 rounded-xl bg-paper border border-line text-[13px] text-ink w-44 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        <div className="bg-paper rounded-2xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-ink-muted border-b border-line">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Track</th>
                  <th className="px-4 py-3">Mocks</th>
                  <th className="px-4 py-3 text-right">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: TpoStudentRow) => (
                  <tr
                    key={s.id}
                    onClick={() => setLocation(`/students/${s.id}`)}
                    className="border-b border-line last:border-0 hover:bg-canvas cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="text-[14px] font-semibold text-ink">{s.name}</p>
                      <p className="text-[11px] text-ink-muted">{s.field}</p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink-muted">{s.year}</td>
                    <td className="px-4 py-3 text-[13px] text-ink-muted tabular-nums">{s.milestonesDone}/{s.milestonesTotal}</td>
                    <td className="px-4 py-3 text-[13px] text-ink-muted tabular-nums">{s.mockCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[12px] font-bold tabular-nums ${readinessPill(s.readinessScore)}`}>
                        {s.readinessScore}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] text-ink-muted">No students yet. Share your invite link to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
