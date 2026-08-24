import { Switch, Route, Link, useLocation, Redirect } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { LayoutDashboard, ListChecks, LogOut } from "lucide-react";
import { useMeRole } from "@/hooks/useMeRole";
import TpoDashboard from "./TpoDashboard";
import TpoStudentDetail from "./TpoStudentDetail";
import TpoTrackEditor from "./TpoTrackEditor";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] flex items-center justify-center bg-canvas px-6 text-center">{children}</div>;
}

function TpoNav() {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const item = (href: string, label: string, Icon: typeof LayoutDashboard, active: boolean) => (
    <Link href={href} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold ${active ? "bg-brand text-white" : "text-ink-muted hover:bg-paper"}`}>
      <Icon className="w-4 h-4" /> {label}
    </Link>
  );
  const onDashboard = location === "/" || location.startsWith("/students");
  return (
    <header className="border-b border-line bg-paper/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-extrabold text-ink" style={{ fontFamily: "var(--font-display)" }}>KodeTalent</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand bg-brand-soft px-2 py-0.5 rounded-full">TPO</span>
        </div>
        <nav className="flex items-center gap-1">
          {item("/", "Dashboard", LayoutDashboard, onDashboard)}
          {item("/track", "Track", ListChecks, location === "/track")}
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: `${basePath}/` })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold text-ink-muted hover:bg-paper"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

/**
 * The TPO surface: a role-gated area that lives inside the student app but
 * renders its own chrome (no student AppLayout). Mounted as a nested route at
 * /tpo, above the student catch-all in App.tsx.
 */
export default function TpoApp() {
  const { isLoaded, isSignedIn } = useUser();
  const { data: role, isLoading: roleLoading } = useMeRole(isLoaded && !!isSignedIn);

  if (!isLoaded || (isSignedIn && roleLoading)) {
    return (
      <FullScreen>
        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" />
      </FullScreen>
    );
  }

  if (!isSignedIn) {
    return (
      <FullScreen>
        <div>
          <p className="text-[16px] font-bold text-ink">Sign in to your TPO account</p>
          <p className="text-[13px] text-ink-muted mt-1 max-w-sm">Use the email your KodeTalent admin allowlisted for your college.</p>
          <a href={`${basePath}/sign-in`} className="inline-block mt-4 bg-brand text-white text-[13px] font-bold px-4 py-2 rounded-xl">Sign in</a>
        </div>
      </FullScreen>
    );
  }

  if (role?.role !== "college_admin") {
    return (
      <FullScreen>
        <div>
          <p className="text-[16px] font-bold text-ink">You don't have TPO access</p>
          <p className="text-[13px] text-ink-muted mt-1 max-w-sm">Ask your KodeTalent admin to add your email to your college. Once added, sign out and back in.</p>
          <a href={`${basePath}/`} className="inline-block mt-4 text-[13px] font-bold text-brand">Back to KodeTalent →</a>
        </div>
      </FullScreen>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <TpoNav />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Switch>
          <Route path="/" component={TpoDashboard} />
          <Route path="/students/:id">{(p) => <TpoStudentDetail id={p.id} />}</Route>
          <Route path="/track" component={TpoTrackEditor} />
          <Route><Redirect to="/" /></Route>
        </Switch>
      </main>
    </div>
  );
}
