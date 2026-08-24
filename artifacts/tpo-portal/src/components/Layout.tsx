import { useLocation } from "wouter";
import { LayoutDashboard, Users, Bell, GraduationCap, LogOut, Zap, Trophy, Target, ShieldAlert, Megaphone, Share2 } from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/invite", label: "Invite Students", icon: Share2 },
  { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { path: "/insights", label: "Hiring Insights", icon: Target },
  { path: "/drives", label: "Drive Intel", icon: ShieldAlert },
  { path: "/announce", label: "Announce Drives", icon: Megaphone },
  { path: "/students", label: "Students", icon: Users },
  { path: "/activity", label: "Activity", icon: Bell },
  { path: "/mentors", label: "Mentors", icon: GraduationCap },
];

function getTpo() {
  try { return JSON.parse(localStorage.getItem("tpo") || "{}"); } catch { return {}; }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, nav] = useLocation();
  const tpo = getTpo();

  function logout() {
    localStorage.removeItem("tpo");
    nav("/login");
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#f97316] rounded-lg flex items-center justify-center shadow-sm shadow-orange-200">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#4f46e5] tracking-wide uppercase">ninelab</p>
              <p className="text-[10px] text-[#94a3b8] font-medium">TPO Portal</p>
            </div>
          </div>
        </div>

        {/* College info */}
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <p className="text-xs text-[#94a3b8] font-medium uppercase tracking-wide mb-1">Institution</p>
          <p className="text-sm font-bold text-[#1e293b] leading-tight">{tpo.college || "—"}</p>
          <p className="text-xs text-[#64748b] mt-0.5">{tpo.name || ""}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location === path || location.startsWith(path + "/");
            return (
              <button
                key={path}
                onClick={() => nav(path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-[#f8fafc] text-[#4f46e5] font-semibold"
                    : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]"
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${active ? "text-[#4f46e5]" : "text-[#94a3b8]"}`} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-6">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#94a3b8] hover:bg-[#fef2f2] hover:text-[#ef4444] transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
