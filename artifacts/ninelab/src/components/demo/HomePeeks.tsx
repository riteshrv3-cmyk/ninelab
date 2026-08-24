import type { ComponentType } from "react";
import { ArrowRight } from "lucide-react";
import { hapticTap } from "@/lib/haptics";
import { scoreBadgeClass, scoreTextClass } from "@/lib/scoreTone";
import {
  DEMO_PROFILE,
  DEMO_RESUMES,
  DEMO_INTERVIEW_REPORT,
  DEMO_ENROLLMENT,
  DEMO_MATCHED_TEASER,
} from "@/data/demoStudent";

// Peek-sheet content for the explore-home feature cards. In DEMO mode a card
// tap opens a PeekSheet with a compact live preview of the feature (Priya's
// fixtures) instead of navigating cold — the visitor sees what's inside
// BEFORE committing to the page. Rendered inside the shared <PeekSheet>;
// this module owns only the content, not the sheet chrome.

export type PeekFeature = "jobs" | "resume" | "practice" | "courses" | "profile";

export const PEEK_FEATURE_LABEL: Record<PeekFeature, string> = {
  jobs: "Jobs",
  resume: "Resume",
  practice: "Practice",
  courses: "Courses",
  profile: "Profile",
};

function Eyebrow({ feature }: { feature: PeekFeature }) {
  return (
    <p className="type-micro font-bold uppercase tracking-wider text-ink-muted">
      Peek — {PEEK_FEATURE_LABEL[feature]}
    </p>
  );
}

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div
      className="h-2 rounded-full bg-line overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  );
}

function JobsPeek() {
  return (
    <div className="space-y-2.5">
      {DEMO_MATCHED_TEASER.map((job) => (
        <div
          key={`${job.company}-${job.role}`}
          className="rounded-2xl border border-line p-3.5 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="type-body font-bold text-ink leading-tight truncate">{job.role}</p>
            <p className="type-caption text-ink-muted mt-0.5 truncate">
              {job.company} · {job.location}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 type-micro font-bold ${scoreBadgeClass(job.matchPct)}`}
          >
            {job.matchPct}% match
          </span>
        </div>
      ))}
      <p className="type-micro text-ink-muted pt-0.5">Real feed inside — updated daily.</p>
    </div>
  );
}

function ResumePeek() {
  const resume = DEMO_RESUMES[0];
  return (
    <div className="rounded-2xl border border-line p-4 space-y-3">
      <div className="flex items-center gap-3">
        <p className="flex-1 min-w-0 type-body font-bold text-ink leading-tight">
          {resume.title}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 type-micro font-bold ${scoreBadgeClass(resume.atsScore)}`}
        >
          ATS {resume.atsScore}
        </span>
      </div>
      <ul className="space-y-1.5">
        {resume.highlights.slice(0, 2).map((h) => (
          <li key={h} className="type-caption text-ink-muted leading-snug pl-3 relative">
            <span className="absolute left-0 top-[0.4em] w-1.5 h-1.5 rounded-full bg-brand-soft" aria-hidden />
            {h}
          </li>
        ))}
      </ul>
      <p className="type-micro text-ink-muted">{resume.howCaption}</p>
    </div>
  );
}

function PracticePeek() {
  const report = DEMO_INTERVIEW_REPORT;
  const pct = report.overallScore * 10;
  return (
    <div className="rounded-2xl border border-line p-4 space-y-3">
      <div className="flex items-baseline gap-2">
        <span className={`type-title font-extrabold ${scoreTextClass(pct)}`}>
          {report.overallScore}/10
        </span>
        <span className="type-caption text-ink-muted">
          {report.company} {report.role} · {report.round} mock
        </span>
      </div>
      <div className="space-y-2">
        <p className="type-caption text-ink leading-snug">
          <span className="font-bold text-done-ink">Strong: </span>
          {report.strongPoint}
        </p>
        <p className="type-caption text-ink leading-snug">
          <span className="font-bold text-amber-ink">Work on: </span>
          {report.weakPoint}
        </p>
      </div>
    </div>
  );
}

function CoursesPeek() {
  const e = DEMO_ENROLLMENT;
  return (
    <div className="rounded-2xl border border-line p-4 space-y-3">
      <div>
        <p className="type-body font-bold text-ink leading-tight">{e.subDomainName}</p>
        <p className="type-caption text-ink-muted mt-0.5">{e.domainName}</p>
      </div>
      <ProgressBar pct={e.progressPct} label={`${e.subDomainName} progress`} />
      <p className="type-caption text-ink-muted">
        {e.completedModules} of {e.totalModules} modules done · {e.progressPct}%
      </p>
    </div>
  );
}

function ProfilePeek() {
  const topSkills = Object.entries(DEMO_PROFILE.skills)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  return (
    <div className="rounded-2xl border border-line p-4 space-y-3">
      <div>
        <p className="type-body font-bold text-ink leading-tight">{DEMO_PROFILE.name}</p>
        <p className="type-caption text-ink-muted mt-0.5">{DEMO_PROFILE.college}</p>
      </div>
      <div className="space-y-2">
        {topSkills.map(([skill, pct]) => (
          <div key={skill} className="flex items-center gap-2.5">
            <span className="w-24 shrink-0 type-caption font-semibold text-ink truncate">
              {skill}
            </span>
            <div className="flex-1">
              <ProgressBar pct={pct} label={`${skill} level`} />
            </div>
            <span className="w-7 shrink-0 text-right type-micro text-ink-muted">{pct}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PEEK_BODY: Record<PeekFeature, ComponentType> = {
  jobs: JobsPeek,
  resume: ResumePeek,
  practice: PracticePeek,
  courses: CoursesPeek,
  profile: ProfilePeek,
};

/**
 * Body of a home-card peek sheet: eyebrow, compact fixture preview, and a
 * full-width brand CTA. `onOpen` navigates to the feature's page (the caller
 * owns routing — this component never touches wouter itself).
 */
export function HomePeekContent({
  feature,
  onOpen,
}: {
  feature: PeekFeature;
  onOpen: () => void;
}) {
  const Body = PEEK_BODY[feature];
  return (
    <div className="pt-2 space-y-4">
      <Eyebrow feature={feature} />
      <Body />
      <button
        type="button"
        onClick={() => {
          hapticTap();
          onOpen();
        }}
        className="w-full h-12 rounded-xl bg-brand text-white type-body font-bold flex items-center justify-center gap-1.5"
        data-testid={`peek-open-${feature}`}
      >
        Open {PEEK_FEATURE_LABEL[feature]}
        <ArrowRight className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
