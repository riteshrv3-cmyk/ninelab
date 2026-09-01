import { useEffect, useRef, useState } from "react";
import type { ResumeDocument } from "@workspace/resume-core";
import { PAGE } from "@/lib/resume-pdf/geometry";
import { ResumeHtml, type ResumeMeasure } from "./html/ResumeHtml";

// A4 page width in CSS pixels (pt × 4/3) — the unscaled size ResumeHtml renders at.
const PAGE_WIDTH_PX = (PAGE.width * 4) / 3;

interface ResumePreviewProps {
  resume: ResumeDocument;
  templateId: string;
  className?: string;
  onMeasure?: (m: ResumeMeasure) => void;
  highlightSection?: string;
}

/**
 * Scales the real ResumeHtml page down to fit its container — the exact markup
 * the print/download path uses, so the preview can never disagree with the PDF.
 * Instant on every keystroke (no canvas, no worker, no debounce needed).
 */
export function ResumePreview({ resume, templateId, className, onMeasure, highlightSection }: ResumePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const update = () => {
      const w = container.clientWidth;
      const s = w > 0 ? w / PAGE_WIDTH_PX : 0;
      setScale(s);
      setScaledHeight(inner.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative bg-white rounded-lg shadow-soft overflow-hidden ${className ?? ""}`}
      style={scaledHeight !== null ? { height: scaledHeight } : { aspectRatio: "210 / 297" }}
    >
      <div
        ref={innerRef}
        style={{ width: PAGE_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: "top left", visibility: scale > 0 ? "visible" : "hidden" }}
      >
        <ResumeHtml doc={resume} templateId={templateId} onMeasure={onMeasure} highlightSection={highlightSection} />
      </div>
    </div>
  );
}

interface ResumeThumbnailProps {
  resume: ResumeDocument;
  templateId: string;
  className?: string;
}

/**
 * Lazy wrapper around ResumePreview for list contexts (resume cards) — defers
 * rendering until the card actually scrolls into view.
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
