// Client-side resume text extraction — keeps the API server dependency-free
// and ships ~10KB of text to import-resume instead of megabytes of base64.
import { loadPdfjs } from "./loadPdfjs";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_PDF_PAGES = 10;

export class ResumeTextError extends Error {}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjs();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
  const chunks: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map(item => ("str" in item ? item.str : ""))
      .join(" ");
    chunks.push(pageText);
  }
  return chunks.join("\n");
}

export async function extractResumeText(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ResumeTextError("File is too large — please upload a resume under 8MB.");
  }

  const name = file.name.toLowerCase();
  let text: string;

  if (name.endsWith(".txt") || file.type === "text/plain") {
    text = await file.text();
  } else if (name.endsWith(".pdf") || file.type === "application/pdf") {
    text = await extractPdfText(file);
  } else {
    throw new ResumeTextError("Please upload a PDF or plain text (.txt) resume.");
  }

  if (text.trim().length < 100) {
    throw new ResumeTextError("Couldn't read text from this file — is it a scanned image?");
  }

  return text.trim();
}
