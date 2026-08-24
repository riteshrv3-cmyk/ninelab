import { useQuery } from "@tanstack/react-query";
import { defaultQueryFn } from "@/lib/queryClient";
import type { AdminRecruiter } from "@/lib/api";
import { useState } from "react";

interface AdminJob {
  id: number;
  title: string;
  status: string;
  invitesSent: number;
  createdAt: string;
  recruiterId: number;
  recruiterName: string | null;
  recruiterCompany: string | null;
  parsedRequirements: {
    role?: string;
    seniority?: string;
    mustHaveSkills?: string[];
    workMode?: string | null;
    summary?: string;
  } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Recruiters() {
  const { data: recruiters = [], isLoading: loadingR } = useQuery<AdminRecruiter[]>({
    queryKey: ["/api/admin/recruiters"],
    queryFn: defaultQueryFn,
    refetchInterval: 15000,
  });

  const { data: jobs = [], isLoading: loadingJ } = useQuery<AdminJob[]>({
    queryKey: ["/api/admin/jobs"],
    queryFn: defaultQueryFn,
    refetchInterval: 15000,
  });

  const [activeTab, setActiveTab] = useState<"funnel" | "signups" | "jobs">("funnel");

  const totalSignups = recruiters.length;
  const postedJob = recruiters.filter(r => r.jobsPosted > 0);
  const seriousCount = postedJob.length;
  const conversionPct = totalSignups === 0 ? 0 : Math.round((seriousCount / totalSignups) * 100);
  const totalJobsPosted = jobs.length;
  const totalInvitesSent = recruiters.reduce((s, r) => s + r.invitesSent, 0);

  // Group signups by day (last 14 days)
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const signupsByDay: Record<string, number> = {};
  const jobsByDay: Record<string, number> = {};
  for (const d of last14) { signupsByDay[d] = 0; jobsByDay[d] = 0; }
  for (const r of recruiters) {
    const d = new Date(r.createdAt).toISOString().slice(0, 10);
    if (d in signupsByDay) signupsByDay[d]++;
  }
  for (const j of jobs) {
    const d = new Date(j.createdAt).toISOString().slice(0, 10);
    if (d in jobsByDay) jobsByDay[d]++;
  }
  const maxBar = Math.max(...Object.values(signupsByDay), ...Object.values(jobsByDay), 1);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recruiter Demand Signals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live validation: who is finding ninelab and actually using it. Auto-refreshes every 15s.
          </p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-1.5">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* FUNNEL — top-level demand signal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Recruiter Sign-ups",
            value: totalSignups,
            sub: "Total accounts created",
            color: "text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/20",
          },
          {
            label: "Posted a Job",
            value: seriousCount,
            sub: `${conversionPct}% of sign-ups`,
            color: "text-violet-400",
            bg: "bg-violet-500/10 border-violet-500/20",
          },
          {
            label: "Total Jobs Posted",
            value: totalJobsPosted,
            sub: "Across all recruiters",
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/20",
          },
          {
            label: "Invites Sent",
            value: totalInvitesSent,
            sub: "To student pool",
            color: "text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/20",
          },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-3xl font-black ${s.color}`}>
              {loadingR ? "—" : s.value}
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">{s.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Key insight banner */}
      <div className="bg-muted/30 border border-border rounded-xl p-4 flex items-start gap-4">
        <div className="text-2xl">📊</div>
        <div>
          <p className="font-bold text-sm">
            Demand Funnel:{" "}
            <span className="text-blue-400">{totalSignups} signed up</span>
            {" → "}
            <span className="text-violet-400">{seriousCount} posted a job</span>
            {" → "}
            <span className="text-emerald-400">{totalJobsPosted} total JDs collected</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {seriousCount === 0
              ? "No recruiters have posted jobs yet. Share the portal link and track who converts."
              : conversionPct >= 50
              ? `Strong intent — ${conversionPct}% of sign-ups went all the way to posting a job. This is real demand.`
              : `${conversionPct}% conversion to job post. The drop-off tells you where to improve the onboarding.`
            }
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 border border-border rounded-xl p-1 w-fit">
        {(["funnel", "signups", "jobs"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "funnel" ? "Activity Timeline" : tab === "signups" ? `Sign-ups (${totalSignups})` : `Jobs Posted (${totalJobsPosted})`}
          </button>
        ))}
      </div>

      {/* TIMELINE */}
      {activeTab === "funnel" && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Last 14 days</h2>
          <div className="flex items-end gap-2 h-32">
            {last14.map(d => {
              const s = signupsByDay[d] ?? 0;
              const j = jobsByDay[d] ?? 0;
              const label = new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end h-24">
                    <div
                      className="flex-1 bg-blue-500/70 rounded-sm transition-all"
                      style={{ height: `${s === 0 ? 2 : (s / maxBar) * 96}px` }}
                      title={`${s} sign-up${s !== 1 ? "s" : ""}`}
                    />
                    <div
                      className="flex-1 bg-violet-500/70 rounded-sm transition-all"
                      style={{ height: `${j === 0 ? 2 : (j / maxBar) * 96}px` }}
                      title={`${j} job${j !== 1 ? "s" : ""}`}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500/70" /><span className="text-xs text-muted-foreground">Sign-ups</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-violet-500/70" /><span className="text-xs text-muted-foreground">Jobs posted</span></div>
          </div>

          {/* Recent events feed */}
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent events</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {[
                ...recruiters.map(r => ({ type: "signup" as const, name: r.name, company: r.company, email: r.email, at: r.createdAt })),
                ...jobs.map(j => ({ type: "job" as const, name: j.recruiterName ?? "?", company: j.recruiterCompany ?? "?", email: "", at: j.createdAt, title: j.title })),
              ]
                .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                .slice(0, 30)
                .map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className={`mt-0.5 text-xs font-black px-2 py-0.5 rounded-full ${ev.type === "signup" ? "bg-blue-500/15 text-blue-400" : "bg-violet-500/15 text-violet-400"}`}>
                      {ev.type === "signup" ? "SIGN-UP" : "JOB"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">{ev.company}</span>
                      <span className="text-muted-foreground"> · {ev.name}</span>
                      {ev.type === "job" && <span className="text-muted-foreground"> · "{ev.title}"</span>}
                    </div>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">{timeAgo(ev.at)}</span>
                  </div>
                ))}
              {recruiters.length === 0 && jobs.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity yet. Share the recruiter portal link to start tracking demand.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SIGN-UPS TABLE */}
      {activeTab === "signups" && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold">{totalSignups} recruiter accounts</p>
            <p className="text-xs text-muted-foreground">{seriousCount} posted at least one job — these are your serious leads</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Recruiter</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-center px-4 py-3">Jobs Posted</th>
                  <th className="text-center px-4 py-3">Invites</th>
                  <th className="text-left px-4 py-3">Signed Up</th>
                  <th className="text-left px-4 py-3">Last Seen</th>
                  <th className="text-center px-4 py-3">Intent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...recruiters].sort((a, b) => b.jobsPosted - a.jobsPosted).map(r => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-bold">{r.company}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.role ?? "—"}</td>
                    <td className="px-4 py-3 text-center font-black text-lg"
                      style={{ color: r.jobsPosted > 0 ? "rgb(167,139,250)" : undefined }}>
                      {r.jobsPosted}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{r.invitesSent}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(r.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(r.lastSeenAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                        r.jobsPosted >= 2 ? "bg-emerald-500/15 text-emerald-400" :
                        r.jobsPosted === 1 ? "bg-violet-500/15 text-violet-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {r.jobsPosted >= 2 ? "Power user" : r.jobsPosted === 1 ? "Interested" : "Browsing"}
                      </span>
                    </td>
                  </tr>
                ))}
                {loadingR && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!loadingR && recruiters.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No sign-ups yet. Share{" "}
                    <code className="bg-muted px-1 rounded">/recruiter-portal/welcome</code>
                    {" "}to start capturing demand.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* JOBS TABLE */}
      {activeTab === "jobs" && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold">{totalJobsPosted} job postings — each one is a recruiter who committed</p>
            <p className="text-xs text-muted-foreground mt-0.5">Read the JDs to understand what roles they're hiring for — this shapes your student pool strategy.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Job Title</th>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Skills Needed</th>
                  <th className="text-left px-4 py-3">Seniority</th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-right px-4 py-3">Invites</th>
                  <th className="text-left px-4 py-3">Posted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map(j => (
                  <tr key={j.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-bold">{j.title}</div>
                      {j.parsedRequirements?.summary && (
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{j.parsedRequirements.summary}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{j.recruiterCompany ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(j.parsedRequirements?.mustHaveSkills ?? []).slice(0, 4).map(s => (
                          <span key={s} className="text-[10px] font-semibold bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                        {(j.parsedRequirements?.mustHaveSkills?.length ?? 0) > 4 && (
                          <span className="text-[10px] text-muted-foreground">+{(j.parsedRequirements!.mustHaveSkills!.length) - 4}</span>
                        )}
                        {!j.parsedRequirements?.mustHaveSkills?.length && <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{j.parsedRequirements?.seniority ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{j.parsedRequirements?.workMode ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-bold">{j.invitesSent}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(j.createdAt)}</td>
                  </tr>
                ))}
                {loadingJ && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!loadingJ && jobs.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No jobs posted yet. Once a recruiter posts a JD, their requirements appear here — use this to tailor your student onboarding to match real hiring demand.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
