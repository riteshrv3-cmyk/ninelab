import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskRowProps {
  label: string;
  sublabel?: string;
  done: boolean;
  /** Exactly one row per screen should be `hot` — the single hero action. */
  hot?: boolean;
  ctaLabel?: string;
  /** Manual tasks (e.g. "review today's matches") can be checked directly. Omit for auto-completing tasks. */
  onToggle?: () => void;
  onAction: () => void;
}

/**
 * The one shared list-item primitive for the "Canopy" (v2) design system.
 * Used on Home's Today list, and reused as-is on Prep/Jobs/Profile. Each
 * task is its own soft-shadow card, matching the kit's booking/message rows.
 */
export function TaskRow({ label, sublabel, done, hot, ctaLabel, onToggle, onAction }: TaskRowProps) {
  return (
    <div className="flex items-center gap-3 bg-paper rounded-2xl shadow-soft p-4 mb-3">
      <button
        type="button"
        aria-label={done ? `Mark "${label}" as not done` : `Mark "${label}" as done`}
        aria-pressed={done}
        disabled={!onToggle}
        onClick={onToggle}
        className={cn(
          "shrink-0 w-[26px] h-[26px] rounded-lg border-[2.5px] flex items-center justify-center transition-colors",
          done ? "bg-done border-done" : "border-line",
          onToggle && !done && "active:border-brand",
        )}
      >
        {done && <Check className="w-4 h-4 text-paper" strokeWidth={3} />}
      </button>

      <button type="button" onClick={onAction} className="flex-1 min-w-0 text-left">
        <p className={cn("text-[16px] font-semibold leading-snug", done ? "text-ink-muted line-through" : "text-ink")}>
          {label}
        </p>
        {sublabel && <p className="text-[12px] text-ink-muted mt-0.5">{sublabel}</p>}
      </button>

      {hot && !done && ctaLabel && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 bg-brand text-white text-[13px] font-bold rounded-full px-4 py-2.5"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
