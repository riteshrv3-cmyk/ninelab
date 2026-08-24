import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Zap,
  Mail,
  ShieldAlert,
  GraduationCap,
  Activity,
  Sparkles,
} from "lucide-react";
import { type ReactNode } from "react";

const NAV = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/students", label: "Students", icon: Users },
  { path: "/recruiters", label: "Recruiters", icon: Briefcase },
  { path: "/jobs", label: "Jobs", icon: Sparkles },
  { path: "/colleges", label: "Colleges", icon: GraduationCap },
  { path: "/invites", label: "Invites", icon: Mail },
  { path: "/drive-checks", label: "Drive Checks", icon: ShieldAlert },
  { path: "/activity", label: "Live Activity", icon: Activity },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f97316] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">ninelab</div>
              <div className="text-[11px] text-muted-foreground leading-tight">Admin Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Live · auto-refresh 5s
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
