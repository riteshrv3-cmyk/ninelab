import { createRoot } from "react-dom/client";
import { installPolyfills } from "./lib/polyfills";
import App from "./App";
import { AppErrorBoundary, clearReloadFlag, reloadOnceForNewBuild } from "./components/AppErrorBoundary";
import "./index.css";

installPolyfills();

// A deploy removes the previous build's chunks. A tab still running the old
// build fails its next lazy import; reload once onto the new build instead of
// crashing.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForNewBuild()) event.preventDefault();
});

// The new service worker takes over immediately (skipWaiting + clientsClaim)
// and deletes the old precache. Reload so the page and its chunks match it.
// Skipped on first install, when there was no previous controller.
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);

// Rendered without a chunk error: allow a future one-time reload again.
setTimeout(clearReloadFlag, 10_000);
