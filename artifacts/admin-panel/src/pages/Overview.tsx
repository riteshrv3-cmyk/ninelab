import { useQuery } from "@tanstack/react-query";
import { defaultQueryFn } from "@/lib/queryClient";
import type { Overview, ActivityEvent } from "@/lib/api";
import {
  Users,
  Briefcase,
  Mail,
  ShieldAlert,
  GraduationCap,
  Building2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#a855f7"];

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  tone = "primary",
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  delta?: string;
  tone?: "primary" | "secondary" | "accent" | "success" | "destructive";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    accent: "bg-accent/10 text-accent",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            {label}
          </div>
          <div className="mt-2 text-3xl font-bold">{value}</div>
          {delta && (
            <div className="mt-1 text-xs text-success font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {delta}
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${toneClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<ActivityEvent["kind"], string> = {
  student_signup: "Signup",
  recruiter_invite: "Invite",
  drive_check: "Drive",
  interview: "Interview",
};

const KIND_COLOR: Record<ActivityEvent["kind"], string> = {
  student_signup: "bg-success/15 text-success",
  recruiter_invite: "bg-primary/15 text-primary",
  drive_check: "bg-destructive/15 text-destructive",
  interview: "bg-secondary/15 text-secondary",
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Overview() {
  const { data: ov } = useQuery<Overview>({
    queryKey: ["/api/admin/overview"],
    queryFn: defaultQueryFn,
    refetchInterval: 5_000,
  });
  const { data: activity = [] } = useQuery<ActivityEvent[]>({
    queryKey: ["/api/admin/activity"],
    queryFn: defaultQueryFn,
    refetchInterval: 5_000,
  });

  if (!ov) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  const invitePieData = ov.inviteBreakdown.map((b) => ({ name: b.status, value: b.c }));
  const driveBarData = ov.driveVerdictBreakdown.map((b) => ({ name: b.verdict, value: b.c }));

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live cross-portal metrics for ninelab · refreshes every 5s
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Last update: {new Date().toLocaleTimeString()}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Students"
          value={ov.counts.students}
          delta={`+${ov.last24h.students} in 24h`}
          tone="primary"
        />
        <StatCard
          icon={Briefcase}
          label="Recruiters"
          value={ov.counts.recruiters}
          tone="secondary"
        />
        <StatCard
          icon={Sparkles}
          label="Jobs Posted"
          value={ov.counts.jobs}
          tone="accent"
        />
        <StatCard
          icon={Mail}
          label="Recruiter Invites"
          value={ov.counts.invites}
          delta={`+${ov.last24h.invites} in 24h`}
          tone="primary"
        />
        <StatCard
          icon={ShieldAlert}
          label="Drive Checks"
          value={ov.counts.driveChecks}
          delta={`+${ov.last24h.driveChecks} in 24h`}
          tone="destructive"
        />
        <StatCard icon={GraduationCap} label="Colleges" value={ov.counts.colleges} tone="success" />
        <StatCard
          icon={Building2}
          label="Open to Work"
          value={ov.counts.openToWork}
          tone="success"
        />
        <StatCard icon={TrendingUp} label="Pro Users" value={ov.counts.pro} tone="accent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="text-xs text-muted-foreground uppercase font-semibold">Avg Score</div>
          <div className="mt-2 text-3xl font-bold">{ov.averages.avgScore}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="text-xs text-muted-foreground uppercase font-semibold">Avg Profile Strength</div>
          <div className="mt-2 text-3xl font-bold">{ov.averages.avgStrength}%</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="text-xs text-muted-foreground uppercase font-semibold">Avg Commitment</div>
          <div className="mt-2 text-3xl font-bold">{ov.averages.avgCommitment}</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="text-xs text-muted-foreground uppercase font-semibold">Total XP Earned</div>
          <div className="mt-2 text-3xl font-bold">{ov.averages.totalXp.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="font-bold mb-3">Invite Status</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={invitePieData} dataKey="value" nameKey="name" outerRadius={70} label>
                  {invitePieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="font-bold mb-3">Drive Verdict Mix</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driveBarData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <RTooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="font-bold mb-3">24h Activity Pulse</h3>
          <div className="space-y-3 mt-4">
            {[
              ["Signups", ov.last24h.students],
              ["Invites", ov.last24h.invites],
              ["Drive Checks", ov.last24h.driveChecks],
              ["Interviews", ov.last24h.interviews],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-bold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Recent Activity</h3>
          <span className="text-[11px] text-muted-foreground">{activity.length} events</span>
        </div>
        <div className="divide-y divide-border max-h-[420px] overflow-y-auto -mx-2">
          {activity.slice(0, 30).map((e, i) => (
            <div key={`${e.kind}-${e.entityId}-${i}`} className="flex items-center gap-3 px-2 py-2.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${KIND_COLOR[e.kind]}`}>
                {KIND_LABEL[e.kind]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{e.title}</div>
                <div className="text-xs text-muted-foreground truncate">{e.subtitle}</div>
              </div>
              <div className="text-[11px] text-muted-foreground shrink-0">{timeAgo(e.at)}</div>
            </div>
          ))}
          {activity.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">No activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
