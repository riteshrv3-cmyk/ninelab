// Side-effect-only module: importing it installs our runtime polyfills.
// Kept separate from the pdf.js worker import so ES module evaluation order
// (imported modules evaluate depth-first, in source order, before the
// importer's body) guarantees the polyfill is in place before any code that
// depends on it runs. Do NOT inline this into pdfWorker.ts — import hoisting
// would run the pdf.js worker import first and defeat the ordering.
import { installPolyfills } from "./polyfills";

installPolyfills();
