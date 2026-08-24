import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { useLocation } from "wouter";
import {
  Briefcase,
  FileText,
  Target,
  GraduationCap,
  User,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { ClaimOnSignIn } from "@/components/ClaimOnSignIn";
import { PageHeader } from "@/components/PageHeader";
import { DemoSurface } from "@/components/DemoBanner";
import { PressableCard } from "@/components/PressableCard";
import { PeekSheet } from "@/components/PeekSheet";
import {
  HomePeekContent,
  PEEK_FEATURE_LABEL,
  type PeekFeature,
} from "@/components/demo/HomePeeks";
import { hapticTap } from "@/lib/haptics";
import { scoreTextClass } from "@/lib/scoreTone";
import { useStudentId } from "@/hooks/useStudentId";
import {
  DEMO_PROFILE,
  DEMO_RESUMES,
  DEMO_INTERVIEW_REPORT,
  DEMO_ENROLLMENT,
  DEMO_MATCHED_TEASER,
} from "@/data/demoStudent";

// Explore-first home. ninelab.in opens straight here — anonymous visitors
// browse in DEMO mode (sample student "Priya Sharma"), and the first real
// action routes through the NameGate. This is a feature-cards launcher, NOT a
// momentum hub: no daily strip, no streak, no tasks, and NO load animation —
// perceived speed matters, so nothing animates on first paint.
//
// Interaction model:
//  - DEMO mode: tapping a card opens a PeekSheet preview of that feature
//    (Priya's fixtures) instead of navigating cold; the sheet's CTA navigates.
//  - REAL mode: cards navigate directly, and a "Continue" chip (last activity,
//    written by the feature pages to localStorage) sits above the cards.
//  - The Priya state line on each card is its OWN deep-link tap target.

interface FeatureCard {
  key: PeekFeature;
  title: string;
  valueProp: string;
  icon: ElementType;
  href: string;
  /** Live "state" line under the value prop (Priya's data in demo mode). */
  state: ReactNode | null;
}

/**
 * The card's state line as its own tap target (deep link straight into the
 * feature). Rendered INSIDE the PressableCard button, so it must not be a
 * <button> (nested buttons are invalid HTML) — a span with role="link",
 * keyboard handling and stopPropagation keeps the card's own onClick out of
 * the way while staying tsc- and a11y-clean.
 */
function TeaserLink({
  href,
  className = "",
  testid,
  children,
}: {
  href: string;
  className?: string;
  testid?: string;
  children: ReactNode;
}) {
  const [, setLocation] = useLocation();
  const go = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    hapticTap();
    setLocation(href);
  };
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") go(e);
      }}
      data-testid={testid}
      className={`text-brand underline-offset-2 hover:underline active:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm ${className}`}
    >
      {children}
    </span>
  );
}

/** `kt:lastActivity` is written by Resume/Prep/Course pages. */
function readLastActivity(): { label: string; href: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("kt:lastActivity");
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof (parsed as { label?: unknown }).label === "string" &&
      typeof (parsed as { href?: unknown }).href === "string"
    ) {
      return parsed as { label: string; href: string };
    }
  } catch {
    /* malformed JSON — treat as absent */
  }
  return null;
}

export default function ExploreHome() {
  const [, setLocation] = useLocation();
  const { isDemo } = useStudentId();
  const [peek, setPeek] = useState<PeekFeature | null>(null);

  // Real mode stays cheap: no new API calls on the home surface. The only
  // dynamic bits are the guest's own name and the last-activity chip, both
  // already in localStorage (no fetch).
  const firstName =
    typeof window !== "undefined"
      ? (localStorage.getItem("studentName") ?? "").trim().split(/\s+/)[0]
      : "";
  const lastActivity = !isDemo ? readLastActivity() : null;

  const jobs: FeatureCard = {
    key: "jobs",
    title: "Jobs",
    valueProp: "Real jobs, internships and freelance work — updated daily.",
    icon: Briefcase,
    href: "/opportunities",
    state: isDemo
      ? `${DEMO_MATCHED_TEASER.length} roles match Priya`
      : "Live roles, updated daily",
  };

  const rest: FeatureCard[] = [
    {
      key: "resume",
      title: "Resume",
      valueProp: "Build an ATS-friendly resume from your GitHub.",
      icon: FileText,
      href: "/resume",
      state: isDemo ? (
        <>
          Priya's resume · ATS{" "}
          <span className={scoreTextClass(DEMO_RESUMES[0].atsScore)}>
            {DEMO_RESUMES[0].atsScore}
          </span>
        </>
      ) : null,
    },
    {
      key: "practice",
      title: "Practice",
      valueProp: "Mock interviews with an AI interviewer, scored.",
      icon: Target,
      href: "/practice",
      state: isDemo ? (
        <>
          Last mock{" "}
          <span className={scoreTextClass(DEMO_INTERVIEW_REPORT.overallScore * 10)}>
            {DEMO_INTERVIEW_REPORT.overallScore}/10
          </span>
        </>
      ) : null,
    },
    {
      key: "courses",
      title: "Courses",
      valueProp: "Short tracks for the skills your role needs.",
      icon: GraduationCap,
      href: "/practice/courses",
      state: isDemo
        ? `${DEMO_ENROLLMENT.subDomainName} · ${DEMO_ENROLLMENT.progressPct}%`
        : null,
    },
    {
      key: "profile",
      title: "Profile",
      valueProp: "Your evidence — projects, skills and links.",
      icon: User,
      href: "/profile",
      state: isDemo
        ? `${DEMO_PROFILE.name} · ${DEMO_PROFILE.field}`
        : firstName
          ? `Signed in as ${firstName}`
          : null,
    },
  ];

  const allCards = [jobs, ...rest];

  // DEMO: peek first (never navigate cold, never call authed endpoints).
  // REAL: navigate directly, like any launcher.
  const onCardTap = (card: FeatureCard) => {
    if (isDemo) {
      hapticTap();
      setPeek(card.key);
    } else {
      setLocation(card.href);
    }
  };

  const peekCard = peek ? allCards.find((c) => c.key === peek) : undefined;

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <ClaimOnSignIn />

      <PageHeader
        title="Everything for placement season."
        subtitle="Free for students. Explore first — no signup needed."
      />

      {/* Content sheet flow: the DemoBanner (rendered by DemoSurface) is the
          first element INSIDE the cards container, not overlapping the canopy
          edge. DemoSurface also suppresses per-card SampleChips — one demo
          signal per surface; Priya's state lines stay in text-brand instead. */}
      <div className="px-4 -mt-6 max-w-md lg:max-w-2xl mx-auto space-y-3">
        {/* Continue chip — real mode only, from the last feature page visited. */}
        {lastActivity && (
          <PressableCard
            onClick={() => {
              hapticTap();
              setLocation(lastActivity.href);
            }}
            className="w-full bg-brand-soft rounded-xl px-3.5 py-2.5 flex items-center gap-2"
            data-testid="continue-chip"
          >
            <span className="flex-1 min-w-0 type-caption font-semibold text-brand truncate">
              Continue — {lastActivity.label}
            </span>
            <ArrowRight className="w-4 h-4 text-brand shrink-0" aria-hidden />
          </PressableCard>
        )}

        <DemoSurface>
          {/* Jobs — the visual anchor. Real content with zero input, so it's
              the obvious first tap. Paper, not brand: against the indigo
              canopy a white card pops MORE than brand-on-brand did, and it
              breaks the "indigo wall" that made the top of the page read as
              an official portal. Hierarchy is carried by size (full-width,
              larger icon and title), not by hue. */}
          <PressableCard
            onClick={() => onCardTap(jobs)}
            className="w-full bg-paper rounded-3xl p-5 lg:p-6 shadow-soft flex items-center gap-4"
            data-testid="explore-card-jobs"
          >
            <span className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center shrink-0">
              <jobs.icon className="w-7 h-7 text-brand" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block type-title font-extrabold text-ink">{jobs.title}</span>
              <span className="block type-caption text-ink-muted mt-0.5">{jobs.valueProp}</span>
              <span className="block type-caption mt-1.5">
                <TeaserLink
                  href={jobs.href}
                  className="font-semibold"
                  testid="explore-teaser-jobs"
                >
                  {jobs.state}
                </TeaserLink>
              </span>
            </span>
            <ChevronRight className="w-6 h-6 text-ink-muted shrink-0" />
          </PressableCard>

          {/* Remaining features — secondary weight, 2-up on desktop. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {rest.map((card) => {
              const Icon = card.icon;
              return (
                <PressableCard
                  key={card.key}
                  onClick={() => onCardTap(card)}
                  className="w-full bg-paper rounded-2xl p-4 lg:p-5 shadow-soft flex items-center gap-3.5"
                  data-testid={`explore-card-${card.key}`}
                >
                  <span className="w-11 h-11 rounded-xl bg-brand-soft flex items-center justify-center text-brand shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block type-body font-bold text-ink leading-tight">{card.title}</span>
                    <span className="block type-caption text-ink-muted mt-0.5">{card.valueProp}</span>
                    {card.state && (
                      <span className="block type-micro mt-1">
                        <TeaserLink
                          href={card.href}
                          className="font-semibold"
                          testid={`explore-teaser-${card.key}`}
                        >
                          {card.state}
                        </TeaserLink>
                      </span>
                    )}
                  </span>
                  <ChevronRight className="w-5 h-5 text-ink-muted shrink-0" />
                </PressableCard>
              );
            })}
          </div>
        </DemoSurface>
      </div>

      {/* Demo-mode card peeks: preview the feature before entering it. */}
      <PeekSheet
        open={peek !== null}
        onClose={() => setPeek(null)}
        ariaLabel={peek ? `${PEEK_FEATURE_LABEL[peek]} preview` : "Feature preview"}
      >
        {peek && peekCard && (
          <HomePeekContent
            feature={peek}
            onOpen={() => {
              setPeek(null);
              setLocation(peekCard.href);
            }}
          />
        )}
      </PeekSheet>
    </div>
  );
}
