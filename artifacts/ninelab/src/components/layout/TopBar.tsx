import { useLocation } from "wouter";
import { ChevronLeft, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { useStudentId } from "@/hooks/useStudentId";
import { NAV_ITEMS } from "./navItems";

interface TopBarProps {
  initials: string;
  streakCount: number;
  onProfileClick: () => void;
}

// Tab-level destinations never show a back arrow: every bottom-nav route,
// the "/home" momentum hub, and the course library (a peer tab surface).
// Genuinely nested routes (e.g. /practice/history) keep back.
const NO_BACK_ROUTES = new Set<string>([
  ...NAV_ITEMS.map((item) => item.href),
  "/home",
  "/practice/courses",
]);

export function TopBar({ initials, streakCount, onProfileClick }: TopBarProps) {
  const [location, setLocation] = useLocation();
  const { isDemo } = useStudentId();
  const showBack = !NO_BACK_ROUTES.has(location);

  // First name, when we have it, so a returning guest sees themselves rather
  // than a bare avatar. studentName is written by the NameGate on guest create.
  const firstName =
    typeof window !== "undefined"
      ? (localStorage.getItem("studentName") ?? "").trim().split(/\s+/)[0]
      : "";

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  return (
    // paddingTop clears the status bar / notch: the page now uses
    // viewport-fit=cover, so a fixed top-0 bar starts at the physical top of
    // the screen rather than below the system UI. The bar's own background
    // fills that strip, which is what we want.
    <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-paper/90 backdrop-blur-md border-b border-line" style={{ transform: "translateZ(0)", backfaceVisibility: "hidden", willChange: "transform", paddingTop: "env(safe-area-inset-top)" }}>
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBack && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={goBack}
              className="w-8 h-8 rounded-xl flex items-center justify-center active:bg-line/60 transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5 text-ink" />
            </motion.button>
          )}
          <span className="font-extrabold text-ink text-lg tracking-tight">ninelab</span>
        </div>

        <div className="flex items-center gap-3">
          {isDemo ? (
            // Anonymous explore-mode visitor: no avatar to open, offer sign-in.
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setLocation("/sign-in")}
              className="h-8 px-3.5 rounded-full bg-brand text-white type-caption font-bold"
            >
              Sign in
            </motion.button>
          ) : (
            <>
              {streakCount > 0 && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setLocation("/home")}
                  className="inline-flex items-center gap-1 rounded-full bg-highlight/10 px-2.5 py-3.5"
                  aria-label={`${streakCount} day streak`}
                >
                  <Flame className="w-3.5 h-3.5 text-highlight" fill="currentColor" />
                  <span className="text-[13px] font-bold text-highlight tabular-nums">{streakCount}</span>
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onProfileClick}
                className="flex items-center gap-2"
                aria-label="Open account"
              >
                {firstName && (
                  <span className="text-[13px] font-bold text-ink max-w-[80px] truncate">{firstName}</span>
                )}
                <span className="w-9 h-9 rounded-full bg-brand-soft flex items-center justify-center text-brand font-bold text-[13px]">
                  {initials}
                </span>
              </motion.button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
