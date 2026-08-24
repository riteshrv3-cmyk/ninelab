import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shown when the browser reports no connectivity.
 *
 * The service worker precaches the app shell, so an offline student still gets
 * a fully rendered app — which is exactly why this is needed. Without it the
 * screens look normal but every list is empty, and that reads as "the app is
 * broken" rather than "you have no signal". No opportunity, profile, or resume
 * data is cached, so there is genuinely nothing to show until they reconnect.
 *
 * Rendered in normal flow rather than fixed so it can never cover the nav or
 * fight the in-page bottom sheets for z-index.
 */
export function OfflineBanner() {
  // navigator.onLine is only trustworthy in the negative: false reliably means
  // no network, true just means an interface is up.
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="mx-4 mb-3 flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-paper"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <p className="text-[12px] font-semibold text-paper">
        You're offline — Toko can't reach the boards right now.
      </p>
    </div>
  );
}
