import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { hapticTap } from "@/lib/haptics";

// The app's shared draggable bottom sheet. Used for home-card peeks and the
// "Meet Priya" card; the same interaction contract as the NameGate sheet:
//  - slides up on open (user-triggered motion — allowed; load motion is not)
//  - DRAG DOWN to dismiss (offset > 90px or a fast downward flick)
//  - backdrop tap closes; browser Back closes (history entry, like NameGate)
//  - reduced motion: no slide, no drag inertia — instant show/hide, close
//    affordances still work.

interface PeekSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel: string;
}

export function PeekSheet({ open, onClose, children, ariaLabel }: PeekSheetProps) {
  const reduce = useReducedMotion();

  // Back button closes the sheet instead of leaving the page.
  useEffect(() => {
    if (!open) return;
    try {
      history.pushState({ ktPeek: true }, "");
    } catch {
      /* non-fatal */
    }
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (history.state?.ktPeek) {
        try {
          history.back();
        } catch {
          /* non-fatal */
        }
      }
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[65] flex items-end lg:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduce ? undefined : { y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) {
                hapticTap();
                onClose();
              }
            }}
            className="w-full bg-paper rounded-t-3xl lg:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.12)] max-w-md mx-auto flex flex-col max-h-[85dvh] pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
          >
            {/* Grab handle — the visual invitation to drag down. */}
            <div className="flex-shrink-0 pt-3 pb-1">
              <div className="w-12 h-1.5 bg-line rounded-full mx-auto" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
