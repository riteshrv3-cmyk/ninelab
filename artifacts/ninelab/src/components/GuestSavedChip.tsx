import { useLocation } from "wouter";
import { CloudOff } from "lucide-react";

// Calm, honest indicator for GUEST accounts (a student row with no Clerk login):
// their work lives only on this device and is lost if storage is cleared. Shown
// in Profile and the profile sidebar with a one-tap upgrade to sign up.
// Render only when there IS a studentId but the account is not claimed.

export function GuestSavedChip({ className = "" }: { className?: string }) {
  const [, setLocation] = useLocation();
  return (
    <button
      type="button"
      onClick={() => setLocation("/sign-up")}
      className={`flex w-full items-center gap-2.5 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-left ${className}`}
    >
      <CloudOff className="w-4 h-4 flex-shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-ink leading-tight">
          Saved on this device
        </span>
        <span className="block text-[12px] text-ink-muted leading-tight">
          Sign up free to keep your progress everywhere.
        </span>
      </span>
      <span className="text-[13px] font-bold text-brand flex-shrink-0">Sign up</span>
    </button>
  );
}

/**
 * True when a student row exists locally but is a guest (not claimed by Clerk).
 * `clerkUserId` is written to localStorage only after a successful claim.
 */
export function useIsGuest(): boolean {
  const hasStudent = !!localStorage.getItem("studentId");
  const isClaimed = !!localStorage.getItem("clerkUserId");
  return hasStudent && !isClaimed;
}
