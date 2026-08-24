import { useEffect, useState } from "react";
import { X, Share, SquarePlus, Smartphone } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Slim "get the app" banner, mobile only, shown immediately under the header.
 *
 * Android/Chromium: captures the browser's beforeinstallprompt event (stashed
 * at module scope because it can fire before React mounts) and re-fires it on
 * tap — a real one-tap install. iOS Safari never fires that event and has no
 * install API, so tapping opens a mini guide sheet (Share -> Add to Home
 * Screen) instead. Desktop never renders it.
 *
 * Dismissal snoozes for 7 days (localStorage). Once the app runs standalone
 * (installed) the banner never renders again; the appinstalled event hides it
 * immediately in the same session.
 */

const SNOOZE_KEY = "kt:install-snoozed-at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Captured at import time — Chrome often fires this before components mount.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn());
  });
}

/** True when the captured Android/Chromium install prompt is available. */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** Fire the captured install prompt. Resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const p = deferredPrompt;
  deferredPrompt = null;
  await p.prompt();
  const choice = await p.userChoice.catch(() => null);
  return choice?.outcome === "accepted";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || iPadOS;
}

function isMobile(): boolean {
  return isIOS() || /android/i.test(navigator.userAgent);
}

function snoozed(): boolean {
  const at = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  return at > 0 && Date.now() - at < SNOOZE_MS;
}

export function InstallBanner() {
  const [visible, setVisible] = useState(
    () => typeof window !== "undefined" && isMobile() && !isStandalone() && !snoozed(),
  );
  const [showGuide, setShowGuide] = useState(false);
  // Re-render when the deferred prompt arrives so the Android tap works even
  // if the event fires after mount.
  const [, bump] = useState(0);

  useEffect(() => {
    const onPrompt = () => bump((n) => n + 1);
    promptListeners.add(onPrompt);
    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      promptListeners.delete(onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (canPromptInstall()) {
      // Declined native prompt: leave the banner; the X is the explicit snooze.
      if (await promptInstall()) setVisible(false);
      return;
    }
    // iOS (or Android before the event fires): show the manual guide.
    setShowGuide(true);
  };

  return (
    <>
      <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-2xl bg-brand-soft px-3.5 py-2.5 lg:hidden">
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0">
          <Smartphone className="w-4 h-4 text-white" />
        </div>
        <p className="text-[12px] font-semibold text-ink flex-1 leading-snug">
          Get the app experience — faster, fullscreen, one tap away.
        </p>
        <button
          type="button"
          onClick={install}
          className="shrink-0 bg-brand text-white text-[12px] font-bold px-3 py-1.5 rounded-full"
        >
          Install
        </button>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1 text-ink-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {showGuide && (
          <>
            <motion.div
              className="fixed inset-0 bg-ink/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuide(false)}
            />
            <motion.div
              className="fixed bottom-0 inset-x-0 z-50 bg-paper rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            >
              <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
              <h3 className="text-[16px] font-extrabold text-ink mb-3">Add ninelab to your home screen</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-canvas flex items-center justify-center shrink-0">
                    <Share className="w-4.5 h-4.5 text-brand" />
                  </div>
                  <p className="text-[13px] text-ink">
                    Tap the <span className="font-bold">Share</span> button in your browser
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-canvas flex items-center justify-center shrink-0">
                    <SquarePlus className="w-4.5 h-4.5 text-brand" />
                  </div>
                  <p className="text-[13px] text-ink">
                    Choose <span className="font-bold">Add to Home Screen</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full bg-brand text-white text-[14px] font-bold py-3 rounded-xl"
              >
                Got it
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
