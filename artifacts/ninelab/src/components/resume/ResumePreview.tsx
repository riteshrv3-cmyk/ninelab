import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ResumeDocument } from "@workspace/resume-core";
import { renderResumePdf, type RenderResult } from "@/lib/resume-pdf";
import { loadPdfjs } from "@/lib/loadPdfjs";

/** Warms the pdf.js worker ahead of the first real preview — call alongside preloadFonts() on mount. */
export function preloadPdfjs(): void {
  void loadPdfjs();
}

interface ResumePreviewProps {
  resume: ResumeDocument;
  templateId: string;
  className?: string;
  onLayout?: (layout: RenderResult["layout"]) => void;
}

/**
 * Renders the real PDF bytes to a canvas — same code path as the download
 * button, so the preview can never disagree with what the student gets.
 * Debounced 250ms; keeps the last good frame on screen while a newer one
 * renders so the preview never flashes blank on every keystroke.
 */
interface ResumeThumbnailProps {
  resume: ResumeDocument;
  templateId: string;
  className?: string;
}

/**
 * Lazy wrapper around ResumePreview for list contexts (resume cards) — defers
 * the render + font/pdf.js work until the card actually scrolls into view.
 */
export function ResumeThumbnail({ resume, templateId, className }: ResumeThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={containerRef} className={className}>
      {visible ? (
        <ResumePreview resume={resume} templateId={templateId} className="w-full" />
      ) : (
        <div className="w-full h-full bg-canvas rounded-lg" />
      )}
    </div>
  );
}

export function ResumePreview({ resume, templateId, className, onLayout }: ResumePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);
  // pdf.js throws if a second render() starts on the same canvas before the
  // first finishes — cancel any in-flight task before starting a new one.
  const renderTaskRef = useRef<import("pdfjs-dist").RenderTask | null>(null);

  useEffect(() => {
    const token = ++tokenRef.current;
    setRendering(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { doc, layout } = await renderResumePdf(resume, templateId, {});
          if (tokenRef.current !== token) return;

          const pdfjsLib = await loadPdfjs();
          const buf = doc.output("arraybuffer");
          if (tokenRef.current !== token) return;

          const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
          const page = await pdfDoc.getPage(1);
          if (tokenRef.current !== token) return;

          const canvas = canvasRef.current;
          if (!canvas) return;

          // Backing-store resolution only — display size is left to CSS
          // (the "w-full h-auto" class below) so the same canvas scales
          // correctly whether it's a card thumbnail or a large split-view panel.
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

          onLayout?.(layout);
          setError(null);
        } catch (e) {
          const isCancelled = e instanceof Error && e.name === "RenderingCancelledException";
          if (!isCancelled && tokenRef.current === token) setError((e as Error).message);
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

  return (
    <div className={`relative bg-white rounded-lg shadow-soft overflow-hidden ${className ?? ""}`}>
      <canvas ref={canvasRef} className="w-full h-auto block" />
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <Loader2 className="w-5 h-5 text-brand animate-spin" />
        </div>
      )}
      {error && !rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white p-4">
          <p className="text-[11px] text-danger text-center">Couldn't render preview: {error}</p>
        </div>
      )}
    </div>
  );
}
