import { Link, useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import { Toko } from "@/components/ninelab/Toko";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./navItems";
import { useStudentId } from "@/hooks/useStudentId";

interface SideNavProps {
  initials: string;
  streakCount: number;
  onProfileClick: () => void;
}

/**
 * Desktop-only (lg+) left sidebar. Takes over the navigation role BottomNav +
 * TopBar carry on mobile (both are `lg:hidden`): same routes via the shared
 * NAV_ITEMS, plus Toko which lives in TokoBubble on mobile.
 * The bottom avatar chip opens the same ProfileSidebar drawer as the TopBar
 * avatar button does on mobile — it's account/logout, not the /profile page
 * (that's the "Profile" nav item above it).
 */
export function SideNav({ initials, streakCount, onProfileClick }: SideNavProps) {
  const [location, setLocation] = useLocation();
  const reduced = useReducedMotion();
  const { isDemo } = useStudentId();

  return (
    <div className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] flex-col bg-paper border-r border-line z-40">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <span className="text-lg tracking-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>
          ninelab
        </span>
        {streakCount > 0 && (
          <button
            type="button"
            onClick={() => setLocation("/home")}
            className="inline-flex items-center gap-1 rounded-full bg-highlight/10 px-2 py-1"
            aria-label={`${streakCount} day streak`}
          >
            <Flame className="w-3.5 h-3.5 text-highlight" fill="currentColor" />
            <span className="text-[13px] font-bold text-highlight tabular-nums">{streakCount}</span>
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          // "/" is Home and must match EXACTLY — startsWith("/") is every
          // route, which would light Home up everywhere. Other tabs keep the
          // exact-or-nested match so /opportunities/course still marks Jobs.
          const isActive =
            item.href === "/"
              ? location === "/"
              : location === item.href || location.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-colors",
                isActive ? "text-brand" : "text-ink-muted hover:bg-line/60",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidenav-pill"
                  className="absolute inset-0 rounded-xl bg-brand-soft -z-10"
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setLocation("/chat")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold text-ink-muted hover:bg-line/60 transition-colors"
        >
          <Toko size={20} />
          Chat with Toko
        </button>
      </nav>

      <div className="px-3 pb-6">
        {isDemo ? (
          // Anonymous explore-mode visitor: no account to open — offer a
          // prominent sign-in instead (mirrors the TopBar's mobile treatment).
          <button
            type="button"
            onClick={() => setLocation("/sign-in")}
            className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl bg-brand text-white type-body font-bold hover:bg-brand/90 transition-colors"
          >
            Sign in
          </button>
        ) : (
          <button
            type="button"
            onClick={onProfileClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-line/60 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center text-brand font-bold text-[13px] shrink-0">
              {initials}
            </span>
            <span className="type-caption font-semibold text-ink">Account</span>
          </button>
        )}
      </div>
    </div>
  );
}
