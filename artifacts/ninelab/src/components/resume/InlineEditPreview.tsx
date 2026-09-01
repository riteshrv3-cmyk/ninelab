import { useRef, useState } from "react";
import { Loader2, Check, X, Sparkles } from "lucide-react";
import type { ResumeDocument } from "@workspace/resume-core";
import { PAGE } from "@/lib/resume-pdf/geometry";
import { apiFetch } from "@/lib/api/authFetch";
import { ResumeHtml, type ResumeClickTarget } from "./html/ResumeHtml";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveEdit {
  target: ResumeClickTarget;
  currentText: string;
  draft: string;
  /** Popover position, px relative to the container. */
  top: number;
}

type BulletAction = "shorter" | "add_number" | "jd_wording" | "different_verb";

const BULLET_ACTIONS: { key: BulletAction; label: string }[] = [
  { key: "shorter", label: "Shorter" },
  { key: "add_number", label: "+ Number" },
  { key: "jd_wording", label: "JD wording" },
  { key: "different_verb", label: "New verb" },
];

interface InlineEditPreviewProps {
  resume: ResumeDocument;
  templateId: string;
  studentId: number;
  resumeId: number;
  className?: string;
  onUpdated: (updated: unknown) => void;
}

const PAGE_WIDTH_PX = (PAGE.width * 4) / 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(resume: ResumeDocument, target: ResumeClickTarget): string {
  if (target.field === "summary") return resume.summary;
  if (target.field === "bulletText" && target.entryIndex !== undefined && target.bulletIndex !== undefined) {
    if (target.section === "experience") return resume.experience[target.entryIndex]?.bullets[target.bulletIndex]?.text ?? "";
    if (target.section === "projects") return resume.projects[target.entryIndex]?.bullets[target.bulletIndex]?.text ?? "";
  }
  if (target.field === "achievementText" && target.entryIndex !== undefined) {
    return resume.achievements[target.entryIndex]?.text ?? "";
  }
  return "";
}

function applyEdit(resume: ResumeDocument, target: ResumeClickTarget, newText: string): Record<string, unknown> {
  if (target.field === "summary") return { summary: newText };
  if (target.field === "bulletText" && target.entryIndex !== undefined && target.bulletIndex !== undefined) {
    if (target.section === "experience") {
      return {
        experience: resume.experience.map((e, ei) =>
          ei === target.entryIndex
            ? { ...e, bullets: e.bullets.map((b, bi) => (bi === target.bulletIndex ? { ...b, text: newText } : b)) }
            : e,
        ),
      };
    }
    if (target.section === "projects") {
      return {
        projects: resume.projects.map((p, pi) =>
          pi === target.entryIndex
            ? { ...p, bullets: p.bullets.map((b, bi) => (bi === target.bulletIndex ? { ...b, text: newText } : b)) }
            : p,
        ),
      };
    }
  }
  if (target.field === "achievementText" && target.entryIndex !== undefined) {
    return {
      achievements: resume.achievements.map((a, ai) => (ai === target.entryIndex ? { ...a, text: newText } : a)),
    };
  }
  return {};
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The tap-to-edit preview: real DOM elements from ResumeHtml carry click
 * handlers, so a tap on any bullet, the summary, or an achievement opens an
 * inline editor with the AI bullet actions — no PDF hit-region math.
 */
export function InlineEditPreview({
  resume,
  templateId,
  studentId,
  resumeId,
  className,
  onUpdated,
}: InlineEditPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState<BulletAction | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // Container/inner sizing — same scaled-page approach as ResumePreview.
  const roRef = useRef<ResizeObserver | null>(null);
  const attachRefs = (container: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;
    roRef.current?.disconnect();
    if (!container) return;
    const update = () => {
      const inner = innerRef.current;
      if (!inner) return;
      const w = container.clientWidth;
      const s = w > 0 ? w / PAGE_WIDTH_PX : 0;
      setScale(s);
      setScaledHeight(inner.offsetHeight * s);
    };
    const ro = new ResizeObserver(update);
    ro.observe(container);
    if (innerRef.current) ro.observe(innerRef.current);
    roRef.current = ro;
    update();
  };

  const handleElementClick = (target: ResumeClickTarget, el: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setRewriteError(null);
    setActiveEdit({
      target,
      currentText: extractText(resume, target),
      draft: extractText(resume, target),
      top: elRect.bottom - containerRect.top + 4,
    });
  };

  async function handleSave() {
    if (!activeEdit) return;
    const { target, draft, currentText } = activeEdit;
    if (draft.trim() === currentText.trim()) {
      setActiveEdit(null);
      return;
    }
    setSaving(true);
    try {
      const patchContent = applyEdit(resume, target, draft.trim());
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resumeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: patchContent, snapshot: true }),
      });
      if (r.ok) {
        const updated = await r.json();
        onUpdated(updated);
      }
    } finally {
      setSaving(false);
      setActiveEdit(null);
    }
  }

  async function handleRewrite(action: BulletAction) {
    if (!activeEdit) return;
    const { target } = activeEdit;
    setRewriting(action);
    setRewriteError(null);
    try {
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resumeId}/bullet-rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: target.section, entryIndex: target.entryIndex, bulletIndex: target.bulletIndex, action }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setRewriteError(data?.error || "Rewrite failed");
        return;
      }
      setActiveEdit(prev => (prev ? { ...prev, draft: data.text } : null));
    } catch {
      setRewriteError("Rewrite failed");
    } finally {
      setRewriting(null);
    }
  }

  return (
    <div
      ref={attachRefs}
      className={`relative bg-white rounded-lg shadow-soft ${activeEdit ? "" : "overflow-hidden"} ${className ?? ""}`}
      style={scaledHeight !== null ? { minHeight: scaledHeight } : { aspectRatio: "210 / 297" }}
    >
      <div
        ref={innerRef}
        style={{ width: PAGE_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: "top left", visibility: scale > 0 ? "visible" : "hidden" }}
      >
        <ResumeHtml doc={resume} templateId={templateId} onElementClick={activeEdit ? undefined : handleElementClick} />
      </div>

      {/* Inline popover editor, anchored under the clicked element */}
      {activeEdit && (
        <div
          className="absolute z-20 bg-paper rounded-xl shadow-xl border border-brand/30 p-2 flex flex-col gap-1.5 left-2 right-2"
          style={{ top: Math.max(4, activeEdit.top) }}
        >
          <textarea
            autoFocus
            className="w-full text-[11px] text-ink rounded-lg border border-line p-2 resize-none focus:outline-none focus:border-brand leading-relaxed"
            rows={3}
            value={activeEdit.draft}
            onChange={e => setActiveEdit(prev => (prev ? { ...prev, draft: e.target.value } : null))}
            onKeyDown={e => {
              if (e.key === "Escape") setActiveEdit(null);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSave();
              }
            }}
          />
          {activeEdit.target.field === "bulletText" && (
            <div className="flex flex-wrap gap-1">
              {BULLET_ACTIONS.map(a => (
                <button
                  key={a.key}
                  onClick={() => void handleRewrite(a.key)}
                  disabled={rewriting !== null}
                  className="h-5 px-1.5 rounded-full text-[9px] font-bold text-brand border border-brand/30 hover:bg-brand/10 disabled:opacity-50 inline-flex items-center gap-0.5"
                >
                  {rewriting === a.key ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {rewriteError && <p className="text-[9px] text-red-500">{rewriteError}</p>}
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={() => setActiveEdit(null)}
              className="h-6 px-2 rounded-full text-[10px] font-bold text-ink-muted border border-line hover:bg-canvas"
            >
              <X className="w-3 h-3 inline mr-0.5" />Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-6 px-2 rounded-full text-[10px] font-bold bg-brand text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 inline animate-spin mr-0.5" /> : <Check className="w-3 h-3 inline mr-0.5" />}
              Save
            </button>
          </div>
          <p className="text-[9px] text-ink-muted text-right">Cmd+Enter to save · Esc to cancel</p>
        </div>
      )}
    </div>
  );
}
