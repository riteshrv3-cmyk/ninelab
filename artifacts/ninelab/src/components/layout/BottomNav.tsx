import { Link, useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./navItems";

/**
 * 5-tab shell (design v3 — Today leads). Prep = interviews + tests + courses.
 * Jobs = feed + drive-check + resume. Profile = profile + projects + resume
 * builder. Toko's chat becomes a floating bubble (tracked separately) rather
 * than a nav tab. lg+ (desktop) uses SideNav instead — this stays mobile/tablet only.
 */
export function BottomNav() {
  const [location] = useLocation();
  const reduced = useReducedMotion();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-line pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
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
              className="relative flex flex-col items-center justify-center w-full h-full gap-1"
            >
              {isActive && (
                <motion.div
                  layoutId="bottomnav-pill"
                  className="absolute inset-x-1.5 inset-y-1.5 rounded-2xl bg-brand-soft -z-10"
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className={cn("h-[22px] w-[22px]", isActive ? "text-brand" : "text-ink-muted")} strokeWidth={isActive ? 2.4 : 2} />
              <span className={cn("type-micro font-semibold whitespace-nowrap", isActive ? "text-brand" : "text-ink-muted")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
