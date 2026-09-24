// esbuild aliases this to artifacts/ninelab/src/components/resume/html/printDocument.ts
// (see build.mjs). Declared here so tsc doesn't have to typecheck the app's JSX.
declare module "@resume-render" {
  import type { ResumeDocument } from "@workspace/resume-core";
  export function buildPrintDocument(doc: ResumeDocument, templateId: string, title: string): string;
}
