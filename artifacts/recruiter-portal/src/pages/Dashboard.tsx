import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Zap, LogOut, BookmarkCheck, Briefcase, Send, TrendingUp, Eye,
  CheckCircle2, XCircle, Clock, Plus, ArrowRight, Users, Sparkles
} from "lucide-react";

interface DashboardData {
  recruiter: { id: number; name: string; company: string; email: string };
  stats: {
    totalInvites: number;
    accepted: number;
    declined: number;
    pending: number;
    interviewed: number;
    hired: number;
    seenByStudent: number;
    responseRate: number;
    acceptRate: number;
    hireRate: number;
    jobsPosted: number;
  };
  funnel: Array<{ stage: string; count: number; conversionPct: number }>;
  jobFunnels: Array<{ id: number; title: string; invited: number; accepted: number; hired: number; acceptRate: number }>;
  recentInvites: Array<{
    id: number; studentId: number; studentName: string | null; role: string | null;
    status: string; studentSeen: boolean; createdAt: string;
  }>;
  jobs: Array<{
    id: number; title: string; status: string; invitesSent: number; createdAt: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  accepted: "#10b981",
  declined: "#ef4444",
  interviewed: "#8b5cf6",
  hired: "#059669",
};

const STAGE_COLORS: Record<string, string> = {
  Invited: "#4f46e5",
  Seen: "#0ea5e9",
  Accepted: "#10b981",
  Interviewed: "#8b5cf6",
  Hired: "#059669",
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const recruiter = JSON.parse(localStorage.getItem("recruiter") || "{}");

  useEffect(() => {
    if (!recruiter?.id) { setLocation("/login"); return; }
    fetch(`/api/recruiters/${recruiter.id}/dashboard`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => { localStorage.removeItem("recruiter"); setLocation("/login"); };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="bg-white border-b border-[#f0f4ff] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-[#4f46e5] to-[#6366f1] rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-[#0f172a] text-lg">ninelab</span>
            </div>
            <span className="text-[#94a3b8] text-sm hidden sm:block">· Recruiter Portal</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setLocation("/post-job")} className="hidden sm:flex items-center gap-1.5 text-sm font-bold text-white bg-[#4f46e5] px-3 py-2 rounded-xl hover:bg-[#4338ca] transition-colors">
              <Plus className="w-4 h-4" /> Post Job
            </button>
            <button onClick={() => setLocation("/talent")} className="text-sm font-bold text-[#4f46e5] bg-[#eef2ff] px-3 py-2 rounded-xl hover:bg-[#e0e7ff] transition-colors">
              Talent Pool
            </button>
            <button onClick={() => setLocation("/shortlist")} className="text-sm font-bold text-[#64748b] bg-[#f8fafc] px-3 py-2 rounded-xl hover:bg-[#f1f5f9] transition-colors">
              <BookmarkCheck className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              <div className="w-7 h-7 bg-[#e0e7ff] rounded-full flex items-center justify-center">
                <span className="text-xs font-black text-[#4f46e5]">{recruiter.name?.[0] || "R"}</span>
              </div>
              <span className="hidden sm:block font-medium">{recruiter.company}</span>
            </div>
            <button onClick={logout} className="text-[#94a3b8] hover:text-[#64748b] transition-colors p-1.5">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#0f172a] mb-1">Welcome back, {recruiter.name?.split(" ")[0]} 👋</h1>
          <p className="text-[#64748b] text-sm">Here's what's happening with {recruiter.company}'s hiring.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />)}</div>
        ) : !data ? (
          <p className="text-[#94a3b8]">Could not load dashboard.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { icon: Send, label: "Invites Sent", value: data.stats.totalInvites, color: "#4f46e5" },
                { icon: Eye, label: "Seen by Student", value: data.stats.seenByStudent, color: "#0ea5e9" },
                { icon: TrendingUp, label: "Response Rate", value: `${data.stats.responseRate}%`, color: "#10b981" },
                { icon: Briefcase, label: "Jobs Posted", value: data.stats.jobsPosted, color: "#f59e0b" },
              ].map(stat => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-[#f0f4ff] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                      <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-[#0f172a]">{stat.value}</p>
                  <p className="text-xs text-[#94a3b8] font-bold uppercase mt-1">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-[#f0f4ff] p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-black text-[#0f172a] text-lg">Hiring Funnel</h2>
                    <p className="text-xs text-[#94a3b8]">From invite to hire — see where candidates drop off</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[#059669]">{data.stats.hireRate}%</p>
                    <p className="text-[10px] font-black uppercase text-[#94a3b8]">Hire Rate</p>
                  </div>
                </div>
                {data.stats.totalInvites === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto bg-[#f1f5f9] rounded-2xl flex items-center justify-center mb-3">
                      <TrendingUp className="w-6 h-6 text-[#94a3b8]" />
                    </div>
                    <p className="text-sm text-[#94a3b8]">No invites yet — post a job to get matched candidates instantly.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {data.funnel.map((stage, idx) => {
                      const maxCount = data.funnel[0].count || 1;
                      const widthPct = (stage.count / maxCount) * 100;
                      const color = STAGE_COLORS[stage.stage] || "#64748b";
                      return (
                        <div key={stage.stage}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[#0f172a]">{stage.stage}</span>
                              {idx > 0 && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>
                                  {stage.conversionPct}% from prev
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-black text-[#0f172a]">{stage.count}</span>
                          </div>
                          <div className="h-7 bg-[#f8fafc] rounded-lg overflow-hidden relative">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ delay: idx * 0.08, duration: 0.5, ease: "easeOut" }}
                              className="h-full rounded-lg"
                              style={{ background: `linear-gradient(90deg, ${color}, ${color}dd)` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {data.jobFunnels.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-[#f1f5f9]">
                    <h3 className="text-xs font-black uppercase text-[#94a3b8] mb-3">Per-Job Breakdown</h3>
                    <div className="space-y-2">
                      {data.jobFunnels.map(jf => (
                        <div key={jf.id} className="flex items-center gap-3 text-sm">
                          <span className="font-bold text-[#0f172a] truncate flex-1 min-w-0">{jf.title}</span>
                          <span className="text-[#64748b] text-xs whitespace-nowrap">
                            {jf.invited} invited · <span className="text-[#10b981] font-bold">{jf.accepted} accepted</span> · <span className="text-[#059669] font-bold">{jf.hired} hired</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-[#4f46e5] to-[#6366f1] text-white rounded-2xl p-6 flex flex-col">
                <Sparkles className="w-8 h-8 text-[#fbbf24] mb-3" />
                <h3 className="font-black text-xl mb-2 leading-tight">Post a job, get matches in 60 seconds</h3>
                <p className="text-white/80 text-sm mb-5 flex-1">Paste your JD. AI ranks the best candidates instantly. Bulk invite the top 10.</p>
                <button onClick={() => setLocation("/post-job")} className="bg-white text-[#4f46e5] font-black px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg active:scale-95 transition-all">
                  Post Job <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-[#f0f4ff] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-black text-[#0f172a] text-lg">Your Jobs</h2>
                  <button onClick={() => setLocation("/post-job")} className="text-xs font-bold text-[#4f46e5] hover:underline">+ New job</button>
                </div>
                {data.jobs.length === 0 ? (
                  <p className="text-sm text-[#94a3b8]">No jobs yet. Post your first one to start matching.</p>
                ) : (
                  <div className="space-y-2">
                    {data.jobs.map(j => (
                      <div key={j.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-[#f8fafc] transition-colors">
                        <div className="min-w-0">
                          <p className="font-bold text-[#0f172a] text-sm truncate">{j.title}</p>
                          <p className="text-xs text-[#94a3b8]">{j.invitesSent} invites · {new Date(j.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => setLocation(`/job/${j.id}`)} className="text-xs font-bold text-[#4f46e5] hover:underline ml-3 whitespace-nowrap">View matches →</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-[#f0f4ff] p-6">
                <h2 className="font-black text-[#0f172a] text-lg mb-4">Recent Invites</h2>
                {data.recentInvites.length === 0 ? (
                  <p className="text-sm text-[#94a3b8]">No invites sent yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.recentInvites.map(inv => (
                      <button key={inv.id} onClick={() => setLocation(`/student/${inv.studentId}`)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#f8fafc] transition-colors text-left">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-[#eef2ff] rounded-xl flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-[#4f46e5]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0f172a] truncate">{inv.studentName || inv.role || "Candidate"}</p>
                            <p className="text-xs text-[#94a3b8]">{inv.role ? `${inv.role} · ` : ""}{new Date(inv.createdAt).toLocaleDateString()}{inv.studentSeen ? " · seen" : ""}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full ml-2 flex-shrink-0" style={{ background: `${STATUS_COLORS[inv.status] || "#94a3b8"}15`, color: STATUS_COLORS[inv.status] || "#94a3b8" }}>
                          {inv.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
