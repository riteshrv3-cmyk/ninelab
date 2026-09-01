import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, FileText, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { upgradeContent, renderPlainText } from "@workspace/resume-core";
import { apiFetch } from "@/lib/api/authFetch";
import { isGuestSession } from "@/lib/isGuest";
import { useStudentId } from "@/hooks/useStudentId";
import { useNameGate } from "@/components/NameGate";
import { PageHeader } from "@/components/PageHeader";
import ResumeDemo from "@/components/demo/ResumeDemo";
import { GenerateSheet } from "@/components/resume/GenerateSheet";
import { EditResumeSheet } from "@/components/resume/EditResumeSheet";
import { ReviewFlow } from "@/components/resume/ReviewFlow";
import { ResumeCard } from "@/components/resume/ResumeCard";
import { TargetRecommendations } from "@/components/resume/TargetRecommendations";
import { consumeDownloadIntent, downloadResumeDocx, downloadResumePDF, gateOnSignup } from "@/components/resume/download";
import type { SavedResume } from "@/components/resume/resumeTypes";

// The resume page shell: list + sheets. The heavy lifting lives in
// components/resume/ — GenerateSheet (one-shot AI draft), ReviewFlow
// (section-by-section score raising), EditResumeSheet (full manual edit).
export default function Resume() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isSignedIn, isLoaded } = useUser();
  // Explore-first: anonymous visitors (no studentId) get a rich sample resume
  // via <ResumeDemo/> instead of a redirect.
  const { studentId, isDemo } = useStudentId();
  const { requireStudent } = useNameGate();
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateFor, setGenerateFor] = useState<
    { role: string; tags: string[]; name: string; parentResumeId?: number } | null
  >(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingResume, setEditingResume] = useState<SavedResume | null>(null);
  const [reviewingResume, setReviewingResume] = useState<SavedResume | null>(null);

  // Explore-mode "start my own" flow: stash the intent, route through the
  // NameGate (creates the guest row), and the studentId effect below opens
  // the generation sheet so the tapped action continues across the transition.
  const handleStartOwn = useCallback(() => {
    sessionStorage.setItem("kt:autoOpenGenerate", "1");
    requireStudent(() => {}, { title: "Let's build your resume" });
  }, [requireStudent]);

  useEffect(() => {
    if (!studentId) return;
    if (sessionStorage.getItem("kt:autoOpenGenerate") === "1") {
      sessionStorage.removeItem("kt:autoOpenGenerate");
      setGenerateFor({ role: "", tags: [], name: "" });
    }
  }, [studentId]);

  // Breadcrumb for Home's Continue chip — every generation-sheet open counts as resume activity. Real students only.
  useEffect(() => { if (generateFor !== null && studentId) { try { localStorage.setItem("kt:lastActivity", JSON.stringify({ label: "your resume", href: "/resume" })); } catch { /* quota — non-fatal */ } } }, [generateFor, studentId]);

  // Seeded by Opportunities/Pipeline via sessionStorage.resumeContext — consumed
  // once so a refresh or back-nav to /resume never reopens the sheet.
  useEffect(() => {
    const raw = sessionStorage.getItem("resumeContext");
    if (!raw) return;
    sessionStorage.removeItem("resumeContext");
    try {
      const ctx = JSON.parse(raw) as { role?: string; tags?: string[]; name?: string };
      setGenerateFor({
        role: ctx.role ?? "",
        tags: Array.isArray(ctx.tags) ? ctx.tags : [],
        name: ctx.name ?? "",
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

  // Powers the "add experience" nudge below.
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

  const handleResumeUpdated = useCallback((updated: SavedResume) => {
    setResumes(prev => prev.map(r => r.id === updated.id ? updated : r));
  }, []);

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

  // Resumes a download/share intent stashed before a guest was sent to sign up.
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

  // Anonymous visitor: read-only sample resume from fixtures.
  if (isDemo) return <ResumeDemo onStart={handleStartOwn} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <PageHeader
          title="My Resumes"
          subtitle="AI-generated from your real profile · scored against 34 checks"
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
        <PageHeader
          title="My Resumes"
          subtitle="AI-generated from your real profile · scored against 34 checks"
          right={
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                onClick={() => setGenerateFor({ role: "", tags: [], name: "" })}
                className="rounded-full bg-white/15 text-white hover:bg-white/25 font-bold px-4 h-10"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New
              </Button>
            </motion.div>
          }
        />

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

        {studentId && (
          <TargetRecommendations
            studentId={studentId}
            onGenerate={seed => setGenerateFor({ role: seed.role, tags: seed.tags, name: seed.name })}
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
              Turn your GitHub and profile into a scored, recruiter-ready resume in minutes.
            </p>
            <Button
              onClick={() => setGenerateFor({ role: "", tags: [], name: "" })}
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
                    onReview={() => setReviewingResume(resume)}
                    onRetarget={() => setGenerateFor({
                      role: "",
                      tags: [],
                      name: resume.name ? `${resume.name} (retargeted)` : "",
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
              : "Complete your Profile with real projects and certifications — the AI will use them to generate a much stronger resume."}
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
            onReview={setReviewingResume}
            initialRole={generateFor.role}
            initialTags={generateFor.tags}
            initialName={generateFor.name}
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

      <AnimatePresence>
        {reviewingResume && studentId && (
          <ReviewFlow
            resume={reviewingResume}
            studentId={studentId}
            onClose={() => setReviewingResume(null)}
            onSaved={handleResumeUpdated}
          />
        )}
      </AnimatePresence>
    </>
  );
}
