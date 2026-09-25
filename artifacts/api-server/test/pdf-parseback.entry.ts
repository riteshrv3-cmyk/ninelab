import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { ResumeDocument } from "@workspace/resume-core";
import { renderPlainText } from "@workspace/resume-core";
import { renderResumePdf, resumeFileName } from "../src/lib/resume/pdf";
import { strong } from "../../../lib/resume-core/test/fixtures/strong";
import { mediocre } from "../../../lib/resume-core/test/fixtures/mediocre";
import { TYPE_SCALE } from "../../ninelab/src/lib/resume-pdf/tokens";

const HEADINGS: Record<string, Record<string, string>> = {
  ats: { summary: "SUMMARY", experience: "WORK EXPERIENCE", projects: "PROJECTS", skills: "TECHNICAL SKILLS", education: "EDUCATION", certifications: "CERTIFICATIONS", achievements: "ACHIEVEMENTS" },
  classic: { summary: "SUMMARY", experience: "PROFESSIONAL EXPERIENCE", projects: "PROJECTS", skills: "TECHNICAL SKILLS", education: "EDUCATION", certifications: "CERTIFICATIONS", achievements: "ACHIEVEMENTS" },
  tech: { summary: "SUMMARY", experience: "EXPERIENCE", projects: "PROJECTS", skills: "TECHNICAL SKILLS", education: "EDUCATION", certifications: "CERTIFICATIONS", achievements: "ACHIEVEMENTS" },
  minimal: { summary: "SUMMARY", experience: "EXPERIENCE", projects: "PROJECTS", skills: "TECHNICAL SKILLS", education: "EDUCATION", certifications: "CERTIFICATIONS", achievements: "ACHIEVEMENTS" },
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

async function pdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, isEvalSupported: false });
  const pdf = await task.promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items as Array<{ str: string; hasEOL?: boolean }>) {
      line += item.str;
      if (item.hasEOL) { parts.push(line); line = ""; }
    }
    if (line) parts.push(line);
  }
  return { text: parts.join("\n"), pages: pdf.numPages };
}

async function checkOne(label: string, doc: ResumeDocument, templateId: string, outDir: string): Promise<string[]> {
  const failures: string[] = [];
  const pdf = await renderResumePdf(doc, templateId, `${doc.contact.name} Resume`);
  writeFileSync(path.join(outDir, `${label}-${templateId}.pdf`), pdf);
  const { text, pages } = await pdfText(pdf);
  writeFileSync(path.join(outDir, `${label}-${templateId}.txt`), text);
  const flat = norm(text);

  const expect = (s: string, what: string) => { if (!flat.includes(norm(s))) failures.push(`${templateId}: missing ${what}: "${s.slice(0, 60)}"`); };
  expect(doc.contact.name, "name");
  expect(doc.contact.email, "email");
  if (doc.contact.phone) expect(doc.contact.phone, "phone");
  for (const l of doc.contact.links) expect(l.label, "link");
  for (const e of doc.experience) {
    expect(e.role, "role"); expect(e.company, "company");
    expect([e.start, e.end].filter(Boolean).join(" - "), "dates");
    for (const b of e.bullets) expect(b.text.slice(0, 50), "experience bullet");
  }
  for (const p of doc.projects) { expect(p.title, "project"); for (const b of p.bullets) expect(b.text.slice(0, 50), "project bullet"); }
  for (const s of doc.skillSections) for (const i of s.items) expect(i, "skill");

  // Headings present, and in the document's order (reading order survives).
  // Reading order in the raw text stream (what a simple parser sees): name,
  // then each heading followed by its own content, in the document's order.
  const anchors: Array<{ s: string; what: string }> = [{ s: doc.contact.name, what: "name" }];
  for (const key of doc.order) {
    anchors.push({ s: HEADINGS[templateId][key], what: `heading ${key}` });
    const items: string[] =
      key === "summary" ? [doc.summary] :
      key === "experience" ? doc.experience.flatMap((e) => [e.role, ...e.bullets.map((b) => b.text)]) :
      key === "projects" ? doc.projects.flatMap((p) => [p.title, ...p.bullets.map((b) => b.text)]) :
      key === "skills" ? doc.skillSections.map((x) => `${x.category}:`) :
      key === "education" ? doc.education.map((e) => e.degree) :
      key === "certifications" ? doc.certifications.map((c) => c.name) :
      doc.achievements.map((a) => a.text);
    for (const it of items) if (it.trim()) anchors.push({ s: it.slice(0, 40), what: `${key} item` });
  }
  let cursor = 0;
  for (const a of anchors) {
    const idx = flat.indexOf(norm(a.s), cursor);
    if (idx === -1) failures.push(`${templateId}: out of reading order or missing: ${a.what} "${a.s.slice(0, 40)}"`);
    else cursor = idx;
  }
  if (/(?:\b[A-Za-z] ){4,}[A-Za-z]\b/.test(text)) failures.push(`${templateId}: letter-spaced text found`);
  if (/[·▪–]/.test(text)) failures.push(`${templateId}: non-ASCII separator in text layer`);
  // Two different fonts sharing one embedded name (the old Source Sans files
  // did) made ResumeGo reject the file as "non-standard font".
  const subsetsByName = new Map<string, Set<string>>();
  for (const m of pdf.toString("latin1").matchAll(/\/BaseFont\s*\/([A-Z]{6})\+([A-Za-z0-9-]+)/g)) {
    subsetsByName.set(m[2], (subsetsByName.get(m[2]) ?? new Set()).add(m[1]));
  }
  for (const [name, subsets] of subsetsByName) {
    if (subsets.size > 1) failures.push(`${templateId}: ${subsets.size} different fonts embedded under one name "${name}"`);
  }
  if (label === "strong" && pages !== 1) failures.push(`${templateId}: strong fixture ran to ${pages} pages`);
  // Every word the scorer reads must be on the page.
  const scored = renderPlainText(doc).split("\n").map(norm).filter((l) => l.length > 3);
  for (const l of scored) if (!flat.includes(l.slice(0, 40))) failures.push(`${templateId}: scored text not printed: "${l.slice(0, 50)}"`);
  return failures;
}

async function main() {
  const outDir = path.resolve(process.argv[2] ?? "pdf-out");
  mkdirSync(outDir, { recursive: true });
  const failures: string[] = [];
  for (const templateId of ["ats", "classic", "tech", "minimal"]) {
    failures.push(...(await checkOne("strong", strong, templateId, outDir)));
    failures.push(...(await checkOne("mediocre", mediocre, templateId, outDir)));
  }
  // Fractional CSS-pixel font sizes made ResumeGo's parser reject the PDF.
  for (const [role, t] of Object.entries(TYPE_SCALE)) {
    const px = (t.size * 4) / 3;
    if (Math.abs(px - Math.round(px)) > 1e-6) failures.push(`type scale ${role}: ${t.size}pt is ${px.toFixed(2)}px, not a whole pixel`);
  }
  if (resumeFileName("Priya Deshmukh") !== "Priya-Deshmukh-Resume.pdf") failures.push("bad file name");
  if (failures.length) {
    console.error(`PARSE-BACK FAILED (${failures.length})\n` + failures.join("\n"));
    process.exit(1);
  }
  console.log(`PARSE-BACK OK: 8 PDFs in ${outDir}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
