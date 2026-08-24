import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Github, Linkedin, Globe, Phone, Edit2, Check, X, Plus, Trash2,
  Briefcase, Award, MapPin, DollarSign, FileText,
  Loader2, ExternalLink, Star,
  Code2, Building2, TrendingUp, Zap, ChevronRight, Sparkles,
  Camera, User, BookOpen, Save, Share, ShieldCheck,
} from "lucide-react";
import {
  useListCertificates,
  useSetCertificateResumeFlag,
} from "@workspace/api-client-react";
import type { CourseCertificate } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { apiFetch } from "@/lib/api/authFetch";
import { ResumeImport } from "@/components/ResumeImport";
import { CollegePicker } from "@/components/ninelab/CollegePicker";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { useStudentId } from "@/hooks/useStudentId";
import { useNameGate } from "@/components/NameGate";
import { useIsGuest, GuestSavedChip } from "@/components/GuestSavedChip";
import ProfileDemo from "@/components/demo/ProfileDemo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  githubUrl?: string;
  liveUrl?: string;
}
interface Certification {
  id: string;
  name: string;
  issuer: string;
  date?: string;
  credentialUrl?: string;
}
interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  period: string;
  bullets: string[];
}
interface Education {
  id: string;
  degree: string;
  institution: string;
  field?: string;
  start?: string;
  end?: string;
  cgpa?: string;
}
interface GitHubStats {
  username: string;
  publicRepos: number;
  followers: number;
  bio: string;
  topLanguages: string[];
  topRepos: { name: string; stars: number; language: string; description: string }[];
  analyzedAt: string;
}
interface LinkedInData {
  strengthScore: number;
  profileTier: string;
  highlights: string[];
  improvements: string[];
  recruitersWillNotice: string;
}
interface FullProfile {
  id: number;
  name: string;
  email: string;
  college: string;
  city: string;
  year: number;
  field: string;
  photoUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  phone?: string;
  bio?: string;
  cgpa?: string;
  targetPackage?: string;
  dreamCompany?: string;
  projects: Project[];
  certifications: Certification[];
  experience: ExperienceEntry[];
  education: Education[];
  openToWork: boolean;
  workMode?: string;
  preferredLocations: string[];
  expectedSalary?: string;
  githubStats?: GitHubStats;
  linkedinData?: LinkedInData;
  profileStrength: number;
  commitmentScore: number;
  overallScore: number;
  xp: number;
  level: number;
  streakCount: number;
  skills: Record<string, number>;
  isPro: boolean;
}

async function fetchProfile(id: number): Promise<FullProfile> {
  const r = await apiFetch(`/api/students/${id}/full-profile`);
  if (!r.ok) throw new Error("Failed to load profile");
  return r.json();
}

async function patchProfile(id: number, data: Record<string, unknown>) {
  const r = await apiFetch(`/api/students/${id}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to save");
  return r.json();
}

// ─── Strength Ring ────────────────────────────────────────────────────────────

function StrengthRing({ value }: { value: number }) {
  const r = 36, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#ecedf3" strokeWidth="8" />
        <motion.circle
          cx="48" cy="48" r={r} fill="none" stroke="#4a55c7" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-extrabold text-ink">{value}%</span>
        <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Profile</span>
      </div>
    </div>
  );
}

// ─── My Resumes Card ──────────────────────────────────────────────────────────

const TEMPLATE_BADGES: Record<string, { label: string; badge: string }> = {
  classic: { label: "Classic", badge: "border border-line text-ink-muted" },
  tech: { label: "Tech", badge: "border border-line text-ink-muted" },
  minimal: { label: "Minimal", badge: "border border-line text-ink-muted" },
};

/**
 * Everything the platform tracked automatically. Locked spec: platform actions
 * write back to context on their own; outside-world events (interview calls,
 * offers) stay the student's to record. Every number here counts real rows —
 * nothing estimated, nothing inferred.
 */
function ActivityCard({ studentId }: { studentId: number }) {
  const [stats, setStats] = useState<{
    mockInterviews: number;
    resumesGenerated: number;
    applicationsOpened: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/students/${studentId}/activity/summary`)
      .then(r => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="bg-paper rounded-2xl shadow-soft p-5">
        <Skeleton className="h-4 w-32 rounded mb-4" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    );
  }
  if (!stats) return null;

  const rows: { label: string; value: number }[] = [
    { label: "Mock interviews taken", value: stats.mockInterviews },
    { label: "Resumes generated", value: stats.resumesGenerated },
    { label: "Applications opened", value: stats.applicationsOpened },
  ];
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="bg-paper rounded-2xl shadow-soft p-5">
      <h3 className="text-[14px] font-bold text-ink mb-1 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-ink" /> Your activity
      </h3>
      {total === 0 ? (
        <p className="text-[12px] text-ink-muted">
          Nothing yet. Practice an interview or generate a resume — it shows up here automatically.
        </p>
      ) : (
        <div className="mt-2">
          {rows.map(r => (
            <div key={r.label} className="flex items-baseline justify-between py-2.5 border-t border-line first:border-t-0">
              <p className="text-[13px] text-ink">{r.label}</p>
              <p className="text-[13px] font-bold text-ink tabular-nums">{r.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * iOS-only prompt to add the app to the home screen.
 *
 * Android and desktop are left to the browser's own install affordance, which
 * is the product's choice. iOS has no equivalent: Safari never offers to
 * install a PWA and exposes no API to ask, so without this row an iPhone
 * student has no way to discover the app is installable at all.
 */
function InstallCard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // navigator.standalone is the iOS-specific signal for "already installed";
    // the display-mode query covers the same thing on newer versions.
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // iPadOS 13+ reports a desktop Safari user-agent, so the UA test alone
    // misses every modern iPad. A Mac that reports touch points is one.
    const iPadOS =
      navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || iPadOS;
    setShow(isIOS && !installed);
  }, []);

  if (!show) return null;

  return (
    <div className="bg-paper rounded-2xl shadow-soft p-5">
      <h3 className="text-[14px] font-bold text-ink mb-1 flex items-center gap-2">
        <Share className="w-4 h-4 text-ink" /> Add to home screen
      </h3>
      <p className="text-[12px] text-ink-muted">
        Tap the Share button in Safari, then choose <span className="font-semibold text-ink">Add to Home Screen</span> to
        open ninelab like an app.
      </p>
    </div>
  );
}

function MyResumesCard({ studentId, onNavigate }: { studentId: number; onNavigate: () => void }) {
  const [resumes, setResumes] = useState<{ id: number; name: string; templateId: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/students/${studentId}/resumes`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setResumes(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => setResumes([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  return (
    <div className="bg-paper rounded-2xl shadow-soft">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-bold text-ink flex items-center gap-2">
            <FileText className="w-4 h-4 text-ink" /> My Resumes
          </h3>
          <button onClick={onNavigate} className="text-[11px] font-bold text-ink flex items-center gap-0.5">
            Open <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-3/4 rounded-xl" />
          </div>
        ) : resumes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <Sparkles className="w-5 h-5 text-ink-muted" />
            <p className="text-[12px] text-ink-muted">AI-tailored to any JD · 4 templates</p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onNavigate}
              className="w-full mt-1 bg-brand text-white text-[13px] font-bold rounded-full px-4 py-3"
            >
              Generate your first resume
            </motion.button>
          </div>
        ) : (
          <div>
            {resumes.map(r => {
              const tmpl = TEMPLATE_BADGES[r.templateId] ?? TEMPLATE_BADGES["classic"];
              const date = new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
              return (
                <div key={r.id} className="flex items-center justify-between py-3 border-t border-line first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink truncate">{r.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${tmpl.badge}`}>{tmpl.label}</span>
                      <span className="text-[10px] text-ink-muted">{date}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {resumes.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onNavigate}
                className="w-full mt-3 bg-brand text-white text-[13px] font-bold py-3 rounded-full"
              >
                View all & download →
              </motion.button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Verified course certificates the platform issued. Distinct from the manual
 * "Certifications" card above: these are earned in-app (70% final exam + an
 * AI-evaluated mock interview) and each carries a public verify page.
 */
function CertificatesCard({ studentId }: { studentId: number }) {
  const { data: certs, isLoading } = useListCertificates(studentId);
  const setFlag = useSetCertificateResumeFlag();
  // Optimistic overrides keyed by certificate id — the toggle reflects instantly
  // and only reverts if the PATCH fails.
  const [pending, setPending] = useState<Record<number, boolean>>({});

  const toggle = (cert: CourseCertificate) => {
    const next = !(pending[cert.id] ?? cert.includeOnResume);
    setPending(p => ({ ...p, [cert.id]: next }));
    // The resume-flag endpoint is keyed by enrollmentId. The list returns full
    // rows so enrollmentId is present at runtime even though the generated
    // CourseCertificate type omits it.
    const enrollmentId = (cert as CourseCertificate & { enrollmentId: number }).enrollmentId;
    setFlag.mutate(
      { id: studentId, enrollmentId, data: { includeOnResume: next } },
      { onError: () => setPending(p => ({ ...p, [cert.id]: !next })) },
    );
  };

  if (isLoading) {
    return (
      <div className="bg-paper rounded-2xl shadow-soft p-5">
        <Skeleton className="h-4 w-40 rounded mb-4" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-paper rounded-2xl shadow-soft">
      <div className="p-5">
        <h3 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-ink" /> Certificates
        </h3>

        {!certs || certs.length === 0 ? (
          <p className="text-[12px] text-ink-muted">Complete a course to earn a verified certificate.</p>
        ) : (
          <div>
            {certs.map(cert => {
              const checked = pending[cert.id] ?? cert.includeOnResume;
              const issued = new Date(cert.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
              return (
                <div key={cert.id} className="py-4 border-t border-line first:border-t-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/certs/${cert.verifySlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[14px] font-semibold text-ink hover:text-brand inline-flex items-center gap-1"
                      >
                        {cert.subDomainName} <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      <p className="text-[12px] text-ink-muted mt-0.5">{cert.domainName} · {issued}</p>
                      <p className="text-[11px] text-ink-muted mt-0.5 font-mono">{cert.certificateCode}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
                      <Award className="w-4 h-4 text-brand" />
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(cert)}
                    className="mt-2.5 flex items-center gap-2 text-[12px] font-semibold text-ink"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? "bg-brand border-brand" : "border-line bg-paper"}`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                    Show on resume
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Work Mode Picker ─────────────────────────────────────────────────────────

const WORK_MODES = ["remote", "hybrid", "onsite"];

const YEAR_OPTIONS = [1, 2, 3, 4, 5];
const FIELD_OPTIONS = [
  "Computer Science", "Information Technology", "Electronics & Communication",
  "Electrical Engineering", "Mechanical Engineering", "Civil Engineering",
  "Chemical Engineering", "Biotechnology", "Data Science", "Artificial Intelligence",
  "Cybersecurity", "Other",
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const prefersReduced = useReducedMotion();
  const { isDemo } = useStudentId();
  const { requireStudent } = useNameGate();
  const isGuestAccount = useIsGuest();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState<"github" | "linkedin" | null>(null);
  const [prefillingProjects, setPrefillingProjects] = useState(false);

  // ── Edit buffers ──────────────────────────────────────────────────────────
  const [basicForm, setBasicForm] = useState({
    name: "", college: "", city: "", year: 1, field: "", cgpa: "", photoUrl: "",
  });
  const [linksForm, setLinksForm] = useState({ githubUrl: "", linkedinUrl: "", portfolioUrl: "", phone: "" });
  const [bioForm, setBioForm] = useState("");
  const [prefsForm, setPrefsForm] = useState({ workMode: "hybrid", preferredLocations: "", expectedSalary: "" });
  const [newProject, setNewProject] = useState<Omit<Project, "id">>({ title: "", description: "", techStack: [], githubUrl: "", liveUrl: "" });
  const [newCert, setNewCert] = useState<Omit<Certification, "id">>({ name: "", issuer: "", date: "", credentialUrl: "" });
  const [techInput, setTechInput] = useState("");
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddCert, setShowAddCert] = useState(false);
  const [newEducation, setNewEducation] = useState<Omit<Education, "id">>({ degree: "", institution: "", field: "", start: "", end: "", cgpa: "" });
  const [showAddEducation, setShowAddEducation] = useState(false);
  const [newExperience, setNewExperience] = useState<Omit<ExperienceEntry, "id">>({ company: "", role: "", period: "", bullets: [] });
  const [expStart, setExpStart] = useState("");
  const [expEnd, setExpEnd] = useState("");
  const [expBulletInput, setExpBulletInput] = useState("");
  const [showAddExperience, setShowAddExperience] = useState(false);
  const [linkedinForm, setLinkedinForm] = useState({ headline: "", summary: "", skills: "", experience: "" });
  const [showLinkedinForm, setShowLinkedinForm] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<string>("");

  useEffect(() => {
    // No studentId → explore mode; ProfileDemo renders below instead of a
    // redirect. When present, load the real profile.
    const id = localStorage.getItem("studentId");
    if (!id) return;
    setStudentId(parseInt(id, 10));
  }, []);

  // Resume-page "add experience" nudge — scrolls straight to the section.
  useEffect(() => {
    if (!profile) return;
    const target = sessionStorage.getItem("profileScrollTo");
    if (!target) return;
    sessionStorage.removeItem("profileScrollTo");
    if (target === "experience-section") setShowAddExperience(true);
    setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  }, [profile]);

  // Course → Project bridge
  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("addProject") !== "1") return;
    const from = params.get("from") || "";
    const tech = (params.get("tech") || "").split(",").map(s => s.trim()).filter(Boolean);
    setNewProject({
      title: from ? `${from} project` : "",
      description: from ? `A project I built while learning ${from}.` : "",
      techStack: tech, githubUrl: "", liveUrl: "",
    });
    setShowAddProject(true);
    setTimeout(() => {
      document.getElementById("projects-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, "", cleanUrl);
  }, [profile]);

  const loadProfile = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const p = await fetchProfile(id);
      setProfile(p);
      setBasicForm({
        name: p.name,
        college: p.college === "Not set" ? "" : p.college,
        city: p.city === "Not set" ? "" : p.city,
        year: p.year,
        field: p.field === "Not set" ? "" : p.field,
        cgpa: p.cgpa || "",
        photoUrl: p.photoUrl || "",
      });
      setPhotoPreview(p.photoUrl || "");
      setLinksForm({ githubUrl: p.githubUrl || "", linkedinUrl: p.linkedinUrl || "", portfolioUrl: p.portfolioUrl || "", phone: p.phone || "" });
      setBioForm(p.bio || "");
      setPrefsForm({ workMode: p.workMode || "hybrid", preferredLocations: (p.preferredLocations || []).join(", "), expectedSalary: p.expectedSalary || "" });
    } catch {
      toast({ title: "Error loading profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (studentId) loadProfile(studentId);
  }, [studentId, loadProfile]);

  const save = async (data: Record<string, unknown>, section: string) => {
    if (!studentId) return;
    setSaving(true);
    try {
      const result = await patchProfile(studentId, data);
      await loadProfile(studentId);
      setEditSection(null);
      if (result.profileStrength === 100) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.4 }, colors: ["#4a55c7", "#8b93e0", "#eef0fb"] });
      }
      toast({ title: `${section} saved!` });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveBasic = () => save({
    name: basicForm.name.trim(),
    college: basicForm.college.trim(),
    city: basicForm.city.trim(),
    year: Number(basicForm.year),
    field: basicForm.field.trim(),
    cgpa: basicForm.cgpa.trim(),
    photoUrl: basicForm.photoUrl.trim(),
  }, "Profile");

  const toggleOpenToWork = async () => {
    if (!profile || !studentId) return;
    await patchProfile(studentId, { openToWork: !profile.openToWork });
    setProfile(prev => prev ? { ...prev, openToWork: !prev.openToWork } : prev);
    toast({ title: profile.openToWork ? "Hidden from recruiters" : "Now visible to recruiters!" });
  };

  const analyzeGitHub = async () => {
    if (!studentId || !linksForm.githubUrl) return;
    setAnalyzing("github");
    try {
      const r = await apiFetch(`/api/students/${studentId}/analyze-github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: linksForm.githubUrl }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
      await loadProfile(studentId);
      setEditSection(null);
      toast({ title: "GitHub analyzed! Profile updated." });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "GitHub analysis failed", variant: "destructive" });
    } finally {
      setAnalyzing(null);
    }
  };

  const prefillGithubProjects = async () => {
    if (!studentId) return;
    setPrefillingProjects(true);
    try {
      const r = await apiFetch(`/api/students/${studentId}/profile/github-projects`, { method: "POST" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
      const data = await r.json() as { added: number };
      await loadProfile(studentId);
      toast({ title: data.added > 0 ? `Added ${data.added} project${data.added === 1 ? "" : "s"} from GitHub` : "No new repos to add" });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Couldn't fetch GitHub projects", variant: "destructive" });
    } finally {
      setPrefillingProjects(false);
    }
  };

  const analyzeLinkedIn = async () => {
    if (!studentId || !linksForm.linkedinUrl) return;
    setAnalyzing("linkedin");
    try {
      const r = await apiFetch(`/api/students/${studentId}/analyze-linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedinUrl: linksForm.linkedinUrl,
          headline: linkedinForm.headline,
          summary: linkedinForm.summary,
          skills: linkedinForm.skills.split(",").map(s => s.trim()).filter(Boolean),
          experience: linkedinForm.experience,
        }),
      });
      if (!r.ok) throw new Error("Failed");
      await loadProfile(studentId);
      setShowLinkedinForm(false);
      setEditSection(null);
      toast({ title: "LinkedIn analyzed! AI feedback ready." });
    } catch {
      toast({ title: "LinkedIn analysis failed", variant: "destructive" });
    } finally {
      setAnalyzing(null);
    }
  };

  const addProject = async () => {
    if (!profile || !studentId || !newProject.title) return;
    const updated: Project[] = [...profile.projects, { ...newProject, id: `p_${Date.now()}` }];
    await save({ projects: updated }, "Project added");
    setNewProject({ title: "", description: "", techStack: [], githubUrl: "", liveUrl: "" });
    setTechInput("");
    setShowAddProject(false);
  };

  const removeProject = async (id: string) => {
    if (!profile || !studentId) return;
    await save({ projects: profile.projects.filter(p => p.id !== id) }, "Project removed");
  };

  const addCert = async () => {
    if (!profile || !studentId || !newCert.name) return;
    const updated: Certification[] = [...profile.certifications, { ...newCert, id: `c_${Date.now()}` }];
    await save({ certifications: updated }, "Certification added");
    setNewCert({ name: "", issuer: "", date: "", credentialUrl: "" });
    setShowAddCert(false);
  };

  const removeCert = async (id: string) => {
    if (!profile || !studentId) return;
    await save({ certifications: profile.certifications.filter(c => c.id !== id) }, "Certification removed");
  };

  const openAddEducation = () => {
    if (!profile) return;
    if (!showAddEducation && profile.education.length === 0) {
      // Seed from onboarding data already given — nobody should have to retype
      // their college/branch/CGPA a second time.
      setNewEducation({
        degree: "", institution: profile.college === "Not set" ? "" : profile.college,
        field: profile.field === "Not set" ? "" : profile.field, start: "", end: "",
        cgpa: profile.cgpa || "",
      });
    }
    setShowAddEducation(v => !v);
  };

  const addEducation = async () => {
    if (!profile || !studentId || !newEducation.degree || !newEducation.institution) return;
    const updated: Education[] = [...profile.education, { ...newEducation, id: `ed_${Date.now()}` }];
    await save({ education: updated }, "Education added");
    setNewEducation({ degree: "", institution: "", field: "", start: "", end: "", cgpa: "" });
    setShowAddEducation(false);
  };

  const removeEducation = async (id: string) => {
    if (!profile || !studentId) return;
    await save({ education: profile.education.filter(e => e.id !== id) }, "Education removed");
  };

  const addExperienceEntry = async () => {
    if (!profile || !studentId || !newExperience.company || !newExperience.role) return;
    const period = expEnd ? `${expStart} – ${expEnd}` : expStart;
    const updated: ExperienceEntry[] = [...profile.experience, { ...newExperience, period, id: `exp_${Date.now()}` }];
    await save({ experience: updated }, "Experience added");
    setNewExperience({ company: "", role: "", period: "", bullets: [] });
    setExpStart(""); setExpEnd(""); setExpBulletInput("");
    setShowAddExperience(false);
  };

  const removeExperienceEntry = async (id: string) => {
    if (!profile || !studentId) return;
    await save({ experience: profile.experience.filter(e => e.id !== id) }, "Experience removed");
  };

  // Anonymous visitor — read-only Priya profile. The first real action routes
  // through the NameGate, which creates a guest row and flips isDemo off.
  if (isDemo) {
    return (
      <ProfileDemo
        onStart={() =>
          requireStudent(() => {}, { title: "Start your profile" })
        }
      />
    );
  }

  if (loading || !profile) {
    return (
      <div className="p-4 space-y-4 bg-canvas min-h-screen">
        <div className="flex flex-col items-center py-8 gap-4">
          <Skeleton className="h-28 w-28 rounded-full" />
          <Skeleton className="h-6 w-40" />
        </div>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
      </div>
    );
  }

  const initials = profile.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

  const strengthTips = [
    !profile.githubUrl && "Add GitHub URL",
    !profile.linkedinUrl && "Add LinkedIn URL",
    !profile.bio && "Write a short bio",
    profile.projects.length === 0 && "Add at least 1 project",
    !profile.phone && "Add phone number",
    profile.certifications.length === 0 && "Add a certification",
    !profile.expectedSalary && "Set expected salary",
    !profile.githubStats && profile.githubUrl && "Analyze your GitHub",
  ].filter(Boolean) as string[];

  const GENERIC_SKILLS = new Set(["dsa","data structures","algorithms","problem solving","communication","teamwork","leadership","time management","critical thinking","git","linux","python","networking"]);
  const topSkills = Object.entries(profile.skills || {})
    .filter(([name]) => !GENERIC_SKILLS.has(name.toLowerCase().trim()))
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  const isEditingBasic = editSection === "basic";
  const isGuest = profile.name === "Guest" || profile.email?.startsWith("guest_");

  // Truly nothing on file — the "wall of zeros" case. Rather than a 0%
  // strength ring plus four separate empty-section boxes all saying the same
  // thing, show one checklist and let the ring appear once there's something
  // real for it to measure.
  const isProfileEmpty =
    Object.keys(profile.skills || {}).length === 0 &&
    profile.projects.length === 0 &&
    profile.experience.length === 0 &&
    profile.education.length === 0 &&
    !profile.githubUrl;

  // Mount stagger for list rows that would otherwise appear instantly.
  // Settled (no transform) when the user prefers reduced motion.
  const entranceProps = (i: number) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, delay: i * 0.06, ease: "easeOut" as const },
        };

  // lg:max-w-none, not 4xl: every other page sits at one of three widths — the
  // shell's full column (Opportunities, the other two-column card grid), 3xl
  // (Resume, DriveCheck, Test) or 2xl (Home, Prep, Pipeline, Notebook, AIChat).
  // 4xl was a singleton, so walking Opportunities -> Profile moved the
  // content's left edge 32px for no reason.
  return (
    <div className="pb-28 max-w-md lg:max-w-none mx-auto min-h-screen bg-canvas">

      {/* ── Canopy header ── */}
      <div className="relative bg-brand pt-8 pb-10 px-6">

        {/* Edit profile button top-right */}
        <button
          onClick={() => setEditSection(isEditingBasic ? null : "basic")}
          className="absolute top-6 right-6 flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 text-[11px] font-bold text-white"
        >
          {isEditingBasic ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
          {isEditingBasic ? "Cancel" : "Edit Profile"}
        </button>

        {/* Avatar */}
        <div className="relative inline-block">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={profile.name}
              className="w-20 h-20 rounded-full border-2 border-white/20 object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center text-[24px] font-extrabold text-white">
              {initials}
            </div>
          )}

          {/* Camera overlay */}
          <button
            onClick={() => setEditSection("basic")}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-paper border border-line flex items-center justify-center"
          >
            <Camera className="w-3.5 h-3.5 text-brand" />
          </button>
        </div>

        {/* Open to work badge */}
        <div className="mt-3">
          <button
            onClick={toggleOpenToWork}
            className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
          >
            {profile.openToWork && <span className="w-1.5 h-1.5 rounded-full bg-done" />}
            {profile.openToWork ? "OPEN" : "CLOSED"}
          </button>
        </div>

        <h1 className="text-display text-[30px] lg:text-[36px] font-extrabold text-white leading-[1.06] tracking-tight mt-3">{profile.name}</h1>
        {profile.college !== "Not set" && <p className="text-[12px] text-white/70 mt-1">{profile.college}</p>}
        {profile.field !== "Not set" && (
          <p className="text-[12px] text-white/70 mt-0.5">
            {profile.field} · Year {profile.year}{profile.city && profile.city !== "Not set" ? ` · ${profile.city}` : ""}
          </p>
        )}
        {profile.cgpa && <p className="text-[12px] text-white/70 mt-0.5">CGPA {profile.cgpa}</p>}

        {profile.openToWork && (
          <p className="mt-2 text-[12px] font-semibold text-white/90">Open to Opportunities</p>
        )}
      </div>

      {/* ── Sheet ── */}
      {/* -mt-6/pt-6 like every other canopy sheet (Home, Prep, Pipeline,
          Onboarding, DriveCheck). Profile was the only one at -mt-4/pt-4, so
          its sheet bit 8px less into the canopy and sat on a different
          vertical rhythm than the rest of the app.

          `relative` matters: the canopy above is positioned (it anchors the
          Edit Profile button), so it painted over this sheet's negative
          margin and the rounded top never showed — Profile was the one canopy
          in the app that ended in a hard square-cornered edge. */}
      <div className="relative bg-canvas -mt-6 rounded-t-3xl pt-6 space-y-4">

        {/* Guest (NameGate-created, unclaimed) — work lives on this device only. */}
        {isGuestAccount && (
          <div className="mx-4">
            <GuestSavedChip />
          </div>
        )}

        {/* Guest banner */}
        {isGuest && (
          <div className="bg-paper rounded-2xl shadow-soft mx-4 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-ink">Exploring as Guest</p>
              <p className="text-[12px] text-ink-muted">Sign in to save your real profile</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setLocation("/sign-up")}
              className="shrink-0 bg-brand text-white text-[13px] font-bold px-4 py-2.5 rounded-full"
            >
              Sign In →
            </motion.button>
          </div>
        )}

      <div className="px-4 space-y-4">

        {/* ── Edit Basic Info ── */}
        <AnimatePresence>
          {isEditingBasic && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="bg-paper rounded-2xl shadow-soft overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-line">
                  <span className="text-[14px] font-bold text-ink flex items-center gap-2">
                    <User className="w-4 h-4 text-ink" /> Edit Profile
                  </span>
                  <button onClick={() => setEditSection(null)}>
                    <X className="w-4 h-4 text-ink-muted" />
                  </button>
                </div>
                <div className="p-5 space-y-3 bg-paper">

                  {/* Photo URL */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1">
                      <Camera className="w-3 h-3" /> Profile Photo URL
                    </p>
                    <div className="flex gap-2 items-center">
                      {photoPreview && (
                        <img
                          src={photoPreview}
                          alt="preview"
                          className="w-10 h-10 rounded-full object-cover border border-line flex-shrink-0"
                          onError={() => setPhotoPreview("")}
                        />
                      )}
                      <Input
                        placeholder="Paste photo URL (e.g. from Google Photos, LinkedIn)"
                        value={basicForm.photoUrl}
                        onChange={e => {
                          setBasicForm(f => ({ ...f, photoUrl: e.target.value }));
                          setPhotoPreview(e.target.value);
                        }}
                        className="text-sm flex-1"
                      />
                    </div>
                    <p className="text-[10px] text-ink-muted pl-1">Upload a photo to Google Drive / Imgur and paste the direct link here</p>
                  </div>

                  {/* Name */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Full Name</p>
                    <Input
                      placeholder="Your full name"
                      value={basicForm.name}
                      onChange={e => setBasicForm(f => ({ ...f, name: e.target.value }))}
                      className="text-sm font-bold"
                    />
                  </div>

                  {/* College + City */}
                  <CollegePicker
                    studentId={studentId}
                    onPicked={(name) => setBasicForm(f => ({ ...f, college: name }))}
                  />
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> College
                    </p>
                    <Input
                      placeholder="e.g. RVCE Bangalore, IIT Delhi"
                      value={basicForm.college}
                      onChange={e => setBasicForm(f => ({ ...f, college: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> City
                    </p>
                    <Input
                      placeholder="e.g. Bangalore"
                      value={basicForm.city}
                      onChange={e => setBasicForm(f => ({ ...f, city: e.target.value }))}
                      className="text-sm"
                    />
                  </div>

                  {/* Year + Field */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Year</p>
                      <div className="flex gap-1 flex-wrap">
                        {YEAR_OPTIONS.map(y => (
                          <button
                            key={y}
                            onClick={() => setBasicForm(f => ({ ...f, year: y }))}
                            className={`w-9 h-9 rounded-xl text-[14px] font-bold transition-colors ${basicForm.year === y ? "bg-brand text-white" : "border border-line text-ink-muted"}`}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">CGPA</p>
                      <Input
                        placeholder="e.g. 8.5"
                        value={basicForm.cgpa}
                        onChange={e => setBasicForm(f => ({ ...f, cgpa: e.target.value }))}
                        className="text-sm"
                        inputMode="decimal"
                      />
                    </div>
                  </div>

                  {/* Field of study */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Field of Study
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {FIELD_OPTIONS.map(f => (
                        <button
                          key={f}
                          onClick={() => setBasicForm(prev => ({ ...prev, field: f }))}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${basicForm.field === f ? "bg-brand text-white" : "border border-line text-ink-muted"}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <Input
                      placeholder="Or type your branch..."
                      value={FIELD_OPTIONS.includes(basicForm.field) ? "" : basicForm.field}
                      onChange={e => setBasicForm(prev => ({ ...prev, field: e.target.value }))}
                      className="text-sm mt-1"
                    />
                  </div>

                  <Button
                    onClick={saveBasic}
                    disabled={saving || !basicForm.name.trim() || !basicForm.college.trim()}
                    className="w-full bg-brand text-white font-bold rounded-full h-11"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Toko's Notebook link ── */}
        <button
          onClick={() => setLocation("/notebook")}
          className="w-full bg-brand-soft rounded-2xl p-4 flex items-center justify-between text-left"
        >
          <div>
            <h3 className="text-[14px] font-bold text-brand">Toko's Notebook</h3>
            <p className="text-[11px] text-ink/70 mt-0.5">Everything Toko has noticed about your journey</p>
          </div>
          <span className="text-brand text-[13px] font-bold">→</span>
        </button>

        {isProfileEmpty && (
          <div className="mx-4 bg-brand rounded-2xl shadow-soft p-5 space-y-3">
            <h3 className="text-display text-[15px] font-extrabold text-white">Start here</h3>
            <p className="text-[12px] text-white/70 -mt-2">
              Give Toko something real to work from — everything else on this page builds on this.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { setEditSection("links"); document.getElementById("links-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="w-full flex items-center gap-2 bg-white/15 rounded-xl px-3.5 py-2.5 text-left"
              >
                <span className="w-5 h-5 rounded-full bg-white/20 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                <span className="text-[13px] font-semibold text-white">Add your GitHub URL</span>
              </button>
              <button
                onClick={() => document.getElementById("import-resume-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="w-full flex items-center gap-2 bg-white/15 rounded-xl px-3.5 py-2.5 text-left"
              >
                <span className="w-5 h-5 rounded-full bg-white/20 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                <span className="text-[13px] font-semibold text-white">Or upload your resume</span>
              </button>
              <button
                onClick={() => setLocation("/resume")}
                className="w-full flex items-center gap-2 bg-white rounded-xl px-3.5 py-2.5 text-left"
              >
                <span className="w-5 h-5 rounded-full bg-brand-soft text-brand text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                <span className="text-[13px] font-bold text-brand">Generate your first resume</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Two-column section grid (desktop only; stacks on mobile) ──
            No lg:items-start: with it, a short card left a hole the height of
            its taller row-mate (Profile Strength is 130px against Links' 300px,
            so ~170px of canvas read as a missing card). Letting cards stretch
            to the row height gives clean rows instead. */}
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">

        {/* ── Profile Strength ── (hidden pre-data — the Start-here checklist
             above already says this; a 0% ring right under it is the same
             message twice) */}
        {!isProfileEmpty && (
        <div className="bg-paper rounded-2xl shadow-soft">
          <div className="p-5">
            <div className="flex items-center gap-4">
              <StrengthRing value={profile.profileStrength} />
              <div className="flex-1">
                <h3 className="text-[14px] font-bold text-ink">Profile Strength</h3>
                {strengthTips.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {strengthTips.slice(0, 2).map((tip, i) => (
                      <li key={i} className="text-[11px] text-ink-muted flex items-center gap-1">
                        <span className="text-ink-muted">+</span> {tip}
                      </li>
                    ))}
                    {strengthTips.length > 2 && (
                      <li className="text-[11px] text-ink-muted">+{strengthTips.length - 2} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-[12px] text-ink font-semibold mt-1">Profile complete!</p>
                )}
              </div>
            </div>

            {/* Only show scores when they have real data */}
            {(profile.githubUrl || profile.overallScore > 0) && (
              <div className={`grid gap-3 mt-4 pt-4 border-t border-line ${profile.githubUrl && profile.overallScore > 0 ? "grid-cols-2" : ""}`}>
                {profile.githubUrl && (
                  <div className="bg-brand-soft rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-brand">{profile.commitmentScore}</p>
                    <p className="text-[10px] font-bold text-ink/70 uppercase tracking-wider">Commitment</p>
                  </div>
                )}
                {profile.overallScore > 0 && (
                  <div className="bg-brand-soft rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-brand">{Math.round(profile.overallScore)}</p>
                    <p className="text-[10px] font-bold text-ink/70 uppercase tracking-wider">AI Score</p>
                  </div>
                )}
              </div>
            )}

            {(profile.githubUrl || profile.overallScore > 0) && (
              <p className="text-[10px] text-center text-ink-muted mt-2">Recruiters see these scores on your profile</p>
            )}
          </div>
        </div>
        )}

        {/* ── Links Section ── */}
        <div id="links-section" className="bg-paper rounded-2xl shadow-soft scroll-mt-4">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-ink flex items-center gap-2"><Zap className="w-4 h-4 text-ink" /> Links</h3>
              <button onClick={() => setEditSection(editSection === "links" ? null : "links")} aria-label="Edit links" className="-m-3.5 p-3.5 rounded-full text-ink hover-elevate active-elevate-2">
                {editSection === "links" ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </div>

            <AnimatePresence>
              {editSection === "links" ? (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder="GitHub URL" value={linksForm.githubUrl} onChange={e => setLinksForm(f => ({ ...f, githubUrl: e.target.value }))} className="text-sm" />
                      <Button size="sm" variant="outline" onClick={analyzeGitHub} disabled={!linksForm.githubUrl || analyzing === "github"} className="whitespace-nowrap text-xs rounded-full border border-line text-brand">
                        {analyzing === "github" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Analyze"}
                      </Button>
                    </div>
                    {linksForm.githubUrl && !showLinkedinForm && (
                      <p className="text-[10px] text-ink-muted pl-1">Tap Analyze to auto-fetch your GitHub stats</p>
                    )}
                    {profile.githubUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={prefillGithubProjects}
                        disabled={prefillingProjects}
                        className="w-full text-xs rounded-full border border-line text-brand"
                      >
                        {prefillingProjects ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Fetching repos...</> : "Prefill projects from GitHub"}
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder="LinkedIn URL" value={linksForm.linkedinUrl} onChange={e => setLinksForm(f => ({ ...f, linkedinUrl: e.target.value }))} className="text-sm" />
                      <Button size="sm" variant="outline" onClick={() => setShowLinkedinForm(!showLinkedinForm)} disabled={!linksForm.linkedinUrl} className="whitespace-nowrap text-xs rounded-full border border-line text-brand">
                        {showLinkedinForm ? "Hide" : "Analyze"}
                      </Button>
                    </div>
                    {showLinkedinForm && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 pl-1">
                        <Input placeholder="LinkedIn Headline" value={linkedinForm.headline} onChange={e => setLinkedinForm(f => ({ ...f, headline: e.target.value }))} className="text-sm" />
                        <Input placeholder="Top skills (comma separated)" value={linkedinForm.skills} onChange={e => setLinkedinForm(f => ({ ...f, skills: e.target.value }))} className="text-sm" />
                        <Textarea placeholder="Brief experience summary..." value={linkedinForm.experience} onChange={e => setLinkedinForm(f => ({ ...f, experience: e.target.value }))} className="text-sm h-16" />
                        <Button
                          size="sm"
                          onClick={analyzeLinkedIn}
                          disabled={!linksForm.linkedinUrl || analyzing === "linkedin"}
                          className="w-full bg-brand text-white font-bold rounded-full"
                        >
                          {analyzing === "linkedin" ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Analyzing...</> : "Get AI Feedback on LinkedIn"}
                        </Button>
                      </motion.div>
                    )}
                  </div>

                  <Input placeholder="Portfolio / Website URL" value={linksForm.portfolioUrl} onChange={e => setLinksForm(f => ({ ...f, portfolioUrl: e.target.value }))} className="text-sm" />
                  <Input placeholder="Phone Number" value={linksForm.phone} onChange={e => setLinksForm(f => ({ ...f, phone: e.target.value }))} className="text-sm" />
                  <Button onClick={() => save({ ...linksForm }, "Links")} disabled={saving} className="w-full bg-brand text-white font-bold rounded-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Save Links</>}
                  </Button>
                </motion.div>
              ) : (
                <div>
                  {[
                    { icon: Github, label: "GitHub", value: profile.githubUrl },
                    { icon: Linkedin, label: "LinkedIn", value: profile.linkedinUrl },
                    { icon: Globe, label: "Portfolio", value: profile.portfolioUrl },
                    { icon: Phone, label: "Phone", value: profile.phone },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 py-3 border-t border-line first:border-t-0">
                      <div className="w-8 h-8 rounded-full border border-line bg-paper flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-ink" />
                      </div>
                      {value ? (
                        <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
                          className="text-[14px] font-semibold text-ink truncate flex-1">
                          {value.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink className="w-3 h-3 inline-block ml-0.5" />
                        </a>
                      ) : (
                        <span className="text-[14px] text-ink-muted">Add {label}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* GitHub Stats */}
            {profile.githubStats && editSection !== "links" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 pt-4 border-t border-line">
                <div className="flex items-center gap-2 mb-3">
                  <Github className="w-4 h-4 text-ink" />
                  <span className="text-[14px] font-bold text-ink">@{profile.githubStats.username}</span>
                  <Badge className="text-[10px] bg-paper border-line text-ink-muted font-bold uppercase tracking-wider">Verified</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-brand-soft rounded-xl p-2 text-center">
                    <p className="font-extrabold text-brand">{profile.githubStats.publicRepos}</p>
                    <p className="text-[10px] text-ink/70">Repos</p>
                  </div>
                  <div className="bg-brand-soft rounded-xl p-2 text-center">
                    <p className="font-extrabold text-brand">{profile.githubStats.followers}</p>
                    <p className="text-[10px] text-ink/70">Followers</p>
                  </div>
                </div>
                {profile.githubStats.topLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.githubStats.topLanguages.map(lang => (
                      <Badge key={lang} className="text-[11px] bg-paper border-line text-ink-muted font-bold">{lang}</Badge>
                    ))}
                  </div>
                )}
                {profile.githubStats.topRepos.length > 0 && (
                  <div className="mt-3">
                    {profile.githubStats.topRepos.map(repo => (
                      <div key={repo.name} className="flex items-center justify-between text-[12px] py-2 border-t border-line first:border-t-0">
                        <span className="font-semibold text-ink truncate">{repo.name}</span>
                        <span className="flex items-center gap-1 text-ink-muted ml-2 shrink-0"><Star className="w-3 h-3" />{repo.stars}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* LinkedIn AI feedback */}
            {profile.linkedinData && editSection !== "links" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 pt-4 border-t border-line">
                <div className="flex items-center gap-2 mb-2">
                  <Linkedin className="w-4 h-4 text-ink" />
                  <span className="text-[14px] font-bold text-ink">LinkedIn AI Feedback</span>
                  <Badge className="text-[10px] bg-paper border-line text-ink-muted font-bold uppercase tracking-wider">
                    {profile.linkedinData.profileTier}
                  </Badge>
                </div>
                {profile.linkedinData.recruitersWillNotice && (
                  <p className="text-[12px] text-ink-muted italic mb-2">"{profile.linkedinData.recruitersWillNotice}"</p>
                )}
                {profile.linkedinData.improvements?.slice(0, 2).map((tip: string, i: number) => (
                  <p key={i} className="text-[11px] text-ink-muted flex items-start gap-1"><span>→</span>{tip}</p>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* ── About / Bio ── */}
        <div className="bg-paper rounded-2xl shadow-soft">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-ink">About</h3>
              <button onClick={() => setEditSection(editSection === "bio" ? null : "bio")} aria-label="Edit about" className="-m-3.5 p-3.5 rounded-full text-ink hover-elevate active-elevate-2">
                {editSection === "bio" ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </div>
            {editSection === "bio" ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <Textarea
                  value={bioForm}
                  onChange={e => setBioForm(e.target.value)}
                  placeholder="Write 2-3 lines about yourself. What makes you stand out? What are you passionate about building?"
                  className="h-28 text-sm"
                />
                <Button onClick={() => save({ bio: bioForm }, "About")} disabled={saving} className="w-full bg-brand text-white font-bold rounded-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Save</>}
                </Button>
              </motion.div>
            ) : profile.bio ? (
              <p className="text-[14px] text-ink leading-relaxed">{profile.bio}</p>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEditSection("bio")} className="w-full py-3 bg-brand text-white rounded-full text-[13px] font-bold transition-colors">
                + Write a short bio (helps recruiters remember you)
              </motion.button>
            )}
          </div>
        </div>

        {/* ── Education ── */}
        <div id="education-section" className="bg-paper rounded-2xl shadow-soft scroll-mt-4">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-ink flex items-center gap-2"><BookOpen className="w-4 h-4 text-ink" /> Education</h3>
              <button onClick={openAddEducation} className="flex items-center gap-1 text-[12px] font-bold text-ink">
                {showAddEducation ? <X className="w-4 h-4" /> : <><Plus className="w-4 h-4" /> Add</>}
              </button>
            </div>

            <AnimatePresence>
              {showAddEducation && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 space-y-2 overflow-hidden">
                  <Input placeholder="Degree (e.g. B.Tech Computer Science) *" value={newEducation.degree} onChange={e => setNewEducation(ed => ({ ...ed, degree: e.target.value }))} className="text-sm" />
                  <Input placeholder="Institution *" value={newEducation.institution} onChange={e => setNewEducation(ed => ({ ...ed, institution: e.target.value }))} className="text-sm" />
                  <Input placeholder="Field / branch (optional)" value={newEducation.field || ""} onChange={e => setNewEducation(ed => ({ ...ed, field: e.target.value }))} className="text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">Start</p>
                      <MonthYearPicker value={newEducation.start || ""} onChange={v => setNewEducation(ed => ({ ...ed, start: v }))} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">End</p>
                      <MonthYearPicker value={newEducation.end || ""} onChange={v => setNewEducation(ed => ({ ...ed, end: v }))} allowPresent />
                    </div>
                  </div>
                  <Input placeholder="CGPA (optional)" value={newEducation.cgpa || ""} onChange={e => setNewEducation(ed => ({ ...ed, cgpa: e.target.value }))} className="text-sm" />
                  <Button onClick={addEducation} disabled={saving || !newEducation.degree || !newEducation.institution} className="w-full bg-brand text-white font-bold rounded-full text-sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Education"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {profile.education.length === 0 && !showAddEducation && (
              <div className="text-center">
                <p className="text-[14px] text-ink">No education added yet</p>
                <p className="text-[12px] text-ink-muted mt-0.5">Your degree, college and CGPA for the resume</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={openAddEducation} className="w-full mt-3 bg-brand text-white text-[13px] font-bold rounded-full px-4 py-3">
                  Add your education
                </motion.button>
              </div>
            )}

            <div>
              {profile.education.map((ed, i) => (
                <motion.div key={ed.id} {...entranceProps(i)} className="py-4 border-t border-line first:border-t-0 relative group">
                  <button onClick={() => removeEducation(ed.id)} className="absolute top-4 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <h4 className="text-[14px] font-semibold text-ink pr-6">{ed.degree}</h4>
                  <p className="text-[12px] text-ink-muted mt-0.5">
                    {ed.institution}{ed.field ? ` · ${ed.field}` : ""}
                  </p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {[ed.start, ed.end].filter(Boolean).join(" – ")}{ed.cgpa ? ` · CGPA ${ed.cgpa}` : ""}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Experience ── */}
        <div id="experience-section" className="bg-paper rounded-2xl shadow-soft scroll-mt-4">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-ink flex items-center gap-2"><Building2 className="w-4 h-4 text-ink" /> Experience</h3>
              <button onClick={() => setShowAddExperience(!showAddExperience)} className="flex items-center gap-1 text-[12px] font-bold text-ink">
                {showAddExperience ? <X className="w-4 h-4" /> : <><Plus className="w-4 h-4" /> Add</>}
              </button>
            </div>

            <AnimatePresence>
              {showAddExperience && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 space-y-2 overflow-hidden">
                  <Input placeholder="Company *" value={newExperience.company} onChange={e => setNewExperience(x => ({ ...x, company: e.target.value }))} className="text-sm" />
                  <Input placeholder="Role *" value={newExperience.role} onChange={e => setNewExperience(x => ({ ...x, role: e.target.value }))} className="text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">Start</p>
                      <MonthYearPicker value={expStart} onChange={setExpStart} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">End</p>
                      <MonthYearPicker value={expEnd} onChange={setExpEnd} allowPresent />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a bullet (press Enter)"
                      value={expBulletInput}
                      onChange={e => setExpBulletInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && expBulletInput.trim() && newExperience.bullets.length < 6) {
                          setNewExperience(x => ({ ...x, bullets: [...x.bullets, expBulletInput.trim()] }));
                          setExpBulletInput("");
                        }
                      }}
                      className="text-sm"
                    />
                  </div>
                  {newExperience.bullets.length > 0 && (
                    <ul className="space-y-1">
                      {newExperience.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-ink-muted">
                          <span className="flex-1">{b}</span>
                          <button onClick={() => setNewExperience(x => ({ ...x, bullets: x.bullets.filter((_, j) => j !== i) }))} className="text-danger shrink-0">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button onClick={addExperienceEntry} disabled={saving || !newExperience.company || !newExperience.role} className="w-full bg-brand text-white font-bold rounded-full text-sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Experience"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {profile.experience.length === 0 && !showAddExperience && (
              <div className="text-center">
                <p className="text-[14px] text-ink">No experience yet</p>
                <p className="text-[12px] text-ink-muted mt-0.5">Internships, part-time work, freelance — anything real</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAddExperience(true)} className="w-full mt-3 bg-brand text-white text-[13px] font-bold rounded-full px-4 py-3">
                  Add your first experience
                </motion.button>
              </div>
            )}

            <div>
              {profile.experience.map((exp, i) => (
                <motion.div key={exp.id} {...entranceProps(i)} className="py-4 border-t border-line first:border-t-0 relative group">
                  <button onClick={() => removeExperienceEntry(exp.id)} className="absolute top-4 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <h4 className="text-[14px] font-semibold text-ink pr-6">{exp.role}</h4>
                  <p className="text-[12px] text-ink-muted mt-0.5">{exp.company}{exp.period ? ` · ${exp.period}` : ""}</p>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {exp.bullets.map((b, i) => (
                        <li key={i} className="text-[12px] text-ink-muted leading-relaxed">– {b}</li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Projects ── */}
        <div id="projects-section" className="bg-paper rounded-2xl shadow-soft scroll-mt-4">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-ink flex items-center gap-2"><Code2 className="w-4 h-4 text-ink" /> Projects</h3>
              <button onClick={() => setShowAddProject(!showAddProject)} className="flex items-center gap-1 text-[12px] font-bold text-ink">
                {showAddProject ? <X className="w-4 h-4" /> : <><Plus className="w-4 h-4" /> Add</>}
              </button>
            </div>

            <AnimatePresence>
              {showAddProject && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 space-y-2 overflow-hidden">
                  <Input placeholder="Project Title *" value={newProject.title} onChange={e => setNewProject(p => ({ ...p, title: e.target.value }))} className="text-sm" />
                  <Textarea placeholder="What does it do? Problem it solves?" value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} className="text-sm h-16" />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tech (press Enter)"
                      value={techInput}
                      onChange={e => setTechInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && techInput.trim()) {
                          setNewProject(p => ({ ...p, techStack: [...p.techStack, techInput.trim()] }));
                          setTechInput("");
                        }
                      }}
                      className="text-sm"
                    />
                  </div>
                  {newProject.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {newProject.techStack.map((t, i) => (
                        <Badge key={i} className="text-xs bg-paper border-line text-ink-muted cursor-pointer" onClick={() => setNewProject(p => ({ ...p, techStack: p.techStack.filter((_, j) => j !== i) }))}>{t} ×</Badge>
                      ))}
                    </div>
                  )}
                  <Input placeholder="GitHub URL (optional)" value={newProject.githubUrl || ""} onChange={e => setNewProject(p => ({ ...p, githubUrl: e.target.value }))} className="text-sm" />
                  <Input placeholder="Live URL (optional)" value={newProject.liveUrl || ""} onChange={e => setNewProject(p => ({ ...p, liveUrl: e.target.value }))} className="text-sm" />
                  <Button onClick={addProject} disabled={saving || !newProject.title} className="w-full bg-brand text-white font-bold rounded-full text-sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Project"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {profile.projects.length === 0 && !showAddProject && (
              <div className="text-center">
                <p className="text-[14px] text-ink">No projects yet</p>
                <p className="text-[12px] text-ink-muted mt-0.5">Recruiters love seeing real work</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAddProject(true)} className="w-full mt-3 bg-brand text-white text-[13px] font-bold rounded-full px-4 py-3">
                  Add your first project
                </motion.button>
              </div>
            )}

            <div>
              {profile.projects.map((proj, i) => (
                <motion.div key={proj.id} {...entranceProps(i)} className="py-4 border-t border-line first:border-t-0 relative group">
                  <button onClick={() => removeProject(proj.id)} className="absolute top-4 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <h4 className="text-[14px] font-semibold text-ink pr-6">{proj.title}</h4>
                  {proj.description && <p className="text-[12px] text-ink-muted mt-1 leading-relaxed">{proj.description}</p>}
                  {proj.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {proj.techStack.map(t => <Badge key={t} className="text-[10px] bg-paper text-ink-muted border-line">{t}</Badge>)}
                    </div>
                  )}
                  <div className="flex gap-3 mt-2">
                    {proj.githubUrl && <a href={proj.githubUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-ink flex items-center gap-1"><Github className="w-3 h-3" /> Code</a>}
                    {proj.liveUrl && <a href={proj.liveUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-ink flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Live</a>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Certifications ── */}
        <div className="bg-paper rounded-2xl shadow-soft">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-ink flex items-center gap-2"><Award className="w-4 h-4 text-ink" /> Certifications</h3>
              <button onClick={() => setShowAddCert(!showAddCert)} className="flex items-center gap-1 text-[12px] font-bold text-ink">
                {showAddCert ? <X className="w-4 h-4" /> : <><Plus className="w-4 h-4" /> Add</>}
              </button>
            </div>

            <AnimatePresence>
              {showAddCert && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 space-y-2 overflow-hidden">
                  <Input placeholder="Certificate Name *" value={newCert.name} onChange={e => setNewCert(c => ({ ...c, name: e.target.value }))} className="text-sm" />
                  <Input placeholder="Issuer (e.g. Google, AWS, Coursera)" value={newCert.issuer} onChange={e => setNewCert(c => ({ ...c, issuer: e.target.value }))} className="text-sm" />
                  <Input placeholder="Date (e.g. March 2024)" value={newCert.date || ""} onChange={e => setNewCert(c => ({ ...c, date: e.target.value }))} className="text-sm" />
                  <Input placeholder="Credential URL (optional)" value={newCert.credentialUrl || ""} onChange={e => setNewCert(c => ({ ...c, credentialUrl: e.target.value }))} className="text-sm" />
                  <Button onClick={addCert} disabled={saving || !newCert.name} className="w-full bg-brand text-white font-bold rounded-full text-sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Certification"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {profile.certifications.length === 0 && !showAddCert && (
              <div className="text-center">
                <p className="text-[14px] text-ink">No certifications yet</p>
                <p className="text-[12px] text-ink-muted mt-0.5">AWS, Google, Coursera, etc.</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAddCert(true)} className="w-full mt-3 bg-brand text-white text-[13px] font-bold rounded-full px-4 py-3">
                  Add a certification
                </motion.button>
              </div>
            )}

            <div>
              {profile.certifications.map((cert, i) => (
                <motion.div key={cert.id} {...entranceProps(i)} className="flex items-center gap-3 py-4 border-t border-line first:border-t-0 relative group">
                  <div className="w-8 h-8 rounded-full border border-line bg-paper flex items-center justify-center shrink-0">
                    <Award className="w-4 h-4 text-ink" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-ink truncate">{cert.name}</p>
                    <p className="text-[12px] text-ink-muted">{cert.issuer}{cert.date ? ` · ${cert.date}` : ""}</p>
                  </div>
                  <button onClick={() => removeCert(cert.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Verified Certificates ── */}
        <CertificatesCard studentId={studentId!} />

        {/* ── Job Preferences ── */}
        <div className="bg-paper rounded-2xl shadow-soft">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-ink flex items-center gap-2"><Briefcase className="w-4 h-4 text-ink" /> Job Preferences</h3>
              <button onClick={() => setEditSection(editSection === "prefs" ? null : "prefs")} aria-label="Edit job preferences" className="-m-3.5 p-3.5 rounded-full text-ink hover-elevate active-elevate-2">
                {editSection === "prefs" ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </div>

            {editSection === "prefs" ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div>
                  <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2">Work Mode</p>
                  <div className="grid grid-cols-3 gap-2">
                    {WORK_MODES.map(mode => (
                      <button
                        key={mode}
                        onClick={() => setPrefsForm(f => ({ ...f, workMode: mode }))}
                        className={`py-2 rounded-xl text-[13px] font-bold transition-colors ${prefsForm.workMode === mode ? "bg-brand text-white" : "border border-line text-ink-muted"}`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">Preferred Cities</p>
                  <Input placeholder="Bangalore, Mumbai, Remote..." value={prefsForm.preferredLocations} onChange={e => setPrefsForm(f => ({ ...f, preferredLocations: e.target.value }))} className="text-sm" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">Expected Salary (LPA)</p>
                  <Input placeholder="e.g. 8-12 LPA" value={prefsForm.expectedSalary} onChange={e => setPrefsForm(f => ({ ...f, expectedSalary: e.target.value }))} className="text-sm" />
                </div>
                <Button
                  onClick={() => save({
                    workMode: prefsForm.workMode,
                    preferredLocations: prefsForm.preferredLocations.split(",").map(s => s.trim()).filter(Boolean),
                    expectedSalary: prefsForm.expectedSalary,
                  }, "Preferences")}
                  disabled={saving}
                  className="w-full bg-brand text-white font-bold rounded-full"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Save Preferences</>}
                </Button>
              </motion.div>
            ) : (
              <div>
                <div className="flex items-center gap-3 py-3 border-t border-line first:border-t-0">
                  <div className="w-8 h-8 rounded-full border border-line bg-paper flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-ink" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Work Mode</p>
                    <p className="text-[14px] font-semibold text-ink">{(profile.workMode || "hybrid").charAt(0).toUpperCase() + (profile.workMode || "hybrid").slice(1)}</p>
                  </div>
                </div>
                {profile.preferredLocations.length > 0 && (
                  <div className="flex items-center gap-3 py-3 border-t border-line">
                    <div className="w-8 h-8 rounded-full border border-line bg-paper flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-ink" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Preferred Cities</p>
                      <p className="text-[14px] font-semibold text-ink">{profile.preferredLocations.join(", ")}</p>
                    </div>
                  </div>
                )}
                {profile.expectedSalary && (
                  <div className="flex items-center gap-3 py-3 border-t border-line">
                    <div className="w-8 h-8 rounded-full border border-line bg-paper flex items-center justify-center shrink-0">
                      <DollarSign className="w-4 h-4 text-ink" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Expected Salary</p>
                      <p className="text-[14px] font-semibold text-ink">{profile.expectedSalary}</p>
                    </div>
                  </div>
                )}
                {!profile.preferredLocations.length && !profile.expectedSalary && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEditSection("prefs")} className="w-full mt-3 bg-brand text-white rounded-full py-3 text-[13px] font-bold transition-colors">
                    + Add job preferences
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Skills (only when populated by AI/quiz) ── */}
        {topSkills.length > 0 && (
          <div className="bg-paper rounded-2xl shadow-soft">
            <div className="p-5">
              <h3 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-ink" /> Skills</h3>
              <div className="space-y-3">
                {topSkills.map(([name, score]) => {
                  const s = score as number;
                  return (
                    <div key={name} className="space-y-1.5">
                      <div className="flex justify-between text-[14px]">
                        <span className="font-semibold text-ink">{name}</span>
                        <span className="font-extrabold text-ink">{Math.round(s)}%</span>
                      </div>
                      <div className="h-2 w-full bg-line rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${s}%` }} transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full bg-brand" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Import from resume ── */}
        <div id="import-resume-section" className="bg-paper rounded-2xl shadow-soft p-5 scroll-mt-4">
          <h3 className="text-[14px] font-bold text-ink mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4 text-ink" /> Import from resume
          </h3>
          <p className="text-[12px] text-ink-muted mb-3">
            Upload an existing resume and we'll fill in projects, skills and certifications for you.
          </p>
          <ResumeImport
            studentId={studentId}
            onImported={() => { if (studentId) loadProfile(studentId); }}
          />
        </div>

        {/* ── My Resumes ── */}
        <MyResumesCard studentId={studentId!} onNavigate={() => setLocation("/resume")} />

        {/* ── Your activity ── */}
        <ActivityCard studentId={studentId!} />

        {/* ── Add to home screen (iOS only) ── */}
        <InstallCard />

        </div>
        {/* ── End two-column section grid ── */}

        {/* ── Resume ── */}
        <div className="pb-4">
          <Button
            variant="outline"
            className="w-full h-14 rounded-full font-bold border border-line text-brand text-sm bg-paper"
            onClick={() => setLocation("/resume")}
          >
            <FileText className="w-4 h-4 mr-2" /> Resume
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
