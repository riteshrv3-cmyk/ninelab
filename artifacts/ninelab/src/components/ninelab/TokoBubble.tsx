import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Toko } from "./Toko";

const HIDDEN_ON = ["/chat"];
const HIDDEN_PREFIXES = ["/practice/interview/"];

/**
 * Floating action button that opens Toko chat. Hidden on /chat itself and
 * fullscreen routes.
 *
 * Placement: seated ABOVE the BottomNav on mobile (nav h-16 = 4rem, plus
 * safe-area, plus a 1rem/16px clearance gap above the nav's top edge) so it
 * never covers page content or the nav; 48px on mobile (the BottomNav
 * breakpoint — `lg`, matching BottomNav's own `lg:hidden` — not the generic
 * 768px "desktop" cutoff, since the tab bar stays visible up to `lg`), full
 * 56px on lg+ where there is no bottom nav and it sits in the corner with a
 * 24px bottom/right margin.
 *
 * Scroll behavior: hides while the user scrolls down (content is what they
 * came for), reappears on scroll-up or after ~800ms of idle. Passive
 * listener + rAF; under reduced motion the show/hide is instant.
 */
export function TokoBubble() {
  const [location, setLocation] = useLocation();
  const reduced = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // Small dead zone so micro-jitter doesn't flicker the bubble.
        if (y > lastY.current + 4 && y > 32) setHidden(true);
        else if (y < lastY.current - 4) setHidden(false);
        lastY.current = y;
        ticking.current = false;
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => setHidden(false), 800);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  if (HIDDEN_ON.includes(location) || HIDDEN_PREFIXES.some((p) => location.startsWith(p))) return null;

  return (
    <button
      type="button"
      data-testid="toko-bubble"
      onClick={() => setLocation("/chat")}
      aria-label="Chat with Toko"
      className={cn(
        // Mobile: 48px, seated above BottomNav (h-16 = 4rem + safe-area)
        // with a 1rem/16px clearance gap above the nav's top edge.
        // Desktop (no bottom nav): full 56px, 24px bottom/right corner offset.
        "fixed right-4 lg:right-6 z-30 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-brand flex items-center justify-center shadow-[0_10px_28px_rgba(74,85,199,0.35)] active:scale-95",
        "bottom-[calc(5rem+2px+env(safe-area-inset-bottom))] lg:bottom-6",
        !reduced && "transition-[transform,opacity] duration-200",
        hidden && "translate-y-24 opacity-0 pointer-events-none",
      )}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      <span className="lg:hidden">
        <Toko size={24} />
      </span>
      <span className="hidden lg:block">
        <Toko size={30} />
      </span>
    </button>
  );
}
