import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api/authFetch";
import { extractResumeText, ResumeTextError } from "@/lib/resumeText";

export interface ImportSummary {
  fieldsFilled: string[];
  projectsAdded: number;
  certificationsAdded: number;
  experienceAdded: number;
}

type Status = "idle" | "reading" | "importing" | "done" | "error";

interface ResumeImportProps {
  /** Live mode: import fires immediately against this student. */
  studentId?: number | null;
  onImported?: (summary: ImportSummary) => void;
  /** Deferred mode: only extracts text and hands it up — used by onboarding,
   * where a studentId doesn't exist yet. */
  deferred?: boolean;
  onTextReady?: (text: string, filename: string) => void;
  className?: string;
  label?: string;
}

export function ResumeImport({
  studentId,
  onImported,
  deferred = false,
  onTextReady,
  className = "",
  label = "Upload your resume",
}: ResumeImportProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [filename, setFilename] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setStatus("reading");
    setFilename(file.name);
    try {
      const text = await extractResumeText(file);

      if (deferred) {
        onTextReady?.(text, file.name);
        setStatus("done");
        return;
      }

      if (!studentId) {
        throw new Error("No profile to import into yet");
      }

      setStatus("importing");
      const r = await apiFetch(`/api/students/${studentId}/profile/import-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Import failed");
      }
      const data = await r.json() as { summary: ImportSummary };
      setStatus("done");
      const { projectsAdded, certificationsAdded, experienceAdded } = data.summary;
      toast({
        title: "Profile filled from your resume",
        description: `${projectsAdded} project(s), ${certificationsAdded} certification(s), ${experienceAdded} experience entr${experienceAdded === 1 ? "y" : "ies"} added.`,
      });
      onImported?.(data.summary);
    } catch (e) {
      setStatus("error");
      const message = e instanceof ResumeTextError || e instanceof Error ? e.message : "Couldn't read this file";
      toast({ title: "Import failed", description: message, variant: "destructive" });
    }
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const busy = status === "reading" || status === "importing";

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,text/plain,application/pdf"
        className="hidden"
        onChange={onSelect}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full h-11 rounded-full border border-line text-brand bg-paper font-bold text-[13px]"
      >
        {status === "reading" && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reading your resume…</>}
        {status === "importing" && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Filling your profile…</>}
        {status === "done" && <><CheckCircle2 className="w-4 h-4 mr-2 text-done" /> {filename}</>}
        {(status === "idle" || status === "error") && <><Upload className="w-4 h-4 mr-2" /> {label}</>}
      </Button>
    </div>
  );
}
