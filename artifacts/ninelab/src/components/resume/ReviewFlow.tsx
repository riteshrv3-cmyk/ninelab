import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, Download, Eye, FileText,
  Loader2, Sparkles, Undo2, Wand2, X,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  applyAutoFixes, buildQualityReport, shortenUrl, upgradeContent,
  type ContactLink, type QualityRuleResult, type ResumeDocument,
} from "@workspace/resume-core";
import { apiFetch } from "@/lib/api/authFetch";
import { resolveTemplateConfig } from "@/lib/resume-pdf";
import { ResumePreview } from "./ResumePreview";
import { downloadResumeDocx, downloadResumePDF, gateOnSignup } from "./download";
import type { SavedResume } from "./resumeTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepKey = "contact" | "summary" | "skills" | "experience" | "projects" | "education" | "certifications" | "achievements" | "finish";

interface UndoEntry {
  label: string;
  prevDoc: ResumeDocument;
}

interface QuantQuestion {
  id: string;
  prompt: string;
  unit: string;
  kind: string;
}

interface QuantItem {
  section: "experience" | "projects";
  entryIndex: number;
  bulletIndex: number;
  bulletText: string;
  questions: QuantQuestion[];
}

interface AiReviewResult {
  review: {
    sevenSecondRead: string;
    sectionNotes: { section: string; severity: "high" | "medium" | "low"; note: string }[];
    topFixes: string[];
  };
  band: string;
  percentileCopy: string;
  qualityScore: number;
  cached: boolean;
}

const STEP_LABELS: Record<StepKey, string> = {
  contact: "Contact",
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
  finish: "Final review",
};

const IMPROVABLE: StepKey[] = ["summary", "skills", "experience", "projects", "achievements"];

function docToPatchContent(doc: ResumeDocument): Record<string, unknown> {
  return {
    contact: doc.contact,
    headline: doc.headline,
    summary: doc.summary,
    order: doc.order,
    skillSections: doc.skillSections,
    experience: doc.experience,
    projects: doc.projects,
    education: doc.education,
    certifications: doc.certifications,
    achievements: doc.achievements,
  };
}

function isStepEmpty(doc: ResumeDocument, key: StepKey): boolean {
  switch (key) {
    case "summary": return !doc.summary.trim();
    case "skills": return doc.skillSections.length === 0;
    case "experience": return doc.experience.length === 0;
    case "projects": return doc.projects.length === 0;
    case "education": return doc.education.length === 0;
    case "certifications": return doc.certifications.length === 0;
    case "achievements": return doc.achievements.length === 0;
    default: return false;
  }
}

/** Rules anchored to a step: its own section, plus overall rules whose
 * offender paths live inside it. */
function rulesForStep(report: ReturnType<typeof buildQualityReport>, step: StepKey): QualityRuleResult[] {
  const failing = report.rules.filter(r => !r.passed && r.hint);
  if (step === "finish") {
    // Overall rules that no content step claimed via targets.
    return failing.filter(r => r.section === "overall" && r.targets.length === 0);
  }
  const prefixMap: Partial<Record<StepKey, string[]>> = {
    contact: ["contact", "headline"],
    summary: ["summary"],
    skills: ["skillSections"],
    experience: ["experience"],
    projects: ["projects"],
    education: ["education"],
    achievements: ["achievements"],
  };
  const prefixes = prefixMap[step] ?? [];
  return failing.filter(r => {
    if (step === "contact" && (r.section === "contact" || r.section === "header")) return true;
    if ((r.section as string) === step) return true;
    return r.targets.some(t => prefixes.some(p => t.startsWith(p)));
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The hybrid flow's second half: after the one-shot AI draft, walk the student
 * section by section — live score, rule checklist with one-tap fixes, AI
 * improve with instant undo, the quantification coach, and a final AI review.
 * All edits persist automatically (one snapshot per session, then silent
 * saves), so closing never loses work.
 */
export function ReviewFlow({
  resume,
  studentId,
  onClose,
  onSaved,
}: {
  resume: SavedResume;
  studentId: number;
  onClose: () => void;
  onSaved: (updated: SavedResume) => void;
}) {
  const { toast } = useToast();
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();

  const [draft, setDraft] = useState<ResumeDocument>(() => upgradeContent(resume.content));
  const [stepIndex, setStepIndex] = useState(0);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [undoStacks, setUndoStacks] = useState<Partial<Record<StepKey, UndoEntry[]>>>({});
  const [improving, setImproving] = useState(false);
  const [quantItems, setQuantItems] = useState<QuantItem[] | null>(null);
  const [activeQuant, setActiveQuant] = useState<{ item: QuantItem; qIndex: number; value: string } | null>(null);
  const [quantApplying, setQuantApplying] = useState(false);
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [fill, setFill] = useState<{ pages: number; fillPct: number } | null>(null);

  const density = resolveTemplateConfig(resume.templateId).density;
  const report = useMemo(() => buildQualityReport(draft, { density }), [draft, density]);

  // Score delta chip
  const prevTotalRef = useRef(report.total);
  const [delta, setDelta] = useState<number | null>(null);
  useEffect(() => {
    const d = report.total - prevTotalRef.current;
    prevTotalRef.current = report.total;
    if (d !== 0) {
      setDelta(d);
      const t = setTimeout(() => setDelta(null), 1400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [report.total]);

  // ── Persistence: lazy snapshot on first mutation, then silent saves ──
  const snapshotDoneRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const latestDraftRef = useRef(draft);
  latestDraftRef.current = draft;

  /** Returns true only when the PATCH actually landed. Saves are SERIALIZED:
   * each new save chains behind the in-flight one and reads the draft only
   * when its turn comes, so an older slow request can never commit after (and
   * overwrite) a newer one. The chain lives in saveInFlightRef so a flush can
   * await whatever is queued. */
  const persistNow = useCallback((): Promise<boolean> => {
    const prev = saveInFlightRef.current ?? Promise.resolve(true);
    const p = prev.catch(() => false).then(async () => {
      const doc = latestDraftRef.current; // newest draft at send time — natural coalescing
      const snapshot = !snapshotDoneRef.current;
      try {
        const r = await apiFetch(`/api/students/${studentId}/resumes/${resume.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: docToPatchContent(doc), snapshot }),
        });
        if (r.ok) {
          // Only a landed snapshot counts — a failed first save must retry
          // with snapshot:true so the pre-review state reaches version history.
          if (snapshot) snapshotDoneRef.current = true;
          onSaved(await r.json() as SavedResume);
          return true;
        }
        toast({ title: "Couldn't save", description: "Your changes are still on screen — retrying on next edit", variant: "destructive" });
        return false;
      } catch {
        toast({ title: "Couldn't save", description: "Check your connection — changes retry on next edit", variant: "destructive" });
        return false;
      }
    });
    saveInFlightRef.current = p;
    void p.finally(() => {
      if (saveInFlightRef.current === p) saveInFlightRef.current = null;
    });
    return p;
  }, [studentId, resume.id, onSaved, toast]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistNow();
    }, 800);
  }, [persistNow]);

  // Server-side AI actions (improve, coach, review) read the resume from the
  // DB — a pending debounced save OR a save still in flight means they would
  // see a stale document, and their applied result would then overwrite the
  // user's last keystrokes. Always flush and require success before calling.
  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      return persistNow();
    }
    if (saveInFlightRef.current) return saveInFlightRef.current;
    return true;
  }, [persistNow]);

  const mutate = useCallback((updater: (doc: ResumeDocument) => ResumeDocument) => {
    setDraft(prev => updater(prev));
    scheduleSave();
  }, [scheduleSave]);

  const pushUndo = useCallback((step: StepKey, label: string, prevDoc: ResumeDocument) => {
    setUndoStacks(prev => {
      const stack = prev[step] ?? [];
      return { ...prev, [step]: [{ label, prevDoc }, ...stack].slice(0, 3) };
    });
  }, []);

  const handleUndo = (step: StepKey) => {
    setUndoStacks(prev => {
      const stack = prev[step] ?? [];
      const [top, ...rest] = stack;
      if (!top) return prev;
      setDraft(top.prevDoc);
      scheduleSave();
      return { ...prev, [step]: rest };
    });
  };

  const handleClose = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      void persistNow();
    }
    onClose();
  };

  // ── Steps ──
  const steps = useMemo<StepKey[]>(() => {
    const contentSteps: StepKey[] = [];
    const candidates = draft.order.filter((k): k is Exclude<StepKey, "contact" | "finish"> => k !== undefined);
    for (const key of candidates) {
      const hasFailing = report.rules.some(r => !r.passed && (r.section as string) === key);
      if (!isStepEmpty(draft, key) || hasFailing) contentSteps.push(key);
    }
    return ["contact", ...contentSteps, "finish"];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.order.join(","), report.rules.map(r => `${r.id}${r.passed}`).join(",")]);

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const stepRules = rulesForStep(report, step);
  const autoFixableCount = report.rules.filter(r => !r.passed && r.autoFixable).length;

  // ── Quant coach questions (prefetched once) ──
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/students/${studentId}/resumes/${resume.id}/quant-questions`, { method: "POST" })
      .then(r => r.ok ? r.json() : { items: [] })
      .then((data: { items?: QuantItem[] }) => { if (!cancelled) setQuantItems(data.items ?? []); })
      .catch(() => { if (!cancelled) setQuantItems([]); });
    return () => { cancelled = true; };
  }, [studentId, resume.id]);

  // ── Actions ──

  const handleAutoFix = () => {
    const { doc: fixed, applied } = applyAutoFixes(draft);
    if (applied.length === 0) return;
    const before = report.total;
    pushUndo(step, `Auto-fix (${applied.length} changes)`, draft);
    mutate(() => fixed);
    const after = buildQualityReport(fixed, { density }).total;
    toast({ title: `Fixed ${applied.length} formatting issue${applied.length > 1 ? "s" : ""}`, description: after > before ? `+${after - before} points` : undefined });
  };

  /** The current value of one improvable section, for stale-response checks. */
  const sectionValueOf = (doc: ResumeDocument, section: StepKey): unknown =>
    section === "summary" ? doc.summary
      : section === "skills" ? doc.skillSections
        : section === "experience" ? doc.experience
          : section === "projects" ? doc.projects
            : doc.achievements;

  const handleImprove = async (section: StepKey) => {
    if (!IMPROVABLE.includes(section)) return;
    setImproving(true);
    try {
      if (!await flushPendingSave()) {
        toast({ title: "Couldn't save your latest edits", description: "Fix the save first, then try Improve again", variant: "destructive" });
        return;
      }
      // Editing stays enabled while the AI works — so remember what the
      // section looked like when the request left, and refuse to apply a
      // rewrite of a version the user has since typed over.
      const beforeRequest = JSON.stringify(sectionValueOf(latestDraftRef.current, section));
      const apiSection = section === "skills" ? "skills" : section;
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resume.id}/improve-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: apiSection }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        toast({ title: "Improve failed", description: data?.error ?? "Try again", variant: "destructive" });
        return;
      }
      if (!data.changed) {
        toast({ title: "Already in good shape", description: "The AI had nothing meaningful to change here." });
        return;
      }
      if (JSON.stringify(sectionValueOf(latestDraftRef.current, section)) !== beforeRequest) {
        toast({ title: "You kept editing — nothing applied", description: "The AI rewrote an older version. Try Improve again when you're done typing." });
        return;
      }
      pushUndo(section, "AI improve", latestDraftRef.current);
      mutate(doc => {
        if (section === "summary") return { ...doc, summary: data.value as string };
        if (section === "skills") return { ...doc, skillSections: data.value };
        if (section === "experience") return { ...doc, experience: data.value };
        if (section === "projects") return { ...doc, projects: data.value };
        return { ...doc, achievements: data.value };
      });
      toast({ title: "Improved — tap Undo to revert" });
    } catch {
      toast({ title: "Improve failed", variant: "destructive" });
    } finally {
      setImproving(false);
    }
  };

  const handleQuantApply = async () => {
    if (!activeQuant) return;
    const { item, qIndex, value } = activeQuant;
    const q = item.questions[qIndex];
    if (!q || !value.trim()) return;
    setQuantApplying(true);
    try {
      if (!await flushPendingSave()) {
        toast({ title: "Couldn't save your latest edits", description: "Fix the save first, then apply the number again", variant: "destructive" });
        return;
      }
      const bulletAt = (doc: ResumeDocument) =>
        (item.section === "experience" ? doc.experience : doc.projects)[item.entryIndex]?.bullets[item.bulletIndex]?.text;
      const beforeRequest = bulletAt(latestDraftRef.current);
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resume.id}/quant-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: item.section,
          entryIndex: item.entryIndex,
          bulletIndex: item.bulletIndex,
          answers: [{ questionId: q.id, prompt: q.prompt, value: value.trim(), unit: q.unit }],
        }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        toast({ title: "Couldn't apply", description: data?.error ?? "Enter a plain number", variant: "destructive" });
        return;
      }
      if (bulletAt(latestDraftRef.current) !== beforeRequest) {
        toast({ title: "You kept editing — nothing applied", description: "The rewrite targeted an older version of this bullet. Apply again when done typing." });
        return;
      }
      pushUndo(item.section, "Quantified bullet", latestDraftRef.current);
      const newBullet = { text: data.text as string, evidence: (data.evidence ?? []) as string[] };
      mutate(doc => item.section === "experience"
        ? {
            ...doc,
            experience: doc.experience.map((e, ei) => ei === item.entryIndex
              ? { ...e, bullets: e.bullets.map((b, bi) => bi === item.bulletIndex ? newBullet : b) }
              : e),
          }
        : {
            ...doc,
            projects: doc.projects.map((p, pi) => pi === item.entryIndex
              ? { ...p, bullets: p.bullets.map((b, bi) => bi === item.bulletIndex ? newBullet : b) }
              : p),
          });
      setQuantItems(prev => (prev ?? []).filter(i => !(i.section === item.section && i.entryIndex === item.entryIndex && i.bulletIndex === item.bulletIndex)));
      setActiveQuant(null);
      toast({ title: "Number added — tap Undo to revert" });
    } finally {
      setQuantApplying(false);
    }
  };

  const handleAiReview = async () => {
    setReviewLoading(true);
    try {
      // Flush any pending edit first so the review sees what's on screen.
      if (!await flushPendingSave()) {
        toast({ title: "Couldn't save your latest edits", description: "Fix the save first, then request the review again", variant: "destructive" });
        return;
      }
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resume.id}/review`, { method: "POST" });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        toast({ title: "Review failed", description: data?.error ?? "Try again in a moment", variant: "destructive" });
        return;
      }
      setAiReview(data as AiReviewResult);
    } finally {
      setReviewLoading(false);
    }
  };

  const currentResume = (): SavedResume => ({ ...resume, content: docToPatchContent(draft) as SavedResume["content"], templateId: resume.templateId });

  // ── Step editors ──

  const inputCls = "rounded-lg border border-line focus:border-brand text-ink text-sm h-9";

  const renderEditor = () => {
    switch (step) {
      case "contact": {
        const setContact = (patch: Partial<ResumeDocument["contact"]>) =>
          mutate(doc => ({ ...doc, contact: { ...doc.contact, ...patch } }));
        const setLink = (kind: ContactLink["kind"], url: string) =>
          mutate(doc => {
            const others = doc.contact.links.filter(l => l.kind !== kind);
            const links = url.trim() ? [...others, { label: shortenUrl(url.trim()), url: url.trim(), kind }] : others;
            return { ...doc, contact: { ...doc.contact, links } };
          });
        const urlOf = (kind: ContactLink["kind"]) => draft.contact.links.find(l => l.kind === kind)?.url ?? "";
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input value={draft.contact.name} onChange={e => setContact({ name: e.target.value })} placeholder="Full name" className={inputCls} />
              <Input value={draft.contact.email} onChange={e => setContact({ email: e.target.value })} placeholder="Email" className={inputCls} />
              <Input value={draft.contact.phone ?? ""} onChange={e => setContact({ phone: e.target.value || null })} placeholder="Phone (+91…)" className={inputCls} />
              <Input value={draft.contact.city ?? ""} onChange={e => setContact({ city: e.target.value || null })} placeholder="City" className={inputCls} />
            </div>
            <Input value={urlOf("github")} onChange={e => setLink("github", e.target.value)} placeholder="GitHub URL" className={inputCls} />
            <Input value={urlOf("linkedin")} onChange={e => setLink("linkedin", e.target.value)} placeholder="LinkedIn URL (linkedin.com/in/you)" className={inputCls} />
            <Input value={urlOf("portfolio")} onChange={e => setLink("portfolio", e.target.value)} placeholder="Portfolio URL (optional)" className={inputCls} />
            <Input value={draft.headline} onChange={e => mutate(doc => ({ ...doc, headline: e.target.value }))} placeholder="Headline, e.g. Backend Developer | Node.js, PostgreSQL" className={inputCls} />
          </div>
        );
      }
      case "summary":
        return (
          <Textarea
            value={draft.summary}
            onChange={e => mutate(doc => ({ ...doc, summary: e.target.value }))}
            rows={4}
            placeholder="2-3 tight lines: who you are, your stack, your strongest proof."
            className="rounded-xl border border-line focus:border-brand text-ink text-sm resize-none"
          />
        );
      case "skills":
        return (
          <div className="space-y-2">
            {draft.skillSections.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={s.category}
                  onChange={e => mutate(doc => ({ ...doc, skillSections: doc.skillSections.map((x, idx) => idx === i ? { ...x, category: e.target.value } : x) }))}
                  placeholder="Category"
                  className={`${inputCls} w-32 shrink-0`}
                />
                <Input
                  value={s.items.join(", ")}
                  onChange={e => mutate(doc => ({ ...doc, skillSections: doc.skillSections.map((x, idx) => idx === i ? { ...x, items: e.target.value.split(",").map(t => t.trim()).filter(Boolean) } : x) }))}
                  placeholder="Items, comma separated"
                  className={`${inputCls} flex-1`}
                />
              </div>
            ))}
            <button
              onClick={() => mutate(doc => ({ ...doc, skillSections: [...doc.skillSections, { category: "", items: [], evidence: [] }] }))}
              className="text-[11px] font-bold text-brand"
            >
              + Add category
            </button>
          </div>
        );
      case "experience":
      case "projects": {
        const list = step === "experience" ? draft.experience : draft.projects;
        const quantFor = (ei: number, bi: number) =>
          (quantItems ?? []).find(q => q.section === step && q.entryIndex === ei && q.bulletIndex === bi);
        return (
          <div className="space-y-3">
            {list.map((entry, ei) => (
              <div key={ei} className="rounded-xl border border-line p-3 space-y-1.5">
                <p className="text-[12px] font-bold text-ink">
                  {"role" in entry ? `${entry.role}${entry.company ? ` · ${entry.company}` : ""}` : entry.title}
                </p>
                {entry.bullets.map((b, bi) => {
                  const quant = quantFor(ei, bi);
                  const isActive = activeQuant && activeQuant.item.section === step && activeQuant.item.entryIndex === ei && activeQuant.item.bulletIndex === bi;
                  return (
                    <div key={bi} className="space-y-1">
                      <Textarea
                        value={b.text}
                        onChange={e => {
                          const text = e.target.value;
                          mutate(doc => step === "experience"
                            ? {
                                ...doc,
                                experience: doc.experience.map((x, i) => i === ei
                                  ? { ...x, bullets: x.bullets.map((y, j) => j === bi ? { ...y, text } : y) }
                                  : x),
                              }
                            : {
                                ...doc,
                                projects: doc.projects.map((x, i) => i === ei
                                  ? { ...x, bullets: x.bullets.map((y, j) => j === bi ? { ...y, text } : y) }
                                  : x),
                              });
                        }}
                        rows={2}
                        className="rounded-lg border border-line focus:border-brand text-ink text-xs resize-none"
                      />
                      {quant && !isActive && (
                        <button
                          onClick={() => setActiveQuant({ item: quant, qIndex: 0, value: "" })}
                          className="text-[10px] font-bold text-brand border border-brand/30 rounded-full px-2 py-0.5"
                        >
                          + Add numbers
                        </button>
                      )}
                      {isActive && activeQuant && (
                        <div className="rounded-lg bg-brand-soft border border-brand/20 p-2 space-y-1.5">
                          <p className="text-[11px] font-semibold text-ink">{activeQuant.item.questions[activeQuant.qIndex]?.prompt}</p>
                          <div className="flex gap-1.5 items-center">
                            <Input
                              value={activeQuant.value}
                              onChange={e => setActiveQuant(prev => prev ? { ...prev, value: e.target.value } : null)}
                              inputMode="numeric"
                              placeholder="Number only"
                              className="rounded-lg border border-line h-7 text-xs flex-1"
                            />
                            <span className="text-[10px] text-ink-muted shrink-0">{activeQuant.item.questions[activeQuant.qIndex]?.unit}</span>
                            <button
                              onClick={() => void handleQuantApply()}
                              disabled={quantApplying || !activeQuant.value.trim()}
                              className="h-7 px-2.5 rounded-full bg-brand text-white text-[10px] font-bold disabled:opacity-50"
                            >
                              {quantApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                            </button>
                            <button
                              onClick={() => {
                                const next = activeQuant.qIndex + 1;
                                if (next < activeQuant.item.questions.length) setActiveQuant({ ...activeQuant, qIndex: next, value: "" });
                                else setActiveQuant(null);
                              }}
                              className="h-7 px-2 rounded-full border border-line text-[10px] font-bold text-ink-muted"
                            >
                              Skip
                            </button>
                          </div>
                          <p className="text-[9px] text-ink-muted">Answer with your honest number — we never invent one for you.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      }
      case "education": {
        const setEd = (i: number, patch: Record<string, string | null>) =>
          mutate(doc => ({ ...doc, education: doc.education.map((x, idx) => idx === i ? { ...x, ...patch } : x) }));
        return (
          <div className="space-y-2">
            {draft.education.map((ed, i) => (
              <div key={i} className="rounded-xl border border-line p-3 space-y-2">
                <Input value={ed.degree} onChange={e => setEd(i, { degree: e.target.value })} placeholder="Degree" className={inputCls} />
                <Input value={ed.institution} onChange={e => setEd(i, { institution: e.target.value })} placeholder="College / university" className={inputCls} />
                <div className="grid grid-cols-3 gap-2">
                  <Input value={ed.start} onChange={e => setEd(i, { start: e.target.value })} placeholder="2022" className={inputCls} />
                  <Input value={ed.end} onChange={e => setEd(i, { end: e.target.value })} placeholder="2026" className={inputCls} />
                  <Input value={ed.cgpa ?? ""} onChange={e => setEd(i, { cgpa: e.target.value || null })} placeholder="CGPA" className={inputCls} />
                </div>
              </div>
            ))}
            {draft.education.length === 0 && (
              <Button
                variant="outline"
                onClick={() => mutate(doc => ({ ...doc, education: [{ degree: "", institution: "", start: "", end: "", cgpa: null }] }))}
                className="rounded-full border border-line text-brand font-bold text-xs h-9"
              >
                + Add education
              </Button>
            )}
          </div>
        );
      }
      case "achievements":
        return (
          <div className="space-y-2">
            {draft.achievements.map((a, i) => (
              <Input
                key={i}
                value={a.text}
                onChange={e => mutate(doc => ({ ...doc, achievements: doc.achievements.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x) }))}
                placeholder="Achievement"
                className={inputCls}
              />
            ))}
          </div>
        );
      case "certifications":
        return (
          <div className="space-y-2">
            {draft.certifications.map((c, i) => (
              <p key={i} className="text-[12px] text-ink-muted">{c.name} — {c.issuer}{c.date ? ` (${c.date})` : ""}</p>
            ))}
            <p className="text-[11px] text-ink-muted">Certifications come from your profile — manage them there.</p>
          </div>
        );
      case "finish":
        return null;
    }
  };

  const stepUndo = undoStacks[step]?.[0];
  const scoreRing = (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line, #e5e7eb)" strokeWidth="3" className="text-line" style={{ stroke: "rgb(229 231 235)" }} />
        <motion.circle
          cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
          style={{ stroke: "rgb(74 85 199)" }}
          strokeDasharray={`${(report.total / 100) * 97.4} 97.4`}
          animate={{ strokeDasharray: `${(report.total / 100) * 97.4} 97.4` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold text-ink">{report.total}</span>
      <AnimatePresence>
        {delta !== null && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: -6 }}
            exit={{ opacity: 0 }}
            className={`absolute -top-1 -right-2 text-[11px] font-extrabold ${delta > 0 ? "text-brand" : "text-danger"}`}
          >
            {delta > 0 ? `+${delta}` : delta}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );

  const header = (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-line shrink-0 bg-paper sticky top-0 z-10">
      {scoreRing}
      <div className="min-w-0 flex-1">
        <p className="font-extrabold text-ink text-[15px] truncate">Raise your score</p>
        <div className="flex gap-2 mt-1">
          {(Object.entries(report.subScores) as [string, { pct: number }][]).map(([key, s]) => (
            <div key={key} className="flex-1 min-w-0" title={`${key} ${s.pct}%`}>
              <div className="h-1 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        {autoFixableCount > 0 && (
          <button
            onClick={handleAutoFix}
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-brand border border-brand/30 rounded-full px-2 py-0.5 hover:bg-brand/10"
          >
            <Wand2 className="w-3 h-3" />
            Fix {autoFixableCount} formatting issue{autoFixableCount > 1 ? "s" : ""}
          </button>
        )}
      </div>
      <button
        onClick={() => setShowMobilePreview(true)}
        className="lg:hidden h-8 px-3 rounded-full border border-line flex items-center gap-1.5 text-[11px] font-bold text-brand shrink-0"
      >
        <Eye className="w-3.5 h-3.5" /> Preview
      </button>
      <button onClick={handleClose} className="w-8 h-8 rounded-full border border-line flex items-center justify-center shrink-0">
        <X className="w-4 h-4 text-ink-muted" />
      </button>
    </div>
  );

  const severityTone: Record<string, string> = {
    high: "border-danger/40 bg-danger/5",
    medium: "border-line bg-canvas",
    low: "border-line bg-paper",
  };

  const finishPanel = (
    <div className="space-y-4">
      {stepRules.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Overall checks</p>
          {stepRules.map(r => (
            <div key={r.id} className="flex items-start gap-2 text-[12px] text-ink-muted">
              <span className="mt-0.5 w-3.5 h-3.5 rounded-full border-2 border-line shrink-0" />
              <span>{r.hint}</span>
            </div>
          ))}
        </div>
      )}

      {!aiReview ? (
        <Button
          onClick={() => void handleAiReview()}
          disabled={reviewLoading}
          className="w-full h-12 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-[15px]"
        >
          {reviewLoading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />A recruiter is reading it…</>
          ) : (
            <><Sparkles className="w-5 h-5 mr-2" />Get the full AI review</>
          )}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-brand-soft border border-brand/20 p-3">
            <p className="text-[11px] font-bold text-brand uppercase tracking-wider mb-1">7-second read</p>
            <p className="text-[13px] text-ink leading-snug">“{aiReview.review.sevenSecondRead}”</p>
          </div>
          <div className="rounded-xl bg-canvas border border-line p-3">
            <p className="text-[13px] font-bold text-ink">{aiReview.band} — {aiReview.qualityScore}/100</p>
            <p className="text-[11px] text-ink-muted mt-0.5">{aiReview.percentileCopy}</p>
            <p className="text-[9px] text-ink-muted mt-1">Estimated from our scoring rubric, not a live applicant pool.</p>
          </div>
          {aiReview.review.sectionNotes.length > 0 && (
            <div className="space-y-1.5">
              {aiReview.review.sectionNotes.map((n, i) => (
                <div key={i} className={`rounded-lg border p-2 ${severityTone[n.severity] ?? severityTone.low}`}>
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{n.section} · {n.severity}</p>
                  <p className="text-[12px] text-ink mt-0.5 leading-snug">{n.note}</p>
                </div>
              ))}
            </div>
          )}
          {aiReview.review.topFixes.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Top fixes</p>
              {aiReview.review.topFixes.map((f, i) => (
                <p key={i} className="text-[12px] text-ink flex items-start gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />{f}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => gateOnSignup(isLoaded, isSignedIn, setLocation, resume.id, "pdf", () =>
            downloadResumePDF(currentResume()).catch(() => toast({ title: "PDF error", variant: "destructive" })))}
          className="flex-1 h-10 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-xs"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          PDF
        </Button>
        <Button
          onClick={() => gateOnSignup(isLoaded, isSignedIn, setLocation, resume.id, "docx", () =>
            downloadResumeDocx(currentResume()).catch(() => toast({ title: "DOCX error", variant: "destructive" })))}
          variant="outline"
          className="flex-1 h-10 rounded-full border border-line text-ink-muted font-bold text-xs"
        >
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          DOCX
        </Button>
      </div>
    </div>
  );

  const previewPanel = (
    <div className="space-y-2">
      <ResumePreview
        resume={draft}
        templateId={resume.templateId}
        highlightSection={step === "finish" ? undefined : step}
        onMeasure={m => setFill({ pages: m.pages, fillPct: m.fillPct })}
      />
      {fill && (
        <div className="space-y-0.5">
          <div className="h-1.5 bg-line rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(100, fill.fillPct)}%` }} />
          </div>
          <p className="text-[10px] text-ink-muted">
            {fill.pages > 1 || fill.fillPct > 98
              ? "Over one page — trim the weakest bullets"
              : fill.fillPct < 70
                ? `Page ${fill.fillPct}% full — room for one more bullet`
                : `Page fill ${fill.fillPct}% — good one-page fit`}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-ink/40 flex items-stretch lg:items-center lg:p-6"
    >
      <div className="w-full lg:max-w-5xl mx-auto bg-paper lg:rounded-3xl flex flex-col max-h-[100dvh] lg:max-h-[90dvh] overflow-hidden">
        {header}

        {/* Step rail */}
        <div className="flex gap-1 px-5 py-2 border-b border-line overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
          {steps.map((s, i) => {
            const done = s !== "finish" && rulesForStep(report, s).length === 0;
            return (
              <button
                key={s}
                onClick={() => setStepIndex(i)}
                className={`shrink-0 h-7 px-2.5 rounded-full text-[10px] font-bold border flex items-center gap-1 transition-colors ${
                  i === stepIndex ? "border-brand bg-brand-soft text-brand"
                    : done ? "border-line text-ink-muted"
                      : "border-line text-ink"
                }`}
              >
                {done && <Check className="w-3 h-3 text-brand" />}
                {STEP_LABELS[s]}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-hidden lg:flex lg:flex-row">
          <div className="overflow-y-auto h-full lg:flex-1 px-5 py-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-extrabold text-ink text-[16px]">{STEP_LABELS[step]}</h3>
              <div className="flex items-center gap-1.5">
                {stepUndo && (
                  <button
                    onClick={() => handleUndo(step)}
                    className="h-7 px-2.5 rounded-full border border-line text-[10px] font-bold text-ink-muted flex items-center gap-1 hover:text-ink"
                  >
                    <Undo2 className="w-3 h-3" /> Undo
                  </button>
                )}
                {step !== "finish" && IMPROVABLE.includes(step) && !isStepEmpty(draft, step) && (
                  <button
                    onClick={() => void handleImprove(step)}
                    disabled={improving}
                    className="h-7 px-2.5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    {improving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Improve
                  </button>
                )}
              </div>
            </div>

            {/* Checklist */}
            {step !== "finish" && stepRules.length > 0 && (
              <div className="space-y-1.5">
                {stepRules.map(r => (
                  <div key={r.id} className="flex items-start gap-2 text-[12px]">
                    <span className="mt-0.5 w-3.5 h-3.5 rounded-full border-2 border-line shrink-0" />
                    <span className="text-ink-muted leading-snug">{r.hint}</span>
                  </div>
                ))}
              </div>
            )}
            {step !== "finish" && stepRules.length === 0 && (
              <p className="text-[12px] text-brand font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> This section passes every check.
              </p>
            )}

            {/* Editor */}
            {step === "finish" ? finishPanel : renderEditor()}
          </div>

          {/* Desktop preview */}
          <div className="hidden lg:block lg:w-[340px] lg:shrink-0 lg:border-l lg:border-line lg:overflow-y-auto lg:p-4">
            {previewPanel}
          </div>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-line shrink-0">
          <Button
            variant="outline"
            onClick={() => setStepIndex(i => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="h-10 rounded-full border border-line text-ink-muted font-bold text-xs px-4"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
          </Button>
          <p className="text-[10px] text-ink-muted">{stepIndex + 1} / {steps.length}</p>
          {stepIndex < steps.length - 1 ? (
            <Button
              onClick={() => setStepIndex(i => Math.min(steps.length - 1, i + 1))}
              className="h-10 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-xs px-4"
            >
              Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleClose}
              className="h-10 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-xs px-4"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Done
            </Button>
          )}
        </div>
      </div>

      {/* Mobile preview overlay */}
      <AnimatePresence>
        {showMobilePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-ink/60 flex items-center justify-center p-4 lg:hidden"
            onClick={() => setShowMobilePreview(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-paper rounded-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto p-4 space-y-3"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-ink text-sm">Live Preview</p>
                <button onClick={() => setShowMobilePreview(false)}>
                  <X className="w-4 h-4 text-ink-muted" />
                </button>
              </div>
              {previewPanel}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
