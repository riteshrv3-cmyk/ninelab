// Custom pdf.js worker entry.
//
// pdf.js runs its rendering math in a Web Worker, which has its own global
// scope — a polyfill installed on the main thread does not reach it. pdfjs-dist
// v6 calls Math.sumPrecise (Chrome 137+ / Safari 18.4+ only), so on older
// browsers and budget Android webviews the worker throws
// "Math.sumPrecise is not a function" and the resume PDF preview fails.
//
// This wrapper installs the polyfill into the worker scope FIRST (via the
// side-effect import), then loads the real pdf.js worker. Wired up through
// GlobalWorkerOptions.workerPort in InlineEditPreview.
import "./installPolyfills.side-effect";
import "pdfjs-dist/build/pdf.worker.min.mjs";
