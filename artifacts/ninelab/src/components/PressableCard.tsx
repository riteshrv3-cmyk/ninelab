import { forwardRef, type ReactNode, type MouseEventHandler } from "react";
import { motion, useReducedMotion } from "framer-motion";

// The app's ONE press response. Every tappable card (home feature cards,
// interview-library rows, domain tiles) renders through this so pressing
// anything in ninelab feels identical: a quick 0.98 scale (skipped under
// reduced motion), a visible keyboard focus ring, and a guaranteed 44px
// minimum target. Visual skin stays caller-owned via className — this
// standardizes behavior, not looks.

interface PressableCardProps {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  children: ReactNode;
  "data-testid"?: string;
  "aria-label"?: string;
  disabled?: boolean;
}

export const PressableCard = forwardRef<HTMLButtonElement, PressableCardProps>(
  function PressableCard(
    { onClick, className = "", children, disabled, ...rest },
    ref,
  ) {
    const reduce = useReducedMotion();
    return (
      <motion.button
        ref={ref}
        type="button"
        whileTap={reduce || disabled ? undefined : { scale: 0.98 }}
        onClick={onClick}
        disabled={disabled}
        className={`text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${className}`}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);
