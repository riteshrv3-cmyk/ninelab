import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { upgradeContent } from "@workspace/resume-core";
import { apiFetch } from "@/lib/api/authFetch";
import { TEMPLATE_REGISTRY } from "@/lib/resume-pdf";
import { ResumeImport } from "@/components/ResumeImport";
import { ResumePreview } from "./ResumePreview";
import { isContentEmpty, type SavedResume } from "./resumeTypes";

const TEMPLATE_LIST = Object.values(TEMPLATE_REGISTRY);

// Generation is profile-driven: no company field, no JD paste. The AI writes
// from the student's verified profile toward the seeded role/tags (from a
// recommendation card or retarget), and the ReviewFlow does the polishing.
export function GenerateSheet({
  onClose,
  onGenerated,
  onReview,
  studentId,
  initialRole = "",
  initialTags = [],
  initialName = "",
  initialParentResumeId,
}: {
  onClose: () => void;
  onGenerated: (r: SavedResume) => void;
  onReview: (r: SavedResume) => void;
  studentId: number;
  initialRole?: string;
  initialTags?: string[];
  initialName?: string;
  initialParentResumeId?: number;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [templateId, setTemplateId] = useState("ats");
  const [resumeName, setResumeName] = useState(initialName);
  const [generating, setGenerating] = useState(false);
  const [generatedResume, setGeneratedResume] = useState<SavedResume | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Profile-emptiness gate: check on mount; show a quick-capture step for
  // users whose ledger has nothing yet (no skills, projects, or experience).
  type ProfileStep = "loading" | "capture" | "generate";
  const [profileStep, setProfileStep] = useState<ProfileStep>("loading");
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
  // because github-projects reads the githubUrl analyze-github just persisted.
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
    { key: "jd", name: "Understanding your target role" },
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
          templateId, resumeName,
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

  /** Persists a template switch made on the ready screen, then hands off. */
  const finalizeTemplate = async (): Promise<SavedResume> => {
    if (!generatedResume) throw new Error("no resume");
    if (templateId === generatedResume.templateId) return generatedResume;
    try {
      const r = await apiFetch(`/api/students/${studentId}/resumes/${generatedResume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (r.ok) return await r.json() as SavedResume;
    } catch {
      // Non-fatal — keep the original template rather than blocking here.
    }
    return generatedResume;
  };

  const handleReview = async () => {
    if (!generatedResume) return;
    setFinishing(true);
    const finalResume = await finalizeTemplate();
    setFinishing(false);
    onGenerated(finalResume);
    onClose();
    onReview(finalResume);
  };

  const handleDone = async () => {
    if (!generatedResume) return;
    setFinishing(true);
    const finalResume = await finalizeTemplate();
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
                Draft Ready
              </h2>
              <button onClick={handleDone} className="w-8 h-8 rounded-full border border-line flex items-center justify-center">
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

            <ResumePreview resume={previewDoc} templateId={templateId} className="max-w-[280px] mx-auto" />

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
              <p className="text-[10px] text-ink-muted text-center">Every bullet is backed by your profile — nothing invented</p>
            )}

            {generatedResume?.evidenceMap?.thesis && (
              <div className="rounded-xl bg-canvas border border-line p-3 space-y-1.5 text-[12px]">
                <p className="font-semibold text-ink">What the AI focused on</p>
                <p className="text-ink-muted leading-snug">{generatedResume.evidenceMap.thesis}</p>
              </div>
            )}

            <Button
              onClick={handleReview}
              disabled={finishing || isContentEmpty(generatedResume.content)}
              className="w-full h-12 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-[15px]"
            >
              {finishing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Opening…
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Review &amp; raise your score
                </>
              )}
            </Button>
            <button
              onClick={handleDone}
              disabled={finishing}
              className="w-full text-center text-[12px] text-ink-muted hover:text-ink underline underline-offset-2"
            >
              Skip review — save as is
            </button>
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

            <p className="text-[12px] text-ink-muted -mt-2">
              Written entirely from your profile — every bullet traces to something real.
              {initialRole ? <> Aimed at: <span className="font-semibold text-ink">{initialRole}</span></> : null}
            </p>

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
              <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                Resume Name
                <span className="text-ink-muted normal-case font-medium ml-1">(optional)</span>
              </label>
              <Input
                value={resumeName}
                onChange={e => setResumeName(e.target.value)}
                placeholder="e.g. Backend roles, Campus drive 2026"
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
                    <p className="font-semibold text-ink mb-1">Matched from your profile:</p>
                    <p className="text-ink/70">
                      {findings.have} strong, {findings.partial} partial
                      {findings.missing.length > 0 && (
                        <span> — gaps: <span className="font-medium text-ink">{findings.missing.join(", ")}</span></span>
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
