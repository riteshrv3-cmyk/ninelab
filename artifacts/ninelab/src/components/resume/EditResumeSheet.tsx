import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Eye, History, Loader2, MinusCircle, Pencil, PlusCircle, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildAtsReport, buildQualityReport, shortenUrl, upgradeContent, type Bullet, type ContactLink, type EducationEntry, type ExperienceEntry } from "@workspace/resume-core";
import { apiFetch } from "@/lib/api/authFetch";
import { TEMPLATE_REGISTRY, resolveTemplateConfig } from "@/lib/resume-pdf";
import { AtsFixList } from "./AtsFixList";
import { ResumePreview } from "./ResumePreview";
import { toCommaString, type SavedResume } from "./resumeTypes";

const TEMPLATE_LIST = Object.values(TEMPLATE_REGISTRY);

// State carries the FULL v2 entry objects — fields this sheet doesn't expose
// (employmentType, location, coursework, skill evidence) ride along untouched,
// so saving an edit never silently deletes them.
interface EditableSkillSection {
  category: string;
  itemsString: string; // comma-joined for the input
  evidence: string[];
}

interface EditableProject {
  title: string;
  tech: string; // comma-joined for the input
  link: string;
  bullets: Bullet[];
}

// The full edit surface: contact, headline, education, experience — everything
// on the page is editable. State is initialized from the v2-normalized doc
// (upgradeContent), so v1-era rows edit safely, and Save persists v2 shapes.
export function EditResumeSheet({
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

  const baseDoc = useMemo(() => upgradeContent(resume.content), [resume.content]);

  // Contact + header
  const [contactName, setContactName] = useState(baseDoc.contact.name);
  const [contactEmail, setContactEmail] = useState(baseDoc.contact.email);
  const [contactPhone, setContactPhone] = useState(baseDoc.contact.phone ?? "");
  const [contactCity, setContactCity] = useState(baseDoc.contact.city ?? "");
  const linkOf = (kind: ContactLink["kind"]) => baseDoc.contact.links.find(l => l.kind === kind)?.url ?? "";
  const [githubUrl, setGithubUrl] = useState(linkOf("github"));
  const [linkedinUrl, setLinkedinUrl] = useState(linkOf("linkedin"));
  const [portfolioUrl, setPortfolioUrl] = useState(linkOf("portfolio"));
  const [headline, setHeadline] = useState(baseDoc.headline);

  // Body sections
  const [summary, setSummary] = useState(baseDoc.summary);
  const [skillSections, setSkillSections] = useState<EditableSkillSection[]>(
    baseDoc.skillSections.map(s => ({ category: s.category, itemsString: toCommaString(s.items), evidence: s.evidence })),
  );
  const [experience, setExperience] = useState<ExperienceEntry[]>(baseDoc.experience);
  const [projects, setProjects] = useState<EditableProject[]>(
    baseDoc.projects.map(p => ({ title: p.title, tech: p.tech.join(", "), link: p.link ?? "", bullets: p.bullets })),
  );
  const [education, setEducation] = useState<EducationEntry[]>(baseDoc.education);
  const [achievements, setAchievements] = useState<Bullet[]>(baseDoc.achievements.map(a => ({ text: a.text, evidence: a.evidence })));

  const buildLinks = (): ContactLink[] => {
    const links: ContactLink[] = [];
    const push = (url: string, kind: ContactLink["kind"]) => {
      const trimmed = url.trim();
      if (trimmed) links.push({ label: shortenUrl(trimmed), url: trimmed, kind });
    };
    push(githubUrl, "github");
    push(linkedinUrl, "linkedin");
    push(portfolioUrl, "portfolio");
    // Link kinds this sheet doesn't expose (email/phone) are preserved as-is.
    const preserved = baseDoc.contact.links.filter(l => l.kind !== "github" && l.kind !== "linkedin" && l.kind !== "portfolio");
    return [...links, ...preserved];
  };

  /** The v2 content this sheet would save right now — feeds the live preview,
   * the live scores, and the PATCH body identically. Entries are passed as
   * their full objects so unexposed fields survive the round-trip. */
  const buildContent = () => ({
    contact: {
      name: contactName,
      email: contactEmail,
      phone: contactPhone.trim() || null,
      city: contactCity.trim() || null,
      links: buildLinks(),
    },
    headline,
    summary,
    order: baseDoc.order,
    skillSections: skillSections.map(s => ({ category: s.category, items: s.itemsString, evidence: s.evidence })),
    experience,
    projects: projects.map(p => ({ title: p.title, tech: p.tech, link: p.link.trim() || null, bullets: p.bullets })),
    education: education.map(ed => ({
      ...ed,
      field: ed.field?.trim() ? ed.field : undefined,
      cgpa: ed.cgpa?.trim() ? ed.cgpa : null,
    })),
    achievements,
  });

  const editedState = { templateId, contactName, contactEmail, contactPhone, contactCity, githubUrl, linkedinUrl, portfolioUrl, headline, summary, skillSections, experience, projects, education, achievements };
  const initialSnapshot = useRef(JSON.stringify(editedState)).current;
  const isDirty = JSON.stringify(editedState) !== initialSnapshot;
  const requestClose = () => {
    if (isDirty && !window.confirm("Discard unsaved changes to this resume?")) return;
    onClose();
  };

  const liveDoc = useMemo(
    () => upgradeContent({ ...resume.content, schemaVersion: 2, ...buildContent() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resume.content, contactName, contactEmail, contactPhone, contactCity, githubUrl, linkedinUrl, portfolioUrl, headline, summary, skillSections, experience, projects, education, achievements],
  );

  const quality = useMemo(
    () => buildQualityReport(liveDoc, { density: resolveTemplateConfig(templateId).density }),
    [liveDoc, templateId],
  );
  const atsReport = useMemo(
    () => buildAtsReport({ doc: liveDoc, jdText: resume.jdText ?? undefined }),
    [liveDoc, resume.jdText],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: buildContent(),
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

  const setBullet = (list: "experience" | "projects", ei: number, bi: number, text: string) => {
    const setter = list === "experience" ? setExperience : setProjects;
    (setter as React.Dispatch<React.SetStateAction<{ bullets: Bullet[] }[]>>)(prev =>
      prev.map((e, i) => i === ei
        ? { ...e, bullets: e.bullets.map((b, j) => j === bi ? { ...b, text } : b) }
        : e));
  };
  const addBullet = (list: "experience" | "projects", ei: number) => {
    const setter = list === "experience" ? setExperience : setProjects;
    (setter as React.Dispatch<React.SetStateAction<{ bullets: Bullet[] }[]>>)(prev =>
      prev.map((e, i) => i === ei ? { ...e, bullets: [...e.bullets, { text: "", evidence: [] }] } : e));
  };
  const removeBullet = (list: "experience" | "projects", ei: number, bi: number) => {
    const setter = list === "experience" ? setExperience : setProjects;
    (setter as React.Dispatch<React.SetStateAction<{ bullets: Bullet[] }[]>>)(prev =>
      prev.map((e, i) => i === ei ? { ...e, bullets: e.bullets.filter((_, j) => j !== bi) } : e));
  };

  const inputCls = "rounded-lg border border-line focus:border-brand text-ink text-sm h-8";
  const labelCls = "text-[11px] font-bold text-ink-muted uppercase tracking-wider";

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
      <div className="bg-canvas border border-line rounded-xl p-3 space-y-1">
        <p className="type-micro font-bold text-ink">Quality score {quality.total}/100</p>
        {atsReport && (
          <p className="type-micro text-ink/70">
            ATS match {atsReport.scorePct}% · {atsReport.mustCoverage.matched}/{atsReport.mustCoverage.total} must-have keywords
          </p>
        )}
      </div>
      {atsReport && resume.atsReport && (
        <AtsFixList
          studentId={studentId}
          resumeId={resume.id}
          atsReport={resume.atsReport}
          coverage={resume.evidenceMap?.coverage}
          content={{ skillSections: skillSections.map(s => ({ category: s.category, items: s.itemsString })) }}
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
            <span className="text-[11px] font-bold text-ink-muted bg-canvas border border-line rounded-full px-2 py-0.5">{quality.total}/100</span>
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

          {/* Contact + headline */}
          <div className="space-y-2">
            <label className={labelCls}>Contact</label>
            <div className="grid grid-cols-2 gap-2">
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" className={inputCls} />
              <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Email" className={inputCls} />
              <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Phone (+91…)" className={inputCls} />
              <Input value={contactCity} onChange={e => setContactCity(e.target.value)} placeholder="City" className={inputCls} />
            </div>
            <Input value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="GitHub URL" className={inputCls} />
            <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="LinkedIn URL" className={inputCls} />
            <Input value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="Portfolio URL (optional)" className={inputCls} />
            <Input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Headline, e.g. Backend Developer | Node.js, PostgreSQL" className={inputCls} />
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <label className={labelCls}>Professional Summary</label>
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
              <label className={labelCls}>Skill Sections</label>
              <button
                onClick={() => setSkillSections(prev => [...prev, { category: "", itemsString: "", evidence: [] }])}
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
                    onChange={e => setSkillSections(prev => prev.map((x, idx) => idx === i ? { ...x, category: e.target.value } : x))}
                    placeholder="Category (e.g. Languages)"
                    className={inputCls}
                  />
                  <Input
                    value={s.itemsString}
                    onChange={e => setSkillSections(prev => prev.map((x, idx) => idx === i ? { ...x, itemsString: e.target.value } : x))}
                    placeholder="Items (comma-separated)"
                    className={inputCls}
                  />
                </div>
                <button onClick={() => setSkillSections(prev => prev.filter((_, idx) => idx !== i))} className="mt-1 text-danger shrink-0">
                  <MinusCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Experience */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Experience / Internships</label>
              <button
                onClick={() => setExperience(prev => [...prev, { company: "", role: "", start: "", end: "", bullets: [{ text: "", evidence: [] }] }])}
                className="flex items-center gap-1 text-[11px] font-bold text-brand"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {experience.length === 0 && (
              <p className="text-[12px] text-ink-muted">No experience yet — even an internship or campus role counts.</p>
            )}
            {experience.map((e, ei) => (
              <div key={ei} className="bg-paper rounded-xl p-3 space-y-2 border border-line">
                <div className="flex gap-2">
                  <Input value={e.role} onChange={ev => setExperience(prev => prev.map((x, i) => i === ei ? { ...x, role: ev.target.value } : x))} placeholder="Role" className={`${inputCls} flex-1`} />
                  <Input value={e.company} onChange={ev => setExperience(prev => prev.map((x, i) => i === ei ? { ...x, company: ev.target.value } : x))} placeholder="Company" className={`${inputCls} flex-1`} />
                  <button onClick={() => setExperience(prev => prev.filter((_, i) => i !== ei))} className="text-danger shrink-0 mt-1.5">
                    <MinusCircle className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input value={e.start} onChange={ev => setExperience(prev => prev.map((x, i) => i === ei ? { ...x, start: ev.target.value } : x))} placeholder="Start (Jun 2025)" className={`${inputCls} flex-1`} />
                  <Input value={e.end} onChange={ev => setExperience(prev => prev.map((x, i) => i === ei ? { ...x, end: ev.target.value } : x))} placeholder="End (Aug 2025 / Present)" className={`${inputCls} flex-1`} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Bullets</p>
                  {e.bullets.map((b, bi) => (
                    <div key={bi} className="flex gap-1.5 items-center">
                      <Textarea
                        value={b.text}
                        onChange={ev => setBullet("experience", ei, bi, ev.target.value)}
                        rows={2}
                        className="flex-1 rounded-lg border border-line focus:border-brand text-ink text-xs resize-none"
                      />
                      <button onClick={() => removeBullet("experience", ei, bi)} className="text-danger shrink-0">
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addBullet("experience", ei)} className="flex items-center gap-1 text-[11px] font-bold text-brand mt-1">
                    <PlusCircle className="w-3 h-3" /> Add bullet
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Projects */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Projects</label>
              <button
                onClick={() => setProjects(prev => [...prev, { title: "", tech: "", link: "", bullets: [{ text: "", evidence: [] }] }])}
                className="flex items-center gap-1 text-[11px] font-bold text-brand"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {projects.map((p, pi) => (
              <div key={pi} className="bg-paper rounded-xl p-3 space-y-2 border border-line">
                <div className="flex gap-2">
                  <Input value={p.title} onChange={e => setProjects(prev => prev.map((x, i) => i === pi ? { ...x, title: e.target.value } : x))} placeholder="Project title" className={`${inputCls} flex-1`} />
                  <Input value={p.tech} onChange={e => setProjects(prev => prev.map((x, i) => i === pi ? { ...x, tech: e.target.value } : x))} placeholder="Tech stack" className={`${inputCls} flex-1`} />
                  <button onClick={() => setProjects(prev => prev.filter((_, i) => i !== pi))} className="text-danger shrink-0 mt-1.5">
                    <MinusCircle className="w-4 h-4" />
                  </button>
                </div>
                <Input value={p.link} onChange={e => setProjects(prev => prev.map((x, i) => i === pi ? { ...x, link: e.target.value } : x))} placeholder="Link (GitHub / live URL)" className={inputCls} />
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Bullets</p>
                  {p.bullets.map((b, bi) => (
                    <div key={bi} className="flex gap-1.5 items-center">
                      <Textarea
                        value={b.text}
                        onChange={e => setBullet("projects", pi, bi, e.target.value)}
                        rows={2}
                        className="flex-1 rounded-lg border border-line focus:border-brand text-ink text-xs resize-none"
                      />
                      <button onClick={() => removeBullet("projects", pi, bi)} className="text-danger shrink-0">
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addBullet("projects", pi)} className="flex items-center gap-1 text-[11px] font-bold text-brand mt-1">
                    <PlusCircle className="w-3 h-3" /> Add bullet
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Education */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Education</label>
              <button
                onClick={() => setEducation(prev => [...prev, { degree: "", institution: "", start: "", end: "", cgpa: null }])}
                className="flex items-center gap-1 text-[11px] font-bold text-brand"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {education.map((ed, i) => (
              <div key={i} className="bg-paper rounded-xl p-3 space-y-2 border border-line">
                <div className="flex gap-2">
                  <Input value={ed.degree} onChange={e => setEducation(prev => prev.map((x, idx) => idx === i ? { ...x, degree: e.target.value } : x))} placeholder="Degree (B.E. Computer Engg)" className={`${inputCls} flex-1`} />
                  <button onClick={() => setEducation(prev => prev.filter((_, idx) => idx !== i))} className="text-danger shrink-0 mt-1.5">
                    <MinusCircle className="w-4 h-4" />
                  </button>
                </div>
                <Input value={ed.institution} onChange={e => setEducation(prev => prev.map((x, idx) => idx === i ? { ...x, institution: e.target.value } : x))} placeholder="College / university" className={inputCls} />
                <div className="grid grid-cols-3 gap-2">
                  <Input value={ed.start} onChange={e => setEducation(prev => prev.map((x, idx) => idx === i ? { ...x, start: e.target.value } : x))} placeholder="Start (2022)" className={inputCls} />
                  <Input value={ed.end} onChange={e => setEducation(prev => prev.map((x, idx) => idx === i ? { ...x, end: e.target.value } : x))} placeholder="End (2026)" className={inputCls} />
                  <Input value={ed.cgpa ?? ""} onChange={e => setEducation(prev => prev.map((x, idx) => idx === i ? { ...x, cgpa: e.target.value } : x))} placeholder="CGPA" className={inputCls} />
                </div>
              </div>
            ))}
          </div>

          {/* Achievements */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Achievements</label>
              <button
                onClick={() => setAchievements(prev => [...prev, { text: "", evidence: [] }])}
                className="flex items-center gap-1 text-[11px] font-bold text-brand"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {achievements.map((a, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input
                  value={a.text}
                  onChange={e => setAchievements(prev => prev.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
                  placeholder="Achievement"
                  className={`flex-1 ${inputCls}`}
                />
                <button onClick={() => setAchievements(prev => prev.filter((_, idx) => idx !== i))} className="text-danger shrink-0">
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
