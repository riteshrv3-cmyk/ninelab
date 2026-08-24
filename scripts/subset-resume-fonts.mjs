#!/usr/bin/env node
// Documents (and can re-run) how the resume PDF engine's embedded fonts were
// produced. This is a ONE-TIME LOCAL step, not part of the build — the output
// (artifacts/ninelab/public/fonts/resume/*.ttf) is committed to git like any
// other static asset. Nothing in CI/Render ever runs Python; this script is for
// a developer's machine only, if the font set ever needs to change.
//
// Requires: Python 3 + `pip install fonttools` (this repo has no other Python
// dependency; do not add fonttools to any Node build step).
//
// Usage: node scripts/subset-resume-fonts.mjs
//
// Source: Source Sans 3 + Source Serif 4, OFL-licensed, from google/fonts.
// Both ship only as variable fonts (a single .ttf with a weight/optical-size
// axis) — jsPDF embeds a font as a fixed instance, so we first pin static
// Regular/SemiBold/Italic instances with fonttools' variable-font instancer,
// then subset each to the exact glyph set the resume PDFs need: Latin-1,
// Latin Extended-A (covers common transliterated-name diacritics),
// typographic punctuation (– — ‘ ’ “ ” • … ▪), and the Rupee sign (₹ U+20B9).
//
// Any character outside this set falls back to a missing glyph in the
// embedded-font templates (the engine falls back to Helvetica entirely if the
// font fails to load at all) — see resume-pdf/fonts.ts.

import { execSync } from "node:child_process";
import { mkdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const UNICODES = "U+0020-00FF,U+0100-017F,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+25AA,U+20B9";

const DEST = path.resolve(import.meta.dirname, "../artifacts/ninelab/public/fonts/resume");
const TMP = path.join(os.tmpdir(), `resume-fonts-${Date.now()}`);

const SOURCES = {
  "SourceSans3-VF.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/SourceSans3%5Bwght%5D.ttf",
  "SourceSans3-Italic-VF.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/SourceSans3-Italic%5Bwght%5D.ttf",
  "SourceSerif4-VF.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/SourceSerif4%5Bopsz%2Cwght%5D.ttf",
  "SourceSerif4-Italic-VF.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/SourceSerif4-Italic%5Bopsz%2Cwght%5D.ttf",
};

const OFL_SOURCES = {
  "OFL-SourceSans3.txt": "https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/OFL.txt",
  "OFL-SourceSerif4.txt": "https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/OFL.txt",
};

// [family, variable-font source file, italic?, axis pins per weight instance]
const INSTANCES = [
  ["SourceSans3", "SourceSans3-VF.ttf", "Regular", "wght=400"],
  ["SourceSans3", "SourceSans3-VF.ttf", "SemiBold", "wght=600"],
  ["SourceSans3", "SourceSans3-Italic-VF.ttf", "Italic", "wght=400"],
  ["SourceSerif4", "SourceSerif4-VF.ttf", "Regular", "wght=400 opsz=12"],
  ["SourceSerif4", "SourceSerif4-VF.ttf", "SemiBold", "wght=600 opsz=12"],
  ["SourceSerif4", "SourceSerif4-Italic-VF.ttf", "Italic", "wght=400 opsz=12"],
];

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

mkdirSync(TMP, { recursive: true });
mkdirSync(DEST, { recursive: true });

for (const [name, url] of Object.entries(SOURCES)) {
  run(`curl -sS -m 30 -o "${path.join(TMP, name)}" "${url}"`);
}

for (const [family, srcFile, faceName, axisPins] of INSTANCES) {
  const src = path.join(TMP, srcFile);
  const staticOut = path.join(TMP, `${family}-${faceName}-static.ttf`);
  const finalOut = path.join(DEST, `${family}-${faceName}.ttf`);
  run(`python -m fontTools.varLib.instancer "${src}" ${axisPins} -o "${staticOut}"`);
  run(
    `python -m fontTools.subset "${staticOut}" --unicodes="${UNICODES}" --layout-features="*" ` +
      `--glyph-names --symbol-cmap --legacy-cmap --notdef-glyph --notdef-outline ` +
      `--recommended-glyphs --name-IDs="*" --name-legacy --output-file="${finalOut}"`,
  );
}

for (const [name, url] of Object.entries(OFL_SOURCES)) {
  run(`curl -sS -m 15 -o "${path.join(DEST, name)}" "${url}"`);
}

rmSync(TMP, { recursive: true, force: true });
console.log(`\nDone. Fonts written to ${DEST}`);
