import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Check, X, Sparkles } from "lucide-react";
import type { ResumeDocument, SectionKey } from "@workspace/resume-core";
import { renderResumePdf, type Page } from "@/lib/resume-pdf";
import { PAGE } from "@/lib/resume-pdf/geometry";
import { apiFetch } from "@/lib/api/authFetch";
import { loadPdfjs } from "@/lib/loadPdfjs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HitRegion {
  chunkId: string;
  section: SectionKey;
  entryIndex?: number;
  bulletIndex?: number;
  field: "summary" | "bulletText" | "achievementText";
  currentText: string;
  // PDF-space coordinates (points, relative to content area top)
  y: number;
  height: number;
}

interface ActiveEdit {
  region: HitRegion;
  draft: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(resume: ResumeDocument, region: HitRegion): string {
  if (region.field === "summary") return resume.summary;
  if (region.field === "bulletText") {
    if (region.section === "experience" && region.entryIndex !== undefined && region.bulletIndex !== undefined) {
      return resume.experience[region.entryIndex]?.bullets[region.bulletIndex]?.text ?? "";
    }
    if (region.section === "projects" && region.entryIndex !== undefined && region.bulletIndex !== undefined) {
      return resume.projects[region.entryIndex]?.bullets[region.bulletIndex]?.text ?? "";
    }
  }
  if (region.field === "achievementText" && region.entryIndex !== undefined) {
    return resume.achievements[region.entryIndex]?.text ?? "";
  }
  return "";
}

function applyEdit(resume: ResumeDocument, region: HitRegion, newText: string): Record<string, unknown> {
  if (region.field === "summary") {
    return { summary: newText };
  }
  if (region.field === "bulletText" && region.entryIndex !== undefined && region.bulletIndex !== undefined) {
    if (region.section === "experience") {
      const updated = resume.experience.map((e, ei) =>
        ei === region.entryIndex
          ? { ...e, bullets: e.bullets.map((b, bi) => bi === region.bulletIndex ? { ...b, text: newText } : b) }
          : e
      );
      return { experience: updated };
    }
    if (region.section === "projects") {
      const updated = resume.projects.map((p, pi) =>
        pi === region.entryIndex
          ? { ...p, bullets: p.bullets.map((b, bi) => bi === region.bulletIndex ? { ...b, text: newText } : b) }
          : p
      );
      return { projects: updated };
    }
  }
  if (region.field === "achievementText" && region.entryIndex !== undefined) {
    const updated = resume.achievements.map((a, ai) =>
      ai === region.entryIndex ? { ...a, text: newText } : a
    );
    return { achievements: updated };
  }
  return {};
}

// ─── Component ────────────────────────────────────────────────────────────────

// Shared polyfilled pdf.js loader — see lib/loadPdfjs.ts.

export function InlineEditPreview({
  resume,
  templateId,
  studentId,
  resumeId,
  className,
  onUpdated,
}: InlineEditPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(true);
  const [pages, setPages] = useState<Page[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState<BulletAction | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const tokenRef = useRef(0);
  const renderTaskRef = useRef<import("pdfjs-dist").RenderTask | null>(null);

  // Track container width for CSS↔PDF coordinate mapping
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render loop (same as ResumePreview but also saves pages)
  useEffect(() => {
    const token = ++tokenRef.current;
    setRendering(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { doc, pages: renderedPages } = await renderResumePdf(resume, templateId, {});
          if (tokenRef.current !== token) return;

          setPages(renderedPages);

          const pdfjsLib = await loadPdfjs();
          const buf = doc.output("arraybuffer");
          if (tokenRef.current !== token) return;

          const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
          const page = await pdfDoc.getPage(1);
          if (tokenRef.current !== token) return;

          const canvas = canvasRef.current;
          if (!canvas) return;

          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: 1.7 * dpr });
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          renderTaskRef.current?.cancel();
          const task = page.render({ canvas, canvasContext: ctx, viewport });
          renderTaskRef.current = task;
          await task.promise;
          if (renderTaskRef.current === task) renderTaskRef.current = null;
          if (tokenRef.current !== token) return;
        } catch (e) {
          const isCancelled = e instanceof Error && e.name === "RenderingCancelledException";
          if (isCancelled) return;
        } finally {
          if (tokenRef.current === token) setRendering(false);
        }
      })();
    }, 250);
    return () => {
      clearTimeout(timer);
      renderTaskRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(resume), templateId]);

  // Build hit regions from the first page only
  const hitRegions = useCallback((): HitRegion[] => {
    if (!pages.length || !containerWidth) return [];
    const firstPage = pages[0];
    const regions: HitRegion[] = [];
    for (const { chunk, y } of firstPage.chunks) {
      if (!chunk.source) continue;
      const { section, entryIndex, bulletIndex, field } = chunk.source;
      const text = (() => {
        if (field === "summary") return resume.summary;
        if (field === "bulletText") {
          if (section === "experience" && entryIndex !== undefined && bulletIndex !== undefined)
            return resume.experience[entryIndex]?.bullets[bulletIndex]?.text ?? "";
          if (section === "projects" && entryIndex !== undefined && bulletIndex !== undefined)
            return resume.projects[entryIndex]?.bullets[bulletIndex]?.text ?? "";
        }
        if (field === "achievementText" && entryIndex !== undefined)
          return resume.achievements[entryIndex]?.text ?? "";
        return "";
      })();
      regions.push({ chunkId: chunk.id, section, entryIndex, bulletIndex, field, currentText: text, y, height: chunk.height });
    }
    return regions;
  }, [pages, containerWidth, resume]);

  // CSS coordinate conversion: PDF points → CSS pixels
  const scale = containerWidth / PAGE.width;

  async function handleSave() {
    if (!activeEdit) return;
    const { region, draft } = activeEdit;
    if (draft.trim() === region.currentText.trim()) { setActiveEdit(null); return; }
    setSaving(true);
    try {
      const patchContent = applyEdit(resume, region, draft.trim());
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
    const { region } = activeEdit;
    setRewriting(action);
    setRewriteError(null);
    try {
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resumeId}/bullet-rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: region.section, entryIndex: region.entryIndex, bulletIndex: region.bulletIndex, action }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setRewriteError(data?.error || "Rewrite failed");
        return;
      }
      setActiveEdit(prev => prev ? { ...prev, draft: data.text } : null);
    } catch {
      setRewriteError("Rewrite failed");
    } finally {
      setRewriting(null);
    }
  }

  const regions = hitRegions();

  return (
    <div ref={containerRef} className={`relative bg-white rounded-lg shadow-soft overflow-hidden ${className ?? ""}`}>
      <canvas ref={canvasRef} className="w-full h-auto block" />

      {/* Editable hit regions overlay — only shown when not actively editing */}
      {!rendering && !activeEdit && scale > 0 && regions.map(r => {
        const top = (PAGE.marginTop + r.y) * scale;
        const height = r.height * scale;
        const left = PAGE.marginLeft * scale;
        const width = (PAGE.width - PAGE.marginLeft - PAGE.marginRight) * scale;
        return (
          <button
            key={r.chunkId}
            onClick={() => { setRewriteError(null); setActiveEdit({ region: r, draft: r.currentText }); }}
            className="absolute group hover:bg-brand/10 hover:outline hover:outline-1 hover:outline-brand/40 rounded-sm transition-colors cursor-text"
            style={{ top, left, width, height }}
            title="Click to edit"
          >
            <span className="absolute -top-4 right-0 opacity-0 group-hover:opacity-100 bg-brand text-white text-[9px] px-1.5 py-0.5 rounded font-bold pointer-events-none transition-opacity">
              Edit
            </span>
          </button>
        );
      })}

      {/* Inline popover editor */}
      {activeEdit && scale > 0 && (() => {
        const r = activeEdit.region;
        const top = (PAGE.marginTop + r.y) * scale;
        const left = PAGE.marginLeft * scale;
        const width = (PAGE.width - PAGE.marginLeft - PAGE.marginRight) * scale;
        const popoverTop = top + r.height * scale + 4;
        return (
          <div
            className="absolute z-20 bg-paper rounded-xl shadow-xl border border-brand/30 p-2 flex flex-col gap-1.5"
            style={{ top: popoverTop, left: Math.max(8, left - 8), width: Math.min(width + 16, containerWidth - 16) }}
          >
            <textarea
              autoFocus
              className="w-full text-[11px] text-ink rounded-lg border border-line p-2 resize-none focus:outline-none focus:border-brand leading-relaxed"
              rows={3}
              value={activeEdit.draft}
              onChange={e => setActiveEdit(prev => prev ? { ...prev, draft: e.target.value } : null)}
              onKeyDown={e => {
                if (e.key === "Escape") setActiveEdit(null);
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSave(); }
              }}
            />
            {r.field === "bulletText" && (
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
        );
      })()}

      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <Loader2 className="w-5 h-5 text-brand animate-spin" />
        </div>
      )}
    </div>
  );
}
