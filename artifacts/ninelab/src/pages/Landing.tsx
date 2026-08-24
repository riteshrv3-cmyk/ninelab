import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  FileText,
  Mic,
  GraduationCap,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PressableCard } from "@/components/PressableCard";
import { hapticTap } from "@/lib/haptics";

// First-visit landing. Shows the product before the app: credibility page for
// students, parents, TPOs and recruiters who want to read before touching.
// Seen ONCE per device — the Explore CTA (or any prior visit that entered the
// app) sets `kt:entered`, after which "/" goes straight to the explore home
// (see HomeGate in App.tsx). Marketing voice: the `.marketing` wrapper gives
// lowercase display-face headlines (index.css), body copy stays sentence case.
// No load animations — this page renders instantly static; interactivity
// (rotating phone, sticky CTA, press states) layers on top of that.

const FEATURES = [
  {
    icon: FileText,
    title: "AI resume",
    desc: "Built from your real work — GitHub, projects, internships. ATS-checked, no fluff.",
  },
  {
    icon: Mic,
    title: "Mock interviews",
    desc: "A voice AI interviewer that asks real questions and scores you honestly.",
  },
  {
    icon: GraduationCap,
    title: "Courses + certificates",
    desc: "Quiz-gated courses that end in a verifiable certificate — exam plus AI interview, earned not given.",
  },
  {
    icon: Briefcase,
    title: "Real jobs",
    desc: "Fresher-friendly openings and internships, India-first, updated daily.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "look around",
    desc: "Open the app and explore everything through a sample student — no signup, no forms.",
  },
  {
    n: "2",
    title: "do it for real",
    desc: "The first time you act, we ask one thing: your name. That's the whole onboarding.",
  },
  {
    n: "3",
    title: "walk out with proof",
    desc: "A resume that's really you, and a certificate anyone can verify with a link.",
  },
];

// Hero phone screens, in rotation order. All three are mounted (stacked)
// so every frame is decoded before it's shown — no flash on rotate.
const SCREENS = [
  { src: "/landing/shot-home.jpg", alt: "ninelab app home" },
  { src: "/landing/shot-practice.jpg", alt: "Mock interview practice screen" },
  { src: "/landing/shot-resume.jpg", alt: "AI resume screen" },
];

const ROTATE_MS = 3500;
const MANUAL_PAUSE_MS = 8000;
const SWIPE_THRESHOLD_PX = 40;

// Auto-rotating hero phone. Ambient rotation is allowed here (marketing page,
// lightweight, single element); it goes fully static under reduced motion —
// no auto-advance, no crossfade — while dots still swap screens instantly.
function PhoneFrame() {
  const reduce = useReducedMotion();
  const [screen, setScreen] = useState(0);
  // Any manual interaction (dot tap, swipe) pauses auto-rotation until this
  // timestamp; the interval keeps ticking and simply skips while paused.
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      setScreen((s) => (s + 1) % SCREENS.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [reduce]);

  const goTo = (i: number) => {
    pausedUntilRef.current = Date.now() + MANUAL_PAUSE_MS;
    hapticTap();
    setScreen(((i % SCREENS.length) + SCREENS.length) % SCREENS.length);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-[270px] rounded-[2.2rem] border-[6px] border-ink bg-ink shadow-[0_24px_60px_rgba(26,29,46,0.25)] overflow-hidden">
        <motion.div
          className="relative w-full aspect-[360/780] select-none touch-pan-y"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={(_e, info) => {
            if (Math.abs(info.offset.x) < SWIPE_THRESHOLD_PX) return;
            goTo(screen + (info.offset.x < 0 ? 1 : -1));
          }}
        >
          {SCREENS.map((s, i) => (
            <motion.img
              key={s.src}
              src={s.src}
              alt={s.alt}
              width={360}
              height={780}
              draggable={false}
              aria-hidden={i !== screen}
              className="absolute inset-0 w-full h-full block pointer-events-none"
              initial={false}
              animate={{ opacity: i === screen ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : 0.45, ease: "easeInOut" }}
            />
          ))}
        </motion.div>
      </div>
      <div className="mt-4 flex items-center justify-center" role="group" aria-label="Choose app screen">
        {SCREENS.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show screen: ${s.alt}`}
            aria-current={i === screen}
            className="p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-full"
          >
            <span
              className={`block w-2 h-2 rounded-full ${
                i === screen ? "bg-brand" : "bg-line"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Landing({ onEnter }: { onEnter: () => void }) {
  const [, setLocation] = useLocation();
  const reduce = useReducedMotion();

  // Sticky bottom CTA: appears whenever the hero CTA is scrolled out of view.
  const heroCtaRef = useRef<HTMLButtonElement>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    const el = heroCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const enter = () => {
    localStorage.setItem("kt:entered", "1");
    onEnter();
  };

  const tapEnter = () => {
    hapticTap();
    enter();
  };

  const tapSignIn = () => {
    hapticTap();
    setLocation("/sign-in");
  };

  return (
    <div className="marketing min-h-[100dvh] bg-paper">
      {/* Header */}
      <header className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
        <span className="text-display font-extrabold text-ink text-[20px]">
          ninelab
        </span>
        <PressableCard
          onClick={tapSignIn}
          className="type-caption font-bold text-brand rounded-full border border-line px-4 py-2 inline-flex items-center"
        >
          Sign in
        </PressableCard>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-8 pb-14 lg:pt-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-[38px] lg:text-[52px] leading-[1.05] text-ink text-balance">
            crack placements.
            <br />
            see the app first.
          </h1>
          <p className="type-body text-ink-muted mt-4 max-w-[46ch]">
            Resume, AI mock interviews, courses with verifiable certificates,
            and real jobs — one app for placement season. Explore all of it
            before you even sign up.
          </p>
          <div className="mt-7 flex items-center gap-4 flex-wrap">
            <PressableCard
              ref={heroCtaRef}
              onClick={tapEnter}
              data-testid="landing-explore-cta"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-brand text-white type-body font-bold"
            >
              Explore the app free <ArrowRight className="w-4 h-4" />
            </PressableCard>
            <span className="type-caption text-ink-muted">
              No account needed to look around.
            </span>
          </div>
        </div>

        {/* Phone frame — the real app, not a mockup */}
        <div className="flex justify-center lg:justify-end">
          <PhoneFrame />
        </div>
      </section>

      {/* Feature row */}
      <section className="bg-canvas py-14">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-[26px] lg:text-[32px] text-ink mb-8">
            everything placement season asks of you.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <PressableCard
                key={f.title}
                onClick={tapEnter}
                aria-label={`${f.title} — explore the app`}
                className="bg-paper rounded-2xl p-5 shadow-soft w-full block"
              >
                <span className="w-11 h-11 rounded-xl bg-brand-soft flex items-center justify-center text-brand mb-3">
                  <f.icon className="w-5 h-5" />
                </span>
                <h3 className="type-body font-bold text-ink">{f.title}</h3>
                <p className="type-caption text-ink-muted mt-1">{f.desc}</p>
              </PressableCard>
            ))}
          </div>

          {/* Two supporting screens */}
          <div className="mt-10 grid grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="rounded-2xl border border-line overflow-hidden bg-paper shadow-soft">
              <img
                src="/landing/shot-practice.jpg"
                alt="Mock interview practice screen"
                className="w-full block"
                width={360}
                height={780}
                loading="lazy"
              />
            </div>
            <div className="rounded-2xl border border-line overflow-hidden bg-paper shadow-soft">
              <img
                src="/landing/shot-resume.jpg"
                alt="AI resume screen"
                className="w-full block"
                width={360}
                height={780}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-[26px] lg:text-[32px] text-ink mb-8">
            three steps, zero friction.
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-line p-5">
                <span className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center font-extrabold type-body mb-3">
                  {s.n}
                </span>
                <h3 className="type-body font-bold text-ink">{s.title}</h3>
                <p className="type-caption text-ink-muted mt-1">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <PressableCard
              onClick={tapEnter}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-brand text-white type-body font-bold"
            >
              Explore the app free <ArrowRight className="w-4 h-4" />
            </PressableCard>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between flex-wrap gap-3">
          <span className="type-caption text-ink-muted">
            ninelab — built for Indian engineering students.
          </span>
          <PressableCard
            onClick={tapSignIn}
            className="type-caption font-bold text-brand inline-flex items-center"
          >
            Sign in
          </PressableCard>
        </div>
      </footer>

      {/* Sticky CTA — slides in once the hero CTA scrolls out of view.
          User-scroll-triggered, so the motion is allowed; instant under
          reduced motion. */}
      <AnimatePresence initial={false}>
        {showStickyCta && (
          <motion.div
            initial={{ y: reduce ? 0 : "100%" }}
            animate={{ y: 0 }}
            exit={{ y: reduce ? 0 : "100%" }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "tween", duration: 0.25, ease: "easeOut" }
            }
            className="fixed bottom-0 left-0 right-0 z-40 bg-paper border-t border-line"
          >
            <div className="max-w-5xl mx-auto px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <PressableCard
                onClick={tapEnter}
                data-testid="landing-sticky-cta"
                className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-brand text-white type-body font-bold"
              >
                Explore the app free <ArrowRight className="w-4 h-4" />
              </PressableCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
