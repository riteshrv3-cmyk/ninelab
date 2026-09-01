import { useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Building2, Copy, Download, FileText, Pencil, Share2, Sparkles, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upgradeContent, buildQualityReport } from "@workspace/resume-core";
import { resolveTemplateConfig } from "@/lib/resume-pdf";
import { ResumeThumbnail } from "./ResumePreview";
import { isContentEmpty, type SavedResume } from "./resumeTypes";

export function ResumeCard({
  resume,
  onDelete,
  onDownload,
  onDownloadDocx,
  onCopyText,
  onShare,
  onEdit,
  onReview,
  onRetarget,
}: {
  resume: SavedResume;
  onDelete: () => void;
  onDownload: () => void;
  onDownloadDocx: () => void;
  onCopyText: () => void;
  onShare: () => void;
  onEdit: () => void;
  onReview: () => void;
  onRetarget: () => void;
}) {
  const [, setLocation] = useLocation();
  const tmpl = resolveTemplateConfig(resume.templateId);
  const date = new Date(resume.createdAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const liveDoc = useMemo(() => upgradeContent(resume.content), [resume.content]);
  const hollow = isContentEmpty(resume.content);
  // Server-persisted score when present; derived live for rows written before
  // the quality engine shipped.
  const qualityScore = useMemo(
    () => resume.qualityScore ?? buildQualityReport(liveDoc, { density: tmpl.density }).total,
    [resume.qualityScore, liveDoc, tmpl.density],
  );

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
          ) : (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {/* Neutral chip, not the red/amber/green ramp — scoreTone reserves
                  that for pass/fail states; the review flow carries the nuance. */}
              <span className="type-micro font-bold px-2 py-0.5 rounded-full bg-canvas border border-line text-ink">
                Score {qualityScore}/100
              </span>
              {liveDoc.atsMeta && (
                <span className="type-micro font-bold px-2 py-0.5 rounded-full bg-canvas border border-line text-ink-muted">
                  ATS {liveDoc.atsMeta.scorePct}%
                </span>
              )}
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
          onClick={onReview}
          className="flex-1 h-9 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-xs"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Review
        </Button>
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
          variant="outline"
          className="flex-1 h-9 rounded-full font-bold text-xs border border-line text-ink-muted"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          PDF
        </Button>
        <Button
          onClick={onDownloadDocx}
          variant="outline"
          className="h-9 w-9 rounded-full border border-line text-ink-muted flex items-center justify-center shrink-0"
          title="Download DOCX"
        >
          <FileText className="w-3.5 h-3.5" />
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
