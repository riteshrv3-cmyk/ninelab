import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Plus, Trash2, Sparkles,
  Loader2, Building2, AlignLeft, ChevronRight, X, Pencil,
  Check, PlusCircle, MinusCircle, Zap, Eye, FileText, Copy, Share2, History, Undo2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type jsPDF from "jspdf";
import { apiFetch } from "@/lib/api/authFetch";
import { isGuestSession } from "@/lib/isGuest";
import { upgradeContent, buildAtsReport, renderPlainText } from "@workspace/resume-core";
import { renderResumePdf, TEMPLATE_REGISTRY, resolveTemplateConfig, preloadFonts } from "@/lib/resume-pdf";
import { renderResumeDocx } from "@/lib/resume-pdf/resume-docx";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { ResumePreview, ResumeThumbnail, preloadPdfjs } from "@/components/resume/ResumePreview";
import { AtsFixList } from "@/components/resume/AtsFixList";
import { InlineEditPreview } from "@/components/resume/InlineEditPreview";
import { ResumeImport } from "@/components/ResumeImport";
import { useStudentId } from "@/hooks/useStudentId";
import { useNameGate } from "@/components/NameGate";
import { PageHeader } from "@/components/PageHeader";
import { scoreBadgeClass, scoreTextClass } from "@/lib/scoreTone";
import ResumeDemo from "@/components/demo/ResumeDemo";

// ─── Types ────────────────────────────────────────────────────────────────────

// Raw shape of the `content` jsonb column as read from the API — a union of
// the legacy v1 flat shape and the pipeline's v2 shape (see upgradeContent()
// in @workspace/resume-core for the authoritative normalizer). Fields the UI
// still edits directly (skillSections.items, projects.tech/bullets,
// achievements) accept either shape; toCommaString()/toBulletString() below
// coerce whichever one shows up.
type LooseBullet = string | { text: string };
interface ResumeContent {
  name: string;
  email: string;
  phone?: string | null;
  city: string;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  degree: string;
  college: string;
  startYear: number;
  gradYear: number;
  cgpa?: string | null;
  summary: string;
  skillSections: { category: string; items: string | string[] }[];
  experience?: { company: string; role: string; period: string; bullets: LooseBullet[] }[];
  projects: { title: string; tech: string | string[]; bullets: LooseBullet[] }[];
  certifications: { name: string; issuer: string; date?: string }[];
  achievements: LooseBullet[];
  atsMeta?: unknown;
}

function toCommaString(v: string | string[] | undefined | null): string {
  return Array.isArray(v) ? v.join(", ") : v ?? "";
}
function toBulletString(b: LooseBullet): string {
  return typeof b === "string" ? b : b.text;
}

/** No skills, projects, or experience at all — the "Not set Engineering" rejection-shaped output that comes from generating off a still-empty profile. */
function isContentEmpty(content: ResumeContent): boolean {
  const hasSkills = (content.skillSections ?? []).some(s => toCommaString(s.items).trim().length > 0);
  const hasProjects = (content.projects ?? []).length > 0;
  const hasExperience = (content.experience ?? []).length > 0;
  return !hasSkills && !hasProjects && !hasExperience;
}

/**
 * A 0% ATS score backed by an entirely empty document is the hollow case —
 * distinct from a real, populated resume that happens to score 0% against a
 * JD it genuinely doesn't match, which is legitimate signal and stays as-is.
 */
function isHollowResume(content: ResumeContent, scorePct: number | undefined): boolean {
  if (scorePct !== 0) return false;
  return isContentEmpty(content);
}

interface SavedResume {
  id: number;
  studentId: number;
  name: string;
  templateId: string;
  jdText?: string | null;
  companyName?: string | null;
  content: ResumeContent;
  createdAt: string;
  evidenceMap?: { thesis?: string; honestGaps?: { term: string; whyItMatters: string }[]; coverage?: { jdTerm: string; status: string }[] } | null;
  generation?: { degraded?: boolean } | null;
  atsReport?: { scorePct: number; matched: { term: string; where: string }[]; missing: { term: string; importance: string }[] } | null;
  shareSlug?: string | null;
  shareViews?: number | null;
  versions?: { content: ResumeContent; templateId: string; atsScore: number | null; savedAt: string }[] | null;
}

// ─── Template definitions ─────────────────────────────────────────────────────
//
// TEMPLATE_REGISTRY (src/lib/resume-pdf) is the single source of truth for
// template id/label/description — it used to be duplicated here with
// slightly different wording, which is exactly the kind of drift a shared
// registry exists to prevent. resolveTemplateConfig() also fixes the old bug
// where an unrecognized templateId showed an "ATS Pro" badge but downloaded
// a Classic PDF (two different fallbacks for the same bad id).
const TEMPLATE_LIST = Object.values(TEMPLATE_REGISTRY);

// ─── Recommendation Engine ────────────────────────────────────────────────────

// Company/role/skill mapping is a static reference taxonomy (which stacks
// these companies are known to hire for) — not a live listing. It carries no
// salary figure or opening count, since neither can be verified per-student
// and both were previously invented numbers presented as fact.
interface RoleRec {
  company: string;
  role: string;
  tier: "tier1" | "tier2" | "startup";
  triggerSkills: string[];
  logo: string;
}

const ALL_RECS: RoleRec[] = [
  // Tier 1 — Product companies
  { company: "Google", role: "SDE-1", tier: "tier1", logo: "G", triggerSkills: ["python", "java", "c++", "dsa", "algorithms", "data structures"] },
  { company: "Microsoft", role: "SDE-1", tier: "tier1", logo: "M", triggerSkills: ["java", "c#", ".net", "azure", "python", "typescript", "dsa"] },
  { company: "Amazon", role: "SDE-1", tier: "tier1", logo: "A", triggerSkills: ["java", "python", "aws", "dsa", "distributed systems"] },
  { company: "Flipkart", role: "SDE-1", tier: "tier1", logo: "F", triggerSkills: ["java", "python", "react", "dsa", "kafka", "mysql"] },
  { company: "Atlassian", role: "Software Dev", tier: "tier1", logo: "AT", triggerSkills: ["java", "python", "javascript", "react", "jira"] },
  { company: "Adobe", role: "MTS-1", tier: "tier1", logo: "AD", triggerSkills: ["java", "c++", "python", "ml", "graphics", "javascript"] },
  // Data / ML
  { company: "Google", role: "Data Analyst", tier: "tier1", logo: "G", triggerSkills: ["python", "sql", "pandas", "machine learning", "bigquery", "data analytics"] },
  { company: "Meesho", role: "Data Analyst", tier: "tier2", logo: "ME", triggerSkills: ["python", "pandas", "sql", "machine learning", "tableau", "data analytics", "numpy"] },
  { company: "Juspay", role: "ML Engineer", tier: "tier2", logo: "JP", triggerSkills: ["machine learning", "python", "tensorflow", "pytorch", "data science", "ai", "ml"] },
  // Tier 2 — Indian unicorns
  { company: "Razorpay", role: "Backend Engineer", tier: "tier2", logo: "R", triggerSkills: ["node.js", "python", "java", "golang", "go", "postgresql", "redis"] },
  { company: "Swiggy", role: "SDE-1", tier: "tier2", logo: "SW", triggerSkills: ["react", "node.js", "python", "java", "golang", "mongodb"] },
  { company: "Zomato", role: "SDE-1", tier: "tier2", logo: "Z", triggerSkills: ["react", "node.js", "python", "redis", "kafka", "mysql"] },
  { company: "PhonePe", role: "SDE-1", tier: "tier2", logo: "PP", triggerSkills: ["java", "kotlin", "spring", "mysql", "kafka", "microservices"] },
  { company: "CRED", role: "SDE-1", tier: "tier2", logo: "CR", triggerSkills: ["kotlin", "swift", "react native", "java", "ios", "android", "mobile"] },
  { company: "Zerodha", role: "Software Dev", tier: "tier2", logo: "ZE", triggerSkills: ["python", "javascript", "react", "go", "golang", "postgresql"] },
  { company: "Groww", role: "SDE-1", tier: "tier2", logo: "GR", triggerSkills: ["react", "java", "kotlin", "spring", "android", "mysql"] },
  { company: "Ola", role: "SDE-1", tier: "tier2", logo: "OL", triggerSkills: ["react", "node.js", "python", "java", "kafka", "aws"] },
  // Frontend / Full-stack
  { company: "upGrad", role: "Full Stack Dev", tier: "startup", logo: "UG", triggerSkills: ["react", "node.js", "mongodb", "express", "javascript", "typescript", "nextjs"] },
  { company: "BrowserStack", role: "SDE-1", tier: "startup", logo: "BS", triggerSkills: ["java", "javascript", "react", "selenium", "qa", "testing", "automation"] },
  { company: "Freshworks", role: "SDE-1", tier: "startup", logo: "FW", triggerSkills: ["ruby", "react", "javascript", "python", "salesforce"] },
  { company: "Postman", role: "SDE-1", tier: "startup", logo: "PM", triggerSkills: ["javascript", "typescript", "react", "node.js", "api", "rest"] },
  { company: "Hasura", role: "Backend Dev", tier: "startup", logo: "HA", triggerSkills: ["graphql", "postgresql", "haskell", "node.js", "typescript", "api"] },
  // Cloud / DevOps
  { company: "Nutanix", role: "SDE-1", tier: "tier2", logo: "NU", triggerSkills: ["kubernetes", "docker", "cloud", "aws", "azure", "devops", "linux"] },
  { company: "Druva", role: "Cloud Dev", tier: "startup", logo: "DR", triggerSkills: ["aws", "go", "golang", "kubernetes", "docker", "cloud", "devops"] },
  // Cybersec
  { company: "Rubrik", role: "SDE-1", tier: "tier2", logo: "RU", triggerSkills: ["cybersecurity", "security", "python", "c++", "networking"] },
];

function getMatchScore(rec: RoleRec, userSkills: string[]): number {
  if (!userSkills.length) return 0;
  const lower = userSkills.map(s => s.toLowerCase());
  let hits = 0;
  for (const trigger of rec.triggerSkills) {
    if (lower.some(us => us.includes(trigger) || trigger.includes(us))) hits++;
  }
  return hits / rec.triggerSkills.length;
}

// matchPct is a real skill-overlap percentage against each company's listed
// stack — it can be 0, and is never padded with an artificial floor.
function getRecommendations(userSkills: string[]): (RoleRec & { matchPct: number })[] {
  const scored = ALL_RECS.map(rec => ({
    ...rec,
    matchPct: Math.round(getMatchScore(rec, userSkills) * 100),
  }));

  if (!userSkills.length) {
    // No skills yet: show a balanced mix with an honest 0% match rather than guessing.
    return scored
      .filter(r => ["Google", "Flipkart", "Razorpay", "Swiggy", "upGrad", "Freshworks"].includes(r.company))
      .slice(0, 8);
  }

  // Deduplicate by company+role, sort by match desc, keep top 8
  const seen = new Set<string>();
  return scored
    .filter(r => { const k = `${r.company}|${r.role}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.matchPct - a.matchPct)
    .slice(0, 8);
}

const TIER_META = {
  tier1: { label: "Tier 1" },
  tier2: { label: "Unicorn" },
  startup: { label: "Startup" },
};

function TargetRecommendations({
  studentId,
  onGenerate,
}: {
  studentId: number;
  onGenerate: (company: string, role: string) => void;
}) {
  const [, setLocation] = useLocation();
  // Shared react-query profile (same key AppLayout warms on every page load):
  // usually renders instantly from cache instead of firing a duplicate
  // full-profile fetch. The old raw apiFetch here had no timeout or retry, so
  // one hung request on a flaky mobile connection left this section showing
  // its loading skeleton forever.
  const { data: profile, isLoading, isError } = useStudentProfile(String(studentId));
  const skills = Object.keys((profile?.skills as Record<string, number> | undefined) ?? {}).map(s => s.toLowerCase());
  const hasSkills = skills.length > 0;
  // isError -> generic recommendations rather than an unresolvable skeleton.
  const recs = isLoading && !isError ? [] : getRecommendations(isError ? [] : skills);

  if (isLoading && !isError) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-48 rounded-lg" />
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-44 rounded-2xl shrink-0" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Target Companies &amp; Roles</h2>
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted ml-auto">
          {recs.length} matches
        </span>
      </div>
      <p className="text-[12px] text-ink-muted -mt-1">Companies known to hire for this stack — match % is your skill overlap, not a live opening. Click to generate a tailored resume.</p>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
        {recs.map((rec, i) => {
          const tier = TIER_META[rec.tier];
          return (
            <motion.div
              key={`${rec.company}-${rec.role}-${i}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0 w-44 bg-paper rounded-2xl shadow-soft overflow-hidden"
            >
              <div className="p-3 space-y-2.5">
                {/* Logo + Tier label */}
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-line text-ink font-bold text-[10px]">
                    {rec.logo}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    {tier.label}
                  </span>
                </div>

                {/* Company + Role */}
                <div>
                  <p className="font-bold text-ink text-[14px] leading-tight">{rec.company}</p>
                  <p className="text-[11px] text-ink-muted font-semibold leading-tight mt-0.5">{rec.role}</p>
                </div>

                {/* Match bar — real skill overlap with this company's known stack.
                    With zero skills on file the score is always a fake 0%, so
                    show a path to a real number instead of fake precision. */}
                {hasSkills ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Skill match</span>
                      <span className="text-[11px] font-bold text-ink">{rec.matchPct}%</span>
                    </div>
                    <div className="h-1.5 bg-line rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${rec.matchPct}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setLocation("/profile")}
                    className="text-[11px] font-semibold text-brand underline underline-offset-2 text-left"
                  >
                    Add skills to see your match
                  </button>
                )}

                {/* CTA */}
                <button
                  onClick={() => onGenerate(rec.company, rec.role)}
                  className="w-full h-8 rounded-full bg-brand text-white font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-transform"
                >
                  <Zap className="w-3 h-3" />
                  Generate Resume
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PDF generation ───────────────────────────────────────────────────────────
//
// The four hand-rolled jsPDF templates that used to live here (ten arbitrary
// font sizes, four body grays, a broken bullet glyph, silently-dropped
// Experience/tech-stack content, bullets split mid-line across pages — see
// the resume-quality-overhaul plan for the full list) are gone. Rendering now
// goes through the shared typeset engine in src/lib/resume-pdf/, which both
// this download path and the live preview (Phase 3) use identically, so what
// a student sees on screen and what they download are pixel-for-pixel the
// same PDF bytes.
//
// upgradeContent() bridges the server's current v1 content shape (this file's
// ResumeContent type) into the engine's ResumeDocument (v2) — a pure,
// read-time conversion, so this keeps working unchanged once Phase 5 starts
// persisting v2 content directly.

// ─── Signup gate ────────────────────────────────────────────────────────────
// Guests can generate resumes freely, but downloading/sharing requires an
// account — otherwise there's no way to reach them again. The intent survives
// the sign-up redirect via sessionStorage so the action fires automatically
// the moment the student lands back on /resume, signed in.

type DownloadIntent = "pdf" | "docx" | "share";
const DOWNLOAD_INTENT_KEY = "resumeDownloadIntent";

function stashDownloadIntent(resumeId: number, intent: DownloadIntent): void {
  sessionStorage.setItem(DOWNLOAD_INTENT_KEY, JSON.stringify({ resumeId, intent }));
}

function consumeDownloadIntent(): { resumeId: number; intent: DownloadIntent } | null {
  const raw = sessionStorage.getItem(DOWNLOAD_INTENT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(DOWNLOAD_INTENT_KEY);
  try {
    const parsed = JSON.parse(raw) as { resumeId?: unknown; intent?: unknown };
    if (typeof parsed.resumeId === "number" && (parsed.intent === "pdf" || parsed.intent === "docx" || parsed.intent === "share")) {
      return { resumeId: parsed.resumeId, intent: parsed.intent };
    }
  } catch {
    // malformed — ignore
  }
  return null;
}

/**
 * If signed in, runs the action now. If confirmed a guest (Clerk has finished
 * loading and isSignedIn is false), stashes the intent and sends the student
 * to sign up. While Clerk is still loading, fails open and runs the action —
 * this is a growth nudge, not a security gate, so never wrongly bounce an
 * already-signed-in student who clicked before the SDK finished loading.
 */
function gateOnSignup(
  isLoaded: boolean,
  isSignedIn: boolean | undefined,
  setLocation: (path: string) => void,
  resumeId: number,
  intent: DownloadIntent,
  run: () => void,
): void {
  if (!isLoaded || isSignedIn) {
    run();
    return;
  }
  stashDownloadIntent(resumeId, intent);
  setLocation("/sign-up");
}

// Fire-and-forget: logs the download and auto-links this resume to a
// same-company application if one's waiting unlinked. Never blocks or
// fails the download itself.
function notifyResumeDownloaded(resume: SavedResume): void {
  apiFetch(`/api/students/${resume.studentId}/resumes/${resume.id}/downloaded`, { method: "POST" }).catch(() => {});
}

async function downloadResumePDF(resume: SavedResume): Promise<void> {
  const doc = upgradeContent(resume.content);
  const { doc: pdfDoc, filename } = await renderResumePdf(doc, resume.templateId, {
    resumeName: resume.name,
    companyName: resume.companyName ?? null,
  });
  openPDF(pdfDoc, filename);
  notifyResumeDownloaded(resume);
}

async function downloadResumeDocx(resume: SavedResume): Promise<void> {
  const doc = upgradeContent(resume.content);
  const { blob, filename } = await renderResumeDocx(doc, resume.name);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  notifyResumeDownloaded(resume);
}

// Opens PDF in a new tab instead of direct download — avoids Chrome/Edge
// Safe Browsing "Virus detected" false-positive on blob downloads
function openPDF(doc: jsPDF, filename: string) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Short delay before revoke so browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Edit Resume Sheet ────────────────────────────────────────────────────────

function EditResumeSheet({
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
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState(resume.templateId);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [restoringIndex, setRestoringIndex] = useState<number | null>(null);

  const [summary, setSummary] = useState(resume.content.summary ?? "");
  // The AI pipeline persists v2-shaped content (skill items / project tech as
  // string[], bullets/achievements as {text,evidence}) while this edit form
  // still operates on v1's flat strings — normalize on read so an untouched
  // v2 field round-trips through Save correctly instead of 400ing. Full v2
  // edit surface is Phase 6 scope.
  const [skillSections, setSkillSections] = useState(
    (resume.content.skillSections ?? []).map(s => ({ category: s.category, items: toCommaString(s.items) }))
  );
  const [projects, setProjects] = useState(
    (resume.content.projects ?? []).map(p => ({
      ...p,
      tech: toCommaString(p.tech),
      bullets: (p.bullets ?? []).map(toBulletString),
    }))
  );
  const [achievements, setAchievements] = useState((resume.content.achievements ?? []).map(toBulletString));

  // Snapshot of the initial values, for the dirty-state guard below — a
  // backdrop click used to discard edits with no warning.
  const initialSnapshot = useRef(JSON.stringify({ templateId: resume.templateId, summary, skillSections, projects, achievements })).current;
  const isDirty = JSON.stringify({ templateId, summary, skillSections, projects, achievements }) !== initialSnapshot;
  const requestClose = () => {
    if (isDirty && !window.confirm("Discard unsaved changes to this resume?")) return;
    onClose();
  };

  // Reconstructed on every edit — feeds both the live preview and the live ATS
  // recompute, so what's shown always matches what Save will persist.
  const liveDoc = useMemo(() => upgradeContent({
    ...resume.content,
    summary,
    skillSections,
    projects,
    achievements,
  }), [resume.content, summary, skillSections, projects, achievements]);

  const atsReport = useMemo(
    () => buildAtsReport({ doc: liveDoc, jdText: resume.jdText ?? undefined }),
    [liveDoc, resume.jdText],
  );

  const updateSkillCategory = (i: number, val: string) => {
    setSkillSections(prev => prev.map((s, idx) => idx === i ? { ...s, category: val } : s));
  };
  const updateSkillItems = (i: number, val: string) => {
    setSkillSections(prev => prev.map((s, idx) => idx === i ? { ...s, items: val } : s));
  };
  const addSkillSection = () => setSkillSections(prev => [...prev, { category: "", items: "" }]);
  const removeSkillSection = (i: number) => setSkillSections(prev => prev.filter((_, idx) => idx !== i));

  const updateProjectTitle = (i: number, val: string) => {
    setProjects(prev => prev.map((p, idx) => idx === i ? { ...p, title: val } : p));
  };
  const updateProjectTech = (i: number, val: string) => {
    setProjects(prev => prev.map((p, idx) => idx === i ? { ...p, tech: val } : p));
  };
  const updateProjectBullet = (pi: number, bi: number, val: string) => {
    setProjects(prev => prev.map((p, idx) => idx === pi
      ? { ...p, bullets: p.bullets.map((b, bidx) => bidx === bi ? val : b) }
      : p
    ));
  };
  const addProjectBullet = (pi: number) => {
    setProjects(prev => prev.map((p, idx) => idx === pi
      ? { ...p, bullets: [...p.bullets, ""] }
      : p
    ));
  };
  const removeProjectBullet = (pi: number, bi: number) => {
    setProjects(prev => prev.map((p, idx) => idx === pi
      ? { ...p, bullets: p.bullets.filter((_, bidx) => bidx !== bi) }
      : p
    ));
  };

  const updateAchievement = (i: number, val: string) => {
    setAchievements(prev => prev.map((a, idx) => idx === i ? val : a));
  };
  const addAchievement = () => setAchievements(prev => [...prev, ""]);
  const removeAchievement = (i: number) => setAchievements(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { summary, skillSections, projects, achievements },
          ...(templateId !== resume.templateId ? { templateId } : {}),
          snapshot: true,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to save");
      }
      const updated = await r.json() as SavedResume;
      toast({ title: "Changes saved!" });
      onSaved(updated);
      onClose();
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (index: number) => {
    setRestoringIndex(index);
    try {
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resume.id}/restore-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (!r.ok) throw new Error("Failed to restore");
      const updated = await r.json() as SavedResume;
      toast({ title: "Version restored" });
      onSaved(updated);
      onClose();
    } catch {
      toast({ title: "Restore failed", variant: "destructive" });
    } finally {
      setRestoringIndex(null);
    }
  };

  const versions = resume.versions ?? [];

  const previewPanel = (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {TEMPLATE_LIST.map(t => (
          <button
            key={t.id}
            onClick={() => setTemplateId(t.id)}
            className={`rounded-lg px-2 py-1.5 text-[10px] font-bold border transition-colors ${
              templateId === t.id ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ResumePreview resume={liveDoc} templateId={templateId} />
      {versions.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(v => !v)}
            className="text-[10px] font-bold text-ink-muted hover:text-brand flex items-center gap-1"
          >
            <History className="w-3 h-3" /> Version history ({versions.length}){showHistory ? " ▲" : " ▼"}
          </button>
          {showHistory && (
            <div className="mt-1.5 space-y-1">
              {versions.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-canvas rounded-lg px-2 py-1.5">
                  <span className="text-[10px] text-ink-muted">
                    {new Date(v.savedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {typeof v.atsScore === "number" && ` · ATS ${v.atsScore}%`}
                  </span>
                  <button
                    onClick={() => handleRestoreVersion(i)}
                    disabled={restoringIndex !== null}
                    className="h-6 px-2 rounded-full text-[9px] font-bold text-brand border border-brand/30 hover:bg-brand/10 disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    {restoringIndex === i ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Undo2 className="w-2.5 h-2.5" />}
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {atsReport && (
        <div className="bg-canvas border border-line rounded-xl p-3">
          <p className={`type-micro font-bold ${scoreTextClass(atsReport.scorePct)}`}>ATS match {atsReport.scorePct}%</p>
          <p className="type-micro text-ink/70 mt-1">
            {atsReport.mustCoverage.matched}/{atsReport.mustCoverage.total} must-have keywords covered
          </p>
        </div>
      )}
      {atsReport && resume.atsReport && (
        <AtsFixList
          studentId={studentId}
          resumeId={resume.id}
          atsReport={resume.atsReport}
          coverage={resume.evidenceMap?.coverage}
          content={{ skillSections: skillSections.map(s => ({ ...s, items: s.items })) }}
          onUpdated={saved => onSaved(saved as SavedResume)}
        />
      )}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-ink/40 flex items-end lg:items-center"
      onClick={requestClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-lg lg:max-w-4xl mx-auto bg-paper rounded-t-3xl lg:rounded-3xl flex flex-col max-h-[92vh] lg:max-h-[85dvh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center shrink-0 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-line shrink-0">
          <h2 className="text-display text-[18px] font-extrabold text-ink flex items-center gap-2">
            <Pencil className="w-4 h-4 text-ink" />
            Edit Resume
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobilePreview(true)}
              className="lg:hidden h-8 px-3 rounded-full border border-line flex items-center gap-1.5 text-[11px] font-bold text-brand"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            <button onClick={requestClose} className="w-8 h-8 rounded-full border border-line flex items-center justify-center">
              <X className="w-4 h-4 text-ink-muted" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden lg:flex lg:flex-row">
        <div className="overflow-y-auto h-full lg:flex-1 px-5 py-4 space-y-6">

          {/* Summary */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Professional Summary</label>
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={4}
              className="rounded-xl border border-line focus:border-brand text-ink text-sm resize-none"
            />
          </div>

          {/* Skills */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Skill Sections</label>
              <button
                onClick={addSkillSection}
                className="flex items-center gap-1 text-[11px] font-bold text-brand"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {skillSections.map((s, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={s.category}
                    onChange={e => updateSkillCategory(i, e.target.value)}
                    placeholder="Category (e.g. Languages)"
                    className="rounded-lg border border-line focus:border-brand text-ink text-sm h-8"
                  />
                  <Input
                    value={s.items}
                    onChange={e => updateSkillItems(i, e.target.value)}
                    placeholder="Items (comma-separated)"
                    className="rounded-lg border border-line focus:border-brand text-ink text-sm h-8"
                  />
                </div>
                <button
                  onClick={() => removeSkillSection(i)}
                  className="mt-1 text-danger shrink-0"
                >
                  <MinusCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Projects */}
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Projects</label>
            {projects.map((p, pi) => (
              <div key={pi} className="bg-paper rounded-xl p-3 space-y-2 border border-line">
                <div className="flex gap-2">
                  <Input
                    value={p.title}
                    onChange={e => updateProjectTitle(pi, e.target.value)}
                    placeholder="Project title"
                    className="rounded-lg border border-line focus:border-brand text-ink text-sm h-8 flex-1"
                  />
                  <Input
                    value={p.tech}
                    onChange={e => updateProjectTech(pi, e.target.value)}
                    placeholder="Tech stack"
                    className="rounded-lg border border-line focus:border-brand text-ink text-sm h-8 flex-1"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Bullets</p>
                  {p.bullets.map((b, bi) => (
                    <div key={bi} className="flex gap-1.5 items-center">
                      <Textarea
                        value={b}
                        onChange={e => updateProjectBullet(pi, bi, e.target.value)}
                        rows={2}
                        className="flex-1 rounded-lg border border-line focus:border-brand text-ink text-xs resize-none"
                      />
                      <button onClick={() => removeProjectBullet(pi, bi)} className="text-danger shrink-0">
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addProjectBullet(pi)}
                    className="flex items-center gap-1 text-[11px] font-bold text-brand mt-1"
                  >
                    <PlusCircle className="w-3 h-3" /> Add bullet
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Achievements */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Achievements</label>
              <button
                onClick={addAchievement}
                className="flex items-center gap-1 text-[11px] font-bold text-brand"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {achievements.map((a, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input
                  value={a}
                  onChange={e => updateAchievement(i, e.target.value)}
                  placeholder="Achievement"
                  className="flex-1 rounded-lg border border-line focus:border-brand text-ink text-sm h-8"
                />
                <button onClick={() => removeAchievement(i)} className="text-danger shrink-0">
                  <MinusCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop split-view preview — same panel content reused in the mobile overlay below */}
        <div className="hidden lg:flex lg:flex-col lg:w-[320px] lg:shrink-0 lg:border-l lg:border-line lg:overflow-y-auto lg:p-4 lg:space-y-3">
          {previewPanel}
        </div>
        </div>

        <div className="px-5 pb-8 pt-3 border-t border-line shrink-0">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-[15px]"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </motion.div>

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

// ─── Resume Card ──────────────────────────────────────────────────────────────

function ResumeCard({
  resume,
  onDelete,
  onDownload,
  onDownloadDocx,
  onCopyText,
  onShare,
  onEdit,
  onRetarget,
}: {
  resume: SavedResume;
  onDelete: () => void;
  onDownload: () => void;
  onDownloadDocx: () => void;
  onCopyText: () => void;
  onShare: () => void;
  onEdit: () => void;
  onRetarget: () => void;
}) {
  const [, setLocation] = useLocation();
  const tmpl = resolveTemplateConfig(resume.templateId);
  const date = new Date(resume.createdAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const liveDoc = useMemo(() => upgradeContent(resume.content), [resume.content]);
  const hollow = isContentEmpty(resume.content);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-paper rounded-2xl shadow-soft p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <ResumeThumbnail
          resume={liveDoc}
          templateId={resume.templateId}
          className="w-14 aspect-[1/1.414] rounded-md overflow-hidden shrink-0 border border-line"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink text-[15px] truncate">{resume.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-soft text-brand">
              {tmpl.label}
            </span>
            {resume.companyName && (
              <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1">
                <Building2 className="w-3 h-3" />{resume.companyName}
              </span>
            )}
            <span className="text-[11px] text-ink-muted">{date}</span>
          </div>
          {hollow ? (
            <button
              onClick={() => setLocation("/profile")}
              className="mt-2 text-[11px] font-semibold text-brand underline underline-offset-2 text-left"
            >
              Add your real work to make this resume real →
            </button>
          ) : liveDoc.atsMeta && (
            <div className="mt-2" title={
              liveDoc.atsMeta.missing.length > 0
                ? `Missing: ${liveDoc.atsMeta.missing.map(m => m.term).join(", ")} — skill gaps to learn, not padded in`
                : "All extracted JD keywords are covered by your real profile"
            }>
              {/* Semantic done/amber/danger tone — a score is a judgement, so
                  it must never render in brand indigo (scoreTone.ts). */}
              <span className={`type-micro font-bold px-2 py-0.5 rounded-full ${scoreBadgeClass(liveDoc.atsMeta.scorePct)}`}>
                ATS match {liveDoc.atsMeta.scorePct}%
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <Trash2 className="w-4 h-4 text-danger" />
        </button>
      </div>

      {resume.content.summary && (
        <p className="text-[12px] text-ink-muted line-clamp-2 mb-3 leading-relaxed">
          {resume.content.summary}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={onEdit}
          variant="outline"
          className="flex-1 h-9 rounded-full font-bold text-xs border border-line text-brand"
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Edit
        </Button>
        <Button
          onClick={onRetarget}
          variant="outline"
          className="flex-1 h-9 rounded-full font-bold text-xs border border-line text-ink-muted"
        >
          <Zap className="w-3.5 h-3.5 mr-1.5" />
          Retarget
        </Button>
        <Button
          onClick={onDownload}
          className="flex-1 h-9 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-xs"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          PDF
        </Button>
        <Button
          onClick={onDownloadDocx}
          variant="outline"
          className="flex-1 h-9 rounded-full font-bold text-xs border border-line text-ink-muted"
        >
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          DOCX
        </Button>
        <Button
          onClick={onCopyText}
          variant="outline"
          className="h-9 w-9 rounded-full border border-line text-ink-muted flex items-center justify-center shrink-0"
          title="Copy as plain text"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button
          onClick={onShare}
          variant="outline"
          className="h-9 w-9 rounded-full border border-line text-ink-muted flex items-center justify-center shrink-0"
          title={resume.shareSlug ? "Share link — already active" : "Create public share link"}
        >
          <Share2 className={`w-3.5 h-3.5 ${resume.shareSlug ? "text-brand" : ""}`} />
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Generate Sheet ───────────────────────────────────────────────────────────

function GenerateSheet({
  onClose,
  onGenerated,
  studentId,
  initialCompany = "",
  initialRole = "",
  initialJd = "",
  initialTags = [],
  initialParentResumeId,
}: {
  onClose: () => void;
  onGenerated: (r: SavedResume) => void;
  studentId: number;
  initialCompany?: string;
  initialRole?: string;
  initialJd?: string;
  initialTags?: string[];
  initialParentResumeId?: number;
}) {
  const { toast } = useToast();
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [templateId, setTemplateId] = useState("ats");
  const [jdText, setJdText] = useState(initialJd);
  const [companyName, setCompanyName] = useState(initialCompany);
  const [resumeName, setResumeName] = useState(
    initialCompany && initialRole ? `${initialCompany} — ${initialRole}` : ""
  );
  const [generating, setGenerating] = useState(false);
  const [generatedResume, setGeneratedResume] = useState<SavedResume | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Profile-emptiness gate: check on mount; show a quick-capture step for
  // users whose ledger has nothing yet (no skills, projects, or experience).
  type ProfileStep = "loading" | "capture" | "generate";
  const [profileStep, setProfileStep] = useState<ProfileStep>("loading");
  // One-shot handoff from the NameGate: if the guest row was created moments
  // ago, the capture step greets them by name so gate → capture reads as one
  // continuous flow instead of two separate asks.
  const [justCreated] = useState(() => {
    if (sessionStorage.getItem("kt:justCreated") !== "1") return false;
    sessionStorage.removeItem("kt:justCreated");
    return true;
  });
  const captureFirstName = (localStorage.getItem("studentName") ?? "").trim().split(/\s+/)[0] || "";
  const [captureSubmitting, setCaptureSubmitting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [captureResumeText, setCaptureResumeText] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubImporting, setGithubImporting] = useState(false);
  const [githubImportResult, setGithubImportResult] = useState<{ repos: number; projects: number } | null>(null);
  const [githubImportError, setGithubImportError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/students/${studentId}/full-profile`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { skills?: Record<string, number>; projects?: unknown[]; experience?: unknown[] } | null) => {
        if (!data) { setProfileStep("generate"); return; }
        const isEmpty =
          Object.keys(data.skills ?? {}).length === 0 &&
          (data.projects ?? []).length === 0 &&
          (data.experience ?? []).length === 0;
        setProfileStep(isEmpty ? "capture" : "generate");
      })
      .catch(() => setProfileStep("generate"));
  }, [studentId]);

  const handleCaptureContinue = async () => {
    setCaptureSubmitting(true);
    try {
      if (captureResumeText) {
        await apiFetch(`/api/students/${studentId}/profile/import-resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: captureResumeText }),
        });
      }
      if (skillTags.length > 0) {
        const skillsMap = Object.fromEntries(skillTags.map(s => [s.trim(), 50]));
        await apiFetch(`/api/students/${studentId}/profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skills: skillsMap }),
        });
      }
    } catch {
      // Non-fatal — proceed with whatever we already saved
    } finally {
      setCaptureSubmitting(false);
      setProfileStep("generate");
    }
  };

  // GitHub is real, verifiable evidence — the two calls must run in sequence
  // because github-projects reads the githubUrl analyze-github just persisted
  // (it 400s if the profile has no githubUrl yet).
  const handleGithubImport = async () => {
    const trimmed = githubUrl.trim();
    if (!trimmed) return;
    setGithubImporting(true);
    setGithubImportError(null);
    try {
      const analyzeRes = await apiFetch(`/api/students/${studentId}/analyze-github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: trimmed }),
      });
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Couldn't reach that GitHub profile");
      }
      const stats = await analyzeRes.json() as { publicRepos?: number };

      const projectsRes = await apiFetch(`/api/students/${studentId}/profile/github-projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const projectsData = projectsRes.ok
        ? await projectsRes.json() as { added?: number }
        : { added: 0 };

      setGithubImportResult({ repos: stats.publicRepos ?? 0, projects: projectsData.added ?? 0 });
    } catch (e) {
      setGithubImportError((e as Error).message || "Couldn't import from that GitHub URL — check it and try again.");
    } finally {
      setGithubImporting(false);
    }
  };

  const addSkillFromInput = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    const newTags = trimmed.split(",").map(s => s.trim()).filter(s => s && !skillTags.includes(s));
    if (newTags.length) setSkillTags(prev => [...prev, ...newTags]);
    setSkillInput("");
  };

  // SSE generation state
  type StageStatus = "pending" | "active" | "done";
  const STAGES: { name: string; key: string }[] = [
    { key: "jd", name: "Reading the job description" },
    { key: "map", name: "Matching against your real work" },
    { key: "draft", name: "Writing your bullets" },
    { key: "critic", name: "Running an ATS screen" },
  ];
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>({});
  const [findings, setFindings] = useState<{ have: number; partial: number; missing: string[] } | null>(null);

  const generate = async () => {
    setGenerating(true);
    setStageStatuses({});
    setFindings(null);
    const abortCtrl = new AbortController();
    try {
      const r = await apiFetch(`/api/students/${studentId}/resumes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({
          templateId, jdText, companyName, resumeName,
          roleTitle: initialRole, jobTags: initialTags,
          ...(initialParentResumeId ? { parentResumeId: initialParentResumeId } : {}),
        }),
        signal: abortCtrl.signal,
      });
      if (!r.ok || !r.body) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to generate");
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n").filter(l => l.startsWith("data: "))) {
          try {
            const data = JSON.parse(line.slice(6)) as {
              stage?: string; status?: string; message?: string;
              have?: number; partial?: number; missing?: string[];
              done?: boolean; resume?: SavedResume; error?: boolean;
            };
            if (data.stage && data.status) {
              setStageStatuses(prev => ({ ...prev, [data.stage!]: data.status === "start" ? "active" : "done" }));
            }
            if (data.stage === "map" && data.status === "done" && typeof data.have === "number") {
              setFindings({ have: data.have, partial: data.partial ?? 0, missing: data.missing ?? [] });
            }
            if (data.done) {
              if (data.error) throw new Error("Generation failed on server");
              if (data.resume) {
                toast({ title: "Resume ready!", description: data.resume.name });
                setGeneratedResume(data.resume as unknown as SavedResume);
              }
            }
          } catch (e) {
            if ((e as Error).message === "Generation failed on server") throw e;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast({ title: "Generation failed", description: (e as Error).message, variant: "destructive" });
      }
    } finally {
      setGenerating(false);
    }
  };

  const previewDoc = useMemo(
    () => (generatedResume ? upgradeContent(generatedResume.content) : null),
    [generatedResume],
  );

  const handleDone = async () => {
    if (!generatedResume) return;
    setFinishing(true);
    let finalResume = generatedResume;
    if (templateId !== generatedResume.templateId) {
      try {
        const r = await apiFetch(`/api/students/${studentId}/resumes/${generatedResume.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId }),
        });
        if (r.ok) finalResume = await r.json() as SavedResume;
      } catch {
        // Non-fatal — the resume was already generated and saved; keep its
        // original template rather than blocking the student here.
      }
    }
    setFinishing(false);
    onGenerated(finalResume);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-ink/40 flex items-end lg:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-lg mx-auto bg-paper rounded-t-3xl lg:rounded-3xl p-5 pb-8 space-y-5 max-h-[92dvh] lg:max-h-[85dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center -mt-2 mb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>

        {generatedResume && previewDoc ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-display text-[18px] font-extrabold text-ink flex items-center gap-2">
                <Check className="w-4 h-4 text-brand" />
                Resume Ready
              </h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full border border-line flex items-center justify-center">
                <X className="w-4 h-4 text-ink-muted" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                Try a different look
                <span className="text-ink-muted normal-case font-medium ml-1">(instant — no AI call)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATE_LIST.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`rounded-xl p-3 text-left border transition-colors ${
                      templateId === t.id
                        ? "border-brand bg-brand-soft"
                        : "border-line bg-paper"
                    }`}
                  >
                    <p className="font-bold text-ink text-xs">{t.label}</p>
                    <p className="text-[10px] text-ink-muted mt-0.5 leading-tight">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {generatedResume ? (
              <InlineEditPreview
                resume={previewDoc}
                templateId={templateId}
                studentId={studentId}
                resumeId={generatedResume.id}
                className="max-w-[280px] mx-auto"
                onUpdated={updated => setGeneratedResume(updated as SavedResume)}
              />
            ) : (
              <ResumePreview resume={previewDoc} templateId={templateId} className="max-w-[280px] mx-auto" />
            )}

            {isContentEmpty(generatedResume.content) ? (
              <div className="rounded-xl bg-canvas border border-line p-3 space-y-2 text-[12px] text-center">
                <p className="font-semibold text-ink">This resume has nothing to work with yet</p>
                <p className="text-ink-muted leading-snug">
                  Add your GitHub, projects, or skills and regenerate — a resume can only be as real as what you give it.
                </p>
                <button
                  onClick={() => { onClose(); setLocation("/profile"); }}
                  className="text-brand font-semibold underline underline-offset-2"
                >
                  Add your real work →
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                {previewDoc.atsMeta ? (
                  <span className={`type-micro font-bold px-2 py-0.5 rounded-full ${scoreBadgeClass((previewDoc.atsMeta as { scorePct?: number }).scorePct ?? 0)}`}>
                    ATS match {(previewDoc.atsMeta as { scorePct?: number }).scorePct}%
                  </span>
                ) : (
                  // No JD or target role was given, so there's nothing to score
                  // keyword coverage against — the trust line still applies.
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-canvas border border-line text-ink-muted">
                    No target job set — add one to see an ATS match score
                  </span>
                )}
                <p className="text-[10px] text-ink-muted">Every bullet is backed by your profile — nothing invented</p>
              </div>
            )}

            {generatedResume?.evidenceMap?.thesis && (
              <div className="rounded-xl bg-canvas border border-line p-3 space-y-1.5 text-[12px]">
                <p className="font-semibold text-ink">What the AI focused on</p>
                <p className="text-ink-muted leading-snug">{generatedResume.evidenceMap.thesis}</p>
                {generatedResume.evidenceMap.honestGaps && generatedResume.evidenceMap.honestGaps.length > 0 && (
                  <p className="text-ink-muted">
                    Not matched: <span className="font-medium text-ink">{generatedResume.evidenceMap.honestGaps.map(g => g.term).join(", ")}</span>
                  </p>
                )}
              </div>
            )}

            {generatedResume?.atsReport && (
              <AtsFixList
                studentId={studentId}
                resumeId={generatedResume.id}
                atsReport={generatedResume.atsReport}
                coverage={generatedResume.evidenceMap?.coverage}
                content={{ skillSections: generatedResume.content.skillSections }}
                onUpdated={updated => setGeneratedResume(updated as SavedResume)}
              />
            )}

            {generatedResume && (
              <div className="flex gap-2">
                <Button
                  onClick={() => gateOnSignup(isLoaded, isSignedIn, setLocation, generatedResume.id, "pdf", () =>
                    downloadResumePDF(generatedResume).catch(() => toast({ title: "PDF error", variant: "destructive" })))}
                  className="flex-1 h-10 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  PDF
                </Button>
                <Button
                  onClick={() => gateOnSignup(isLoaded, isSignedIn, setLocation, generatedResume.id, "docx", () =>
                    downloadResumeDocx(generatedResume).catch(() => toast({ title: "DOCX error", variant: "destructive" })))}
                  variant="outline"
                  className="flex-1 h-10 rounded-full border border-line text-ink-muted font-bold text-xs"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  DOCX
                </Button>
                <Button
                  onClick={() => {
                    const d = upgradeContent(generatedResume.content);
                    navigator.clipboard.writeText(renderPlainText(d)).then(() => toast({ title: "Copied to clipboard" })).catch(() => toast({ title: "Copy failed", variant: "destructive" }));
                  }}
                  variant="outline"
                  className="h-10 w-10 rounded-full border border-line text-ink-muted flex items-center justify-center shrink-0"
                  title="Copy as plain text"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            <Button
              onClick={handleDone}
              disabled={finishing}
              className="w-full h-12 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-[15px]"
            >
              {finishing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Finishing…
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Done
                </>
              )}
            </Button>
          </>
        ) : profileStep === "loading" ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-brand animate-spin" />
          </div>

        ) : profileStep === "capture" ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-display type-title font-extrabold text-ink">
                {justCreated && captureFirstName
                  ? `Nice to meet you, ${captureFirstName} — one quick thing`
                  : "First, tell us about you"}
              </h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full border border-line flex items-center justify-center shrink-0">
                <X className="w-4 h-4 text-ink-muted" />
              </button>
            </div>

            <p className="type-caption text-ink-muted">
              Import your GitHub, upload an existing resume, or add a few skills so we have real
              facts to write from. The more you give, the stronger the output.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                Import from GitHub
                <span className="text-ink-muted normal-case font-medium ml-1">(recommended — real, verifiable work)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  placeholder="github.com/yourusername"
                  className="rounded-xl border border-line focus:border-brand text-ink flex-1"
                  disabled={githubImporting || !!githubImportResult}
                />
                <Button
                  onClick={handleGithubImport}
                  disabled={githubImporting || !githubUrl.trim() || !!githubImportResult}
                  variant="outline"
                  className="rounded-xl border border-line text-brand px-3"
                >
                  {githubImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import"}
                </Button>
              </div>
              {githubImportResult && (
                <p className="text-[12px] text-brand font-medium">
                  Imported {githubImportResult.repos} repo{githubImportResult.repos === 1 ? "" : "s"}, {githubImportResult.projects} new project{githubImportResult.projects === 1 ? "" : "s"}
                </p>
              )}
              {githubImportError && (
                <p className="text-[12px] text-danger">{githubImportError}</p>
              )}
            </div>

            <ResumeImport
              deferred
              onTextReady={(text) => setCaptureResumeText(text)}
              label={captureResumeText ? "Resume uploaded" : "Or upload your existing resume (PDF / DOCX)"}
            />

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                Or type your skills
                <span className="text-ink-muted normal-case font-medium ml-1">(comma separated)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkillFromInput(); } }}
                  placeholder="React, Node.js, SQL…"
                  className="rounded-xl border border-line focus:border-brand text-ink flex-1"
                />
                <Button
                  onClick={addSkillFromInput}
                  variant="outline"
                  className="rounded-xl border border-line text-ink-muted px-3"
                >
                  Add
                </Button>
              </div>
              {skillTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skillTags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-soft text-brand text-[11px] font-medium"
                    >
                      {tag}
                      <button
                        onClick={() => setSkillTags(prev => prev.filter(t => t !== tag))}
                        className="hover:text-brand/60"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={handleCaptureContinue}
              disabled={captureSubmitting}
              className="w-full h-12 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-[15px]"
            >
              {captureSubmitting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Saving…</>
              ) : (
                <><Check className="w-5 h-5 mr-2" />Continue</>
              )}
            </Button>

            <div className="text-center">
              <button
                onClick={() => setProfileStep("generate")}
                className="text-[12px] text-ink-muted hover:text-ink underline underline-offset-2"
              >
                Generate a starter template anyway
              </button>
              <p className="text-[11px] text-ink-muted mt-1">
                Without your real work this will be a near-empty template — nothing to show a recruiter yet.
              </p>
            </div>
          </>

        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-display text-[18px] font-extrabold text-ink flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand" />
                Generate New Resume
              </h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full border border-line flex items-center justify-center">
                <X className="w-4 h-4 text-ink-muted" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Template</label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATE_LIST.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`rounded-xl p-3 text-left border transition-colors ${
                      templateId === t.id
                        ? "border-brand bg-brand-soft"
                        : "border-line bg-paper"
                    }`}
                  >
                    <p className="font-bold text-ink text-xs">{t.label}</p>
                    <p className="text-[10px] text-ink-muted mt-0.5 leading-tight">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Company Name
                <span className="text-ink-muted normal-case font-medium ml-1">(optional)</span>
              </label>
              <Input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. Google, Flipkart, Razorpay"
                className="rounded-xl border border-line focus:border-brand text-ink"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1">
                <AlignLeft className="w-3 h-3" /> Job Description
                <span className="text-ink-muted normal-case font-medium ml-1">(optional — paste JD for tailored resume)</span>
              </label>
              <Textarea
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder="Paste job description here for an ATS-optimized, targeted resume..."
                rows={4}
                className="rounded-xl border border-line focus:border-brand text-ink text-sm resize-none"
              />
              {!jdText && (initialCompany || initialTags.length > 0) && (
                <p className="text-[11px] text-ink-muted">
                  Tip: paste the JD from the posting for the strongest tailoring.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                Resume Name
                <span className="text-ink-muted normal-case font-medium ml-1">(optional)</span>
              </label>
              <Input
                value={resumeName}
                onChange={e => setResumeName(e.target.value)}
                placeholder="e.g. Google SWE Resume, FAANG Attempt 1"
                className="rounded-xl border border-line focus:border-brand text-ink"
              />
            </div>

            {generating ? (
              <div className="space-y-3 py-1">
                {STAGES.map(s => {
                  const status = stageStatuses[s.key] ?? "pending";
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      {status === "done" ? (
                        <Check className="w-4 h-4 text-brand flex-shrink-0" />
                      ) : status === "active" ? (
                        <Loader2 className="w-4 h-4 text-brand animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-line flex-shrink-0" />
                      )}
                      <span className={`text-[13px] ${status === "pending" ? "text-ink-muted" : "text-ink font-medium"}`}>
                        {s.name}
                      </span>
                    </div>
                  );
                })}
                {findings && (
                  <div className="rounded-xl bg-brand-soft border border-brand/20 p-3 mt-2 text-[12px]">
                    <p className="font-semibold text-ink mb-1">Skills found in this JD:</p>
                    <p className="text-ink/70">
                      {findings.have} matched strongly, {findings.partial} partial
                      {findings.missing.length > 0 && (
                        <span> — missing: <span className="font-medium text-ink">{findings.missing.join(", ")}</span></span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <Button
                onClick={generate}
                className="w-full h-12 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-[15px]"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Resume
              </Button>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Resume() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isSignedIn, isLoaded } = useUser();
  // Explore-first: anonymous visitors (no studentId) get a rich sample resume
  // via <ResumeDemo/> instead of a redirect. `studentId` here is the single
  // source of truth from localStorage, kept in sync across the demo→real flip
  // by useStudentId's external store.
  const { studentId, isDemo } = useStudentId();
  const { requireStudent } = useNameGate();
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateFor, setGenerateFor] = useState<
    { company: string; role: string; jd?: string; tags?: string[]; parentResumeId?: number } | null
  >(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingResume, setEditingResume] = useState<SavedResume | null>(null);

  // Explore-mode "start my own" flow. Stash the intent BEFORE the gate — same
  // idiom as gateOnSignup's stashDownloadIntent — then route through the
  // NameGate, which creates the guest row and flips studentId. The studentId
  // effect below then consumes the flag and opens the generation sheet, so the
  // tapped "build" action continues across the demo→real transition (fix 9).
  const handleStartOwn = useCallback(() => {
    sessionStorage.setItem("kt:autoOpenGenerate", "1");
    // Title only — the gate's default subtitle carries the ask; passing
    // "What should we call you?" here duplicated the field's question.
    requireStudent(() => {}, { title: "Let's build your resume" });
  }, [requireStudent]);

  // Once a studentId exists (including right after the gate creates a guest
  // row), auto-open the generation sheet if the "build" intent was stashed.
  useEffect(() => {
    if (!studentId) return;
    if (sessionStorage.getItem("kt:autoOpenGenerate") === "1") {
      sessionStorage.removeItem("kt:autoOpenGenerate");
      setGenerateFor({ company: "", role: "" });
    }
  }, [studentId]);

  // Breadcrumb for Home's Continue chip — every generation-sheet open (button, post-gate auto-open, resumeContext seed) counts as resume activity. Real students only.
  useEffect(() => { if (generateFor !== null && studentId) { try { localStorage.setItem("kt:lastActivity", JSON.stringify({ label: "your resume", href: "/resume" })); } catch { /* quota — non-fatal */ } } }, [generateFor, studentId]);

  // Warm the font cache and pdf.js worker so the first live preview doesn't eat the delay.
  useEffect(() => {
    preloadFonts();
    preloadPdfjs();
  }, []);

  // Seeded by Opportunities/Pipeline via sessionStorage.resumeContext — consumed
  // once so a refresh or back-nav to /resume never reopens the sheet.
  useEffect(() => {
    const raw = sessionStorage.getItem("resumeContext");
    if (!raw) return;
    sessionStorage.removeItem("resumeContext");
    try {
      const ctx = JSON.parse(raw) as { company?: string; role?: string; jd?: string; tags?: string[] };
      setGenerateFor({
        company: ctx.company ?? "",
        role: ctx.role ?? "",
        jd: ctx.jd ?? "",
        tags: Array.isArray(ctx.tags) ? ctx.tags : [],
      });
    } catch {
      // malformed context — ignore, sheet simply doesn't auto-open
    }
  }, []);

  const fetchResumes = useCallback(async (id: number) => {
    try {
      const r = await apiFetch(`/api/students/${id}/resumes`);
      if (r.ok) {
        const data = await r.json() as SavedResume[];
        setResumes(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (studentId) fetchResumes(studentId);
  }, [studentId, fetchResumes]);

  // Powers the "add experience" nudge below — the resume pipeline can only
  // fill an Experience section from what's actually in the student's profile.
  const [experienceCount, setExperienceCount] = useState<number | null>(null);
  useEffect(() => {
    if (!studentId) return;
    apiFetch(`/api/students/${studentId}/full-profile`)
      .then(r => r.ok ? r.json() : null)
      .then((p: { experience?: unknown[] } | null) => setExperienceCount(Array.isArray(p?.experience) ? p.experience.length : 0))
      .catch(() => setExperienceCount(0));
  }, [studentId]);

  const handleGenerated = (saved: SavedResume) => {
    setResumes(prev => [saved, ...prev]);
  };

  const handleResumeUpdated = (updated: SavedResume) => {
    setResumes(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const handleDownloadPdf = useCallback((resume: SavedResume) => {
    downloadResumePDF(resume).catch((e) => {
      toast({ title: "Couldn't generate PDF", description: (e as Error).message, variant: "destructive" });
    });
  }, [toast]);

  const handleDownloadDocx = useCallback((resume: SavedResume) => {
    downloadResumeDocx(resume).catch((e) => {
      toast({ title: "Couldn't generate DOCX", description: (e as Error).message, variant: "destructive" });
    });
  }, [toast]);

  const handleShare = useCallback((resume: SavedResume) => {
    if (resume.shareSlug) {
      const url = `${window.location.origin}/r/${resume.shareSlug}`;
      navigator.clipboard.writeText(url).then(() => {
        toast({ title: "Link copied", description: url });
      }).catch(() => toast({ title: url }));
      return;
    }
    apiFetch(`/api/students/${resume.studentId}/resumes/${resume.id}/share`, { method: "POST" })
      .then(r => r.json())
      .then((data: { slug: string }) => {
        const url = `${window.location.origin}/r/${data.slug}`;
        setResumes(prev => prev.map(r => r.id === resume.id ? { ...r, shareSlug: data.slug } : r));
        navigator.clipboard.writeText(url).catch(() => undefined);
        toast({ title: "Share link created", description: url });
      })
      .catch(() => toast({ title: "Couldn't create share link", variant: "destructive" }));
  }, [toast]);

  // Resumes a download/share intent stashed before a guest was sent to sign
  // up — fires once the student is back, signed in, and their resumes are
  // loaded (the intent's resumeId needs to be in the fetched list).
  const consumedIntentRef = useRef(false);
  useEffect(() => {
    if (!isSignedIn || loading || consumedIntentRef.current) return;
    const intent = consumeDownloadIntent();
    if (!intent) return;
    consumedIntentRef.current = true;
    const resume = resumes.find(r => r.id === intent.resumeId);
    if (!resume) return;
    if (intent.intent === "pdf") handleDownloadPdf(resume);
    else if (intent.intent === "docx") handleDownloadDocx(resume);
    else if (intent.intent === "share") handleShare(resume);
  }, [isSignedIn, loading, resumes, handleDownloadPdf, handleDownloadDocx, handleShare]);

  const handleDelete = async (resumeId: number) => {
    if (!studentId) return;
    setDeletingId(resumeId);
    try {
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resumeId}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Failed to delete");
      setResumes(prev => prev.filter(r => r.id !== resumeId));
      toast({ title: "Resume deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // Anonymous visitor: render the read-only sample resume purely from fixtures.
  // Never fall through to the authed page (its /students/:id queries would 401
  // and wipe localStorage). Every action funnels to handleStartOwn → NameGate.
  if (isDemo) return <ResumeDemo onStart={handleStartOwn} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <PageHeader
          title="My Resumes"
          subtitle="AI-generated from your real profile · ATS-friendly"
        />
        <div className="bg-canvas rounded-t-3xl -mt-6 min-h-[60vh] pb-28">
          <div className="p-4 pt-6 max-w-md lg:max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-canvas">
        {/* Resume is a bottom-nav tab destination — canopy, no back button
            (TopBar owns the rare non-tab back affordance). */}
        <PageHeader
          title="My Resumes"
          subtitle="AI-generated from your real profile · ATS-friendly"
          right={
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                onClick={() => setGenerateFor({ company: "", role: "" })}
                className="rounded-full bg-white/15 text-white hover:bg-white/25 font-bold px-4 h-10"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New
              </Button>
            </motion.div>
          }
        />

        {/* Sheet */}
        <div className="bg-canvas rounded-t-3xl -mt-6 min-h-[60vh] pb-28">
          <div className="p-4 pt-6 max-w-md lg:max-w-2xl mx-auto space-y-5">

        {isGuestSession(isLoaded, isSignedIn) && (
          <div className="bg-paper rounded-2xl shadow-soft p-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="type-caption font-bold text-ink">Saved on this device only</p>
              <p className="type-micro text-ink-muted mt-0.5">Sign in to keep your resumes if you switch devices or clear your browser.</p>
            </div>
            <Button
              onClick={() => setLocation("/sign-up")}
              variant="outline"
              className="rounded-full border border-line text-brand font-bold text-xs px-3.5 h-8 shrink-0"
            >
              Sign In
            </Button>
          </div>
        )}

        {/* ── Company & Role Recommendations */}
        {studentId && (
          <TargetRecommendations
            studentId={studentId}
            onGenerate={(company, role) => setGenerateFor({ company, role })}
          />
        )}

        {resumes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-paper rounded-2xl shadow-soft p-6 flex flex-col items-center text-center gap-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center">
              <FileText className="w-7 h-7 text-brand" />
            </div>
            <p className="type-body text-ink-muted max-w-[17rem]">
              Turn your GitHub and a job post into an ATS-ready resume in minutes.
            </p>
            <Button
              onClick={() => setGenerateFor({ company: "", role: "" })}
              className="rounded-full bg-brand text-white hover:bg-brand/90 font-bold px-5 h-11"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Build my resume
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Your Resumes</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
              <AnimatePresence mode="popLayout">
                {resumes.map(resume => (
                  <ResumeCard
                    key={resume.id}
                    resume={resume}
                    onDelete={() => {
                      if (deletingId !== resume.id) handleDelete(resume.id);
                    }}
                    onDownload={() => gateOnSignup(isLoaded, isSignedIn, setLocation, resume.id, "pdf", () => handleDownloadPdf(resume))}
                    onDownloadDocx={() => gateOnSignup(isLoaded, isSignedIn, setLocation, resume.id, "docx", () => handleDownloadDocx(resume))}
                    onCopyText={() => {
                      const doc = upgradeContent(resume.content);
                      navigator.clipboard.writeText(renderPlainText(doc)).then(() => {
                        toast({ title: "Copied", description: "Resume text copied to clipboard" });
                      }).catch(() => {
                        toast({ title: "Copy failed", description: "Clipboard access denied", variant: "destructive" });
                      });
                    }}
                    onShare={() => gateOnSignup(isLoaded, isSignedIn, setLocation, resume.id, "share", () => handleShare(resume))}
                    onEdit={() => setEditingResume(resume)}
                    onRetarget={() => setGenerateFor({
                      company: resume.companyName ?? "",
                      role: "",
                      jd: resume.jdText ?? "",
                      tags: [],
                      parentResumeId: resume.id,
                    })}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        <div className="bg-paper rounded-2xl shadow-soft p-4">
          <p className="text-[14px] font-bold text-ink mb-1">Pro tip</p>
          <p className="text-[12px] text-ink-muted leading-relaxed">
            {experienceCount === 0
              ? "Your Experience section is empty — even an internship or a part-time freelance gig gives the AI real material to write from."
              : "Complete your Profile with real projects and certifications — the AI will use them to generate a much stronger, targeted resume for each company."}
          </p>
          <button
            onClick={() => {
              if (experienceCount === 0) {
                sessionStorage.setItem("profileScrollTo", "experience-section");
              }
              setLocation("/profile");
            }}
            className="mt-3 flex items-center gap-1 text-[12px] font-bold text-brand"
          >
            {experienceCount === 0 ? "Add experience" : "Update my profile"} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {generateFor !== null && studentId && (
          <GenerateSheet
            studentId={studentId}
            onClose={() => setGenerateFor(null)}
            onGenerated={handleGenerated}
            initialCompany={generateFor.company}
            initialRole={generateFor.role}
            initialJd={generateFor.jd}
            initialTags={generateFor.tags}
            initialParentResumeId={generateFor.parentResumeId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingResume && studentId && (
          <EditResumeSheet
            resume={editingResume}
            studentId={studentId}
            onClose={() => setEditingResume(null)}
            onSaved={handleResumeUpdated}
          />
        )}
      </AnimatePresence>
    </>
  );
}
