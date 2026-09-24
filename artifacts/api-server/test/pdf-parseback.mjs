// Renders fixture resumes to PDF with real Chromium and reads the text back
// the way an ATS parser would. Usage: node test/pdf-parseback.mjs [outDir]
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(here, ".parseback.mjs");
await build({
  entryPoints: [path.join(here, "pdf-parseback.entry.ts")],
  platform: "node", bundle: true, format: "esm", outfile, jsx: "automatic", logLevel: "warning",
  external: ["puppeteer-core", "pdfjs-dist", "pino", "pino-pretty"],
  alias: { "@resume-render": path.resolve(here, "../../ninelab/src/components/resume/html/printDocument.ts") },
  banner: { js: "import { createRequire as __cr } from 'node:module'; globalThis.require = __cr(import.meta.url);" },
});
const r = spawnSync(process.execPath, [outfile, process.argv[2] ?? path.join(here, "pdf-out")], { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
process.exit(r.status ?? 1);
