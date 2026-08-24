import { useEffect, useState } from "react";
import { upgradeContent } from "@workspace/resume-core";
import { renderResumePdf } from "@/lib/resume-pdf";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type jsPDF from "jspdf";

interface PublicResumeData {
  id: number;
  name: string;
  templateId: string;
  content: unknown;
  shareViews: number;
}

function openPDF(doc: jsPDF, filename: string) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function PublicResume({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicResumeData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/r/${slug}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then(d => {
        if (!d) return;
        setData(d);
        // Fire-and-forget view increment
        fetch(`/api/r/${slug}/view`, { method: "POST" }).catch(() => undefined);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  async function handleDownload() {
    if (!data) return;
    setDownloading(true);
    try {
      const doc = upgradeContent(data.content);
      const { doc: pdfDoc, filename } = await renderResumePdf(doc, data.templateId, { resumeName: data.name });
      openPDF(pdfDoc, filename);
    } finally {
      setDownloading(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-ink">
        <div className="text-center space-y-2 p-8">
          <p className="text-display text-2xl font-extrabold">Resume not found</p>
          <p className="text-ink-muted text-sm">This link may have been removed or expired.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
      </div>
    );
  }

  const liveDoc = upgradeContent(data.content);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-10 bg-paper border-b border-line px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold text-ink text-[15px] truncate">{data.name}</p>
          {data.shareViews > 0 && (
            <p className="text-[11px] text-ink-muted flex items-center gap-1 mt-0.5">
              <Eye className="w-3 h-3" />
              {data.shareViews} view{data.shareViews !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="h-9 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-xs shrink-0"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
          {downloading ? "Generating…" : "Download PDF"}
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center py-6 px-4">
        <ResumePreview resume={liveDoc} templateId={data.templateId} className="w-full max-w-2xl" />
        <p className="mt-6 text-[11px] text-ink-muted text-center">
          Built with ninelab — AI resume builder for students
        </p>
        <a
          href="/"
          className="mt-2 type-caption font-semibold text-brand text-center"
        >
          Made with ninelab — build yours free
        </a>
      </main>
    </div>
  );
}
