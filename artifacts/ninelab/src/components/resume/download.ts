// Download/share plumbing shared by the page shell, GenerateSheet, and
// ReviewFlow. Guests can generate freely, but downloading/sharing requires an
// account — the intent survives the sign-up redirect via sessionStorage and
// fires automatically once the student lands back on /resume signed in.

import { upgradeContent } from "@workspace/resume-core";
import { apiFetch } from "@/lib/api/authFetch";
import { printResume } from "./html/printResume";
import { renderResumeDocx } from "@/lib/resume-pdf/resume-docx";
import type { SavedResume } from "./resumeTypes";

export type DownloadIntent = "pdf" | "docx" | "share";
const DOWNLOAD_INTENT_KEY = "resumeDownloadIntent";

export function stashDownloadIntent(resumeId: number, intent: DownloadIntent): void {
  sessionStorage.setItem(DOWNLOAD_INTENT_KEY, JSON.stringify({ resumeId, intent }));
}

export function consumeDownloadIntent(): { resumeId: number; intent: DownloadIntent } | null {
  const raw = sessionStorage.getItem(DOWNLOAD_INTENT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(DOWNLOAD_INTENT_KEY);
  try {
    const parsed = JSON.parse(raw) as { resumeId?: unknown; intent?: unknown };
    if (typeof parsed.resumeId === "number" && (parsed.intent === "pdf" || parsed.intent === "docx" || parsed.intent === "share")) {
      return { resumeId: parsed.resumeId, intent: parsed.intent };
    }
  } catch {
    // malformed — ignore
  }
  return null;
}

/**
 * If signed in, runs the action now. If confirmed a guest (Clerk has finished
 * loading and isSignedIn is false), stashes the intent and sends the student
 * to sign up. While Clerk is still loading, fails open and runs the action —
 * this is a growth nudge, not a security gate.
 */
export function gateOnSignup(
  isLoaded: boolean,
  isSignedIn: boolean | undefined,
  setLocation: (path: string) => void,
  resumeId: number,
  intent: DownloadIntent,
  run: () => void,
): void {
  if (!isLoaded || isSignedIn) {
    run();
    return;
  }
  stashDownloadIntent(resumeId, intent);
  setLocation("/sign-up");
}

// Fire-and-forget: logs the download and auto-links this resume to a
// same-company application if one's waiting unlinked. Never blocks or
// fails the download itself.
export function notifyResumeDownloaded(resume: SavedResume): void {
  apiFetch(`/api/students/${resume.studentId}/resumes/${resume.id}/downloaded`, { method: "POST" }).catch(() => {});
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Server-rendered PDF first: a real file, identical on every phone, no print
 * dialog headers, named First-Last-Resume.pdf. Falls back to the browser's
 * print dialog if the server can't render one (offline, no Chromium).
 */
export async function downloadResumePDF(resume: SavedResume): Promise<void> {
  const doc = upgradeContent(resume.content);
  try {
    const r = await apiFetch(`/api/students/${resume.studentId}/resumes/${resume.id}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: resume.content, templateId: resume.templateId }),
    });
    if (r.ok && (r.headers.get("content-type") ?? "").includes("application/pdf")) {
      const filename = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? "Resume.pdf";
      saveBlob(await r.blob(), filename);
      notifyResumeDownloaded(resume);
      return;
    }
  } catch {
    // Fall through to the print path.
  }
  await printResume(doc, resume.templateId, resume.name);
  notifyResumeDownloaded(resume);
}

export async function downloadResumeDocx(resume: SavedResume): Promise<void> {
  const doc = upgradeContent(resume.content);
  const { blob, filename } = await renderResumeDocx(doc, resume.name);
  saveBlob(blob, filename);
  notifyResumeDownloaded(resume);
}
