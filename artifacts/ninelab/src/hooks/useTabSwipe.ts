import { useEffect, type RefObject } from "react";
import { useLocation } from "wouter";
import { hapticTap } from "@/lib/haptics";
import { NAV_ITEMS } from "@/components/layout/navItems";

// Horizontal swipe in the main content area moves to the adjacent bottom-nav
// tab. v1 quick win: no follow-finger animation — the route change is instant
// by design, so a clean threshold-triggered navigation is all that's needed.

const TAB_HREFS = NAV_ITEMS.map((item) => item.href);

/** Edge zone reserved for the OS: Android back gesture + iOS back swipe. */
const EDGE_GUARD_PX = 24;
/** Minimum horizontal travel before a swipe counts. */
const MIN_DX_PX = 70;

/**
 * True when the touch started inside an element that scrolls horizontally
 * itself (carousels, chip rows, tables) — those own their horizontal gesture.
 * Walks up from the touch target to the listener boundary.
 */
function startsInHorizontalScroller(target: EventTarget | null, boundary: HTMLElement): boolean {
  let el: HTMLElement | null = target instanceof HTMLElement ? target : null;
  while (el && el !== boundary) {
    if (el.scrollWidth > el.clientWidth) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Attach to the layout's <main> element. Touch-only (touch events never fire
 * for mouse input, so desktop is unaffected) and passive (never blocks native
 * vertical scrolling). Swipes only fire when the CURRENT location is exactly
 * one of the 5 tab hrefs — nested pages (/practice/interview/:id etc.) never
 * swipe.
 */
export function useTabSwipe(ref: RefObject<HTMLElement | null>): void {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      tracking = false;
      // Only track when the current route is exactly a tab.
      if (!TAB_HREFS.includes(location)) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      // Edge zones belong to the platform's back gestures.
      if (t.clientX < EDGE_GUARD_PX || t.clientX > window.innerWidth - EDGE_GUARD_PX) return;
      const target = e.target;
      // Open sheets/dialogs own their gestures (drag-to-close etc.).
      if (target instanceof Element && target.closest('[role="dialog"]')) return;
      if (startsInHorizontalScroller(target, el)) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // Clearly horizontal only — anything ambiguous stays a scroll.
      if (Math.abs(dx) <= MIN_DX_PX || Math.abs(dx) <= 2 * Math.abs(dy)) return;
      const idx = TAB_HREFS.indexOf(location);
      if (idx === -1) return;
      // Swipe left → next tab, swipe right → previous. Clamp at ends, no wrap.
      const nextIdx = dx < 0 ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= TAB_HREFS.length) return;
      hapticTap();
      setLocation(TAB_HREFS[nextIdx]);
    };

    const onTouchCancel = () => {
      tracking = false;
    };

    // Passive: we never preventDefault, so scrolling stays fully native.
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [ref, location, setLocation]);
}
