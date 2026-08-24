import { createContext, useContext, useState, type ReactNode } from "react";
import { Eye, ChevronRight } from "lucide-react";
import { useStudentId } from "@/hooks/useStudentId";
import { useNameGate } from "@/components/NameGate";
import { PeekSheet } from "@/components/PeekSheet";
import { hapticTap } from "@/lib/haptics";

// Explore-mode signposting, centralized. The design review found SAMPLE chips
// repeated 3x per screen — chip spam dilutes the signal. The rule now lives in
// one place: a surface declares demo mode ONCE (DemoSurface renders the banner
// and marks the subtree), and any <SampleChip/> rendered inside that subtree
// auto-suppresses. Chips only render standalone (outside a DemoSurface) where
// a lone card needs marking.

const DemoSurfaceContext = createContext(false);

/**
 * Wrap a page's demo-mode content. Renders the DemoBanner once (when in demo
 * mode) and suppresses all descendant SampleChips. In real mode it renders
 * children untouched.
 */
export function DemoSurface({
  children,
  banner = true,
  className = "",
}: {
  children: ReactNode;
  banner?: boolean;
  className?: string;
}) {
  const { isDemo } = useStudentId();
  if (!isDemo) return <>{children}</>;
  return (
    <DemoSurfaceContext.Provider value={true}>
      {banner && <DemoBanner className={className} />}
      {children}
    </DemoSurfaceContext.Provider>
  );
}

/**
 * The demo-mode banner is itself tappable: it opens a "Meet Priya" sheet that
 * explains what demo mode is and offers the NameGate as the way out. The sheet
 * state lives here so every page that renders the banner gets the behavior for
 * free. NOTE: every banner render site sits inside <NameGateProvider>
 * (AppLayout) — useNameGate is safe here.
 */
export function DemoBanner({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { requireStudent } = useNameGate();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          hapticTap();
          setOpen(true);
        }}
        className={`w-full text-left flex items-center gap-2 rounded-xl bg-brand-soft px-3.5 py-2.5 text-brand min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${className}`}
        data-testid="demo-banner"
      >
        <Eye className="w-4 h-4 flex-shrink-0" aria-hidden />
        {/* Explicit text-brand: a base element style would otherwise beat the
            inherited container color and render this ink-muted (audit-caught). */}
        <span className="flex-1 min-w-0 type-caption font-semibold leading-tight text-brand">
          You're viewing a sample student — tap any action to start your own.
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" aria-hidden />
      </button>

      <PeekSheet
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="Meet Priya — your sample student"
      >
        <div className="pt-2 space-y-4 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center text-brand type-title font-bold">
            PS
          </div>
          <div className="space-y-2">
            <h2 className="type-title font-bold text-ink text-balance">
              Meet Priya — your sample student
            </h2>
            <p className="type-caption text-ink-muted leading-snug">
              Everything you're seeing is her data — her resume, mock scores and
              matched jobs. Explore freely; the first time you do something
              real, we ask your name — that's all.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              hapticTap();
              setOpen(false);
              requireStudent(() => {}, { title: "Let's get you started" });
            }}
            className="w-full h-12 rounded-xl bg-brand text-white type-body font-bold"
            data-testid="demo-banner-start"
          >
            Start your own
          </button>
        </div>
      </PeekSheet>
    </>
  );
}

/**
 * Small "Sample" pill. Auto-suppressed inside a <DemoSurface> (the banner
 * already declares the mode there — one signal per surface).
 */
export function SampleChip({ className = "" }: { className?: string }) {
  const insideSurface = useContext(DemoSurfaceContext);
  if (insideSurface) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 type-micro font-bold uppercase tracking-wider text-brand ${className}`}
    >
      Sample
    </span>
  );
}
