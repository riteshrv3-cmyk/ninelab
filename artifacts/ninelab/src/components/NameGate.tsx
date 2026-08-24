import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";
import { useCreateStudent, type Student } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { apiFetch, setGuestToken } from "@/lib/api/authFetch";
import { notifyStudentChanged } from "@/hooks/useStudentId";
import { Input } from "@/components/ui/input";
import { Confetti } from "@/components/ninelab/Confetti";

// The single conversion gate. Anonymous visitors explore freely; the FIRST real
// action (generate a resume, enroll, start an interview, apply, edit profile)
// routes through here. We ask ONE thing — their name — create a guest row, then
// run the intended action in place. Signup (Clerk) still only happens later, at
// take-out moments (download/share/certificate).
//
// IMPORTANT for callers: the action you pass runs AFTER the guest row is
// created and `kt:student-changed` fires. Read the fresh studentId from
// localStorage INSIDE the action — do not close over a stale value.

interface RequireStudentOpts {
  /** Contextual sheet title, e.g. "Starting your interview". */
  title?: string;
  /** Optional sub-line under the title. */
  subtitle?: string;
}

interface NameGateContextValue {
  requireStudent: (run: () => void, opts?: RequireStudentOpts) => void;
}

const NameGateContext = createContext<NameGateContextValue | null>(null);

export function useNameGate(): NameGateContextValue {
  const ctx = useContext(NameGateContext);
  if (!ctx) throw new Error("useNameGate must be used within <NameGateProvider>");
  return ctx;
}

const DEFAULT_TITLE = "Let's get you started";
const DEFAULT_SUBTITLE = "That's all we need — you can add the details later.";

export function NameGateProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const reduce = useReducedMotion();
  const createStudent = useCreateStudent();

  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<RequireStudentOpts>({});
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<"ask" | "welcome">("ask");
  const [error, setError] = useState<string | null>(null);

  const pendingAction = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const requireStudent = useCallback(
    (run: () => void, o?: RequireStudentOpts) => {
      // Already have a student (guest or claimed) — run immediately, no gate.
      if (localStorage.getItem("studentId")) {
        run();
        return;
      }
      pendingAction.current = run;
      setOpts(o ?? {});
      setName(localStorage.getItem("studentName") ?? "");
      setPhase("ask");
      setError(null);
      setOpen(true);
      // Push a history entry so the hardware/browser Back button closes the
      // gate instead of navigating away (fix 14).
      try {
        history.pushState({ ktGate: true }, "");
      } catch {
        /* history may be unavailable in some embeds — non-fatal */
      }
    },
    [],
  );

  const closeGate = useCallback((viaPop = false) => {
    setOpen(false);
    pendingAction.current = null;
    // Consume the history entry we pushed, unless we're already handling a pop.
    if (!viaPop && history.state?.ktGate) {
      try {
        history.back();
      } catch {
        /* non-fatal */
      }
    }
  }, []);

  // Browser/hardware Back closes the gate rather than leaving the page.
  useEffect(() => {
    if (!open) return;
    const onPop = () => closeGate(true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, closeGate]);

  // Autofocus the field when the sheet opens.
  useEffect(() => {
    if (!(open && phase === "ask")) return;
    const t = setTimeout(() => inputRef.current?.focus(), reduce ? 0 : 120);
    return () => clearTimeout(t);
  }, [open, phase, reduce]);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      inputRef.current?.focus();
      return;
    }
    if (createStudent.isPending) return;
    setError(null);
    try {
      // Same body shape the deleted onboarding wizard used; the server mints the
      // guest email + token itself and ignores the placeholders.
      const student = (await createStudent.mutateAsync({
        data: {
          name: trimmed,
          email: "",
          college: "Not set",
          city: "Not set",
          year: 1,
          field: "Not set",
        },
      })) as Student & { guestToken?: string };

      localStorage.setItem("studentId", String(student.id));
      localStorage.setItem("studentName", trimmed);
      // One-shot handoff flag: Resume's capture step personalizes its header
      // ("Nice to meet you, {first} — one quick thing") so the gate and the
      // capture sheet read as one continuous flow. Consumed there.
      sessionStorage.setItem("kt:justCreated", "1");
      if (student.guestToken) setGuestToken(student.guestToken);

      // Relocated from the old wizard: claim a pending college invite now that
      // the student row exists.
      const inviteCode = sessionStorage.getItem("inviteCode");
      if (inviteCode) {
        try {
          await apiFetch(`/api/invite/${inviteCode}/claim`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ studentId: student.id }),
          });
        } catch {
          /* invite claim is best-effort; never block the student's action */
        }
        sessionStorage.removeItem("inviteCode");
        sessionStorage.removeItem("inviteCollegeName");
        sessionStorage.removeItem("inviteCollegeCity");
      }

      await queryClient.invalidateQueries();
      notifyStudentChanged();

      // Brief "Nice to meet you" beat (confetti + avatar), then run the
      // intended action in place. Reduced motion: 350ms, text only.
      setPhase("welcome");
      const action = pendingAction.current;
      pendingAction.current = null;
      setTimeout(
        () => {
          setOpen(false);
          if (history.state?.ktGate) {
            try {
              history.back();
            } catch {
              /* non-fatal */
            }
          }
          action?.();
        },
        reduce ? 350 : 1300,
      );
    } catch {
      setError("Could not start your account. Please try again.");
    }
  }, [name, createStudent, reduce]);

  const title = opts.title ?? DEFAULT_TITLE;
  const subtitle = opts.subtitle ?? DEFAULT_SUBTITLE;
  const firstName = name.trim().split(/\s+/)[0] || "there";

  return (
    <NameGateContext.Provider value={{ requireStudent }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[70] flex items-end lg:items-center"
            onClick={() => closeGate()}
          >
            <motion.div
              initial={reduce ? false : { y: "100%" }}
              animate={{ y: 0 }}
              exit={reduce ? undefined : { y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              // Drag-to-close: pull the sheet down past the threshold (or
              // flick) to dismiss. Disabled under reduced motion, during the
              // welcome beat, and while the guest row is being created.
              drag={reduce || phase === "welcome" || createStudent.isPending ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 600) closeGate();
              }}
              className="w-full bg-paper rounded-t-3xl lg:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.12)] max-w-md lg:max-w-md mx-auto flex flex-col pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <div className="relative flex-shrink-0 pt-4">
                <div className="w-12 h-1.5 bg-line rounded-full mx-auto lg:hidden" />
              </div>

              {phase === "ask" ? (
                <div className="px-6 pt-4 space-y-4">
                  <div>
                    <h2 className="text-display text-2xl font-bold text-ink mb-1 text-balance">
                      {title}
                    </h2>
                    <p className="text-ink-muted text-sm">{subtitle}</p>
                  </div>

                  <div>
                    {/* No field label — the title/subtitle already carry the
                        ask; a label here repeated the question twice. */}
                    <Input
                      id="name-gate-input"
                      aria-label="Your name"
                      ref={inputRef}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void submit();
                        }
                      }}
                      placeholder="Your name"
                      autoComplete="given-name"
                      enterKeyHint="go"
                      className="rounded-xl border-2 border-line focus-visible:border-brand focus-visible:ring-0 h-12 text-ink font-medium text-[16px]"
                    />
                    {error && (
                      <p className="text-xs text-danger mt-1.5 ml-1" role="alert">
                        {error}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={createStudent.isPending}
                    className="w-full h-12 rounded-xl bg-brand text-white font-bold text-[15px] disabled:opacity-60 transition-opacity"
                  >
                    {createStudent.isPending ? "Setting up…" : "Continue"}
                  </button>

                  <p className="text-center text-[13px] text-ink-muted pb-1">
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="text-brand font-semibold"
                      onClick={() => {
                        closeGate();
                        setLocation("/sign-in");
                      }}
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              ) : (
                <div className="px-6 pt-6 pb-6 text-center space-y-2">
                  {/* z-[80] so the burst lands above this z-[70] sheet. */}
                  {!reduce && <Confetti zClass="z-[80]" />}
                  <motion.div
                    initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 18, stiffness: 300 }}
                    className="mx-auto w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center text-brand type-title font-bold"
                  >
                    {firstName[0]?.toUpperCase()}
                  </motion.div>
                  <h2 className="text-display type-title font-bold text-ink text-balance">
                    Nice to meet you, {firstName}
                  </h2>
                  <p className="type-caption text-ink-muted">Setting up your workspace…</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </NameGateContext.Provider>
  );
}
