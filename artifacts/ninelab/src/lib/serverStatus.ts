import { useSyncExternalStore } from "react";

// "Is the ninelab server answering?" for the whole app. navigator.onLine only
// knows about the device's network; when the server itself is down (the
// Railway outage of 2026-09-21) every screen just showed its own error.

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const EVENT = "kt:server-status";
const RECHECK_MS = 20_000;

let down = false;
let recheckTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  window.dispatchEvent(new Event(EVENT));
}

async function recheck() {
  recheckTimer = null;
  try {
    const r = await fetch(`${BASE}/api/healthz`, { cache: "no-store" });
    if (r.ok && !r.headers.get("x-railway-fallback")) {
      markServerUp();
      return;
    }
  } catch {
    /* still unreachable */
  }
  recheckTimer = setTimeout(recheck, RECHECK_MS);
}

export function markServerDown(): void {
  if (!down) {
    down = true;
    emit();
  }
  if (!recheckTimer) recheckTimer = setTimeout(recheck, RECHECK_MS);
}

export function markServerUp(): void {
  if (recheckTimer) {
    clearTimeout(recheckTimer);
    recheckTimer = null;
  }
  if (down) {
    down = false;
    emit();
  }
}

/** A response that means the server itself isn't answering (vs an app error). */
export function isOutageResponse(r: Response): boolean {
  if (r.headers.get("x-railway-fallback") || r.status === 502 || r.status === 503 || r.status === 504) return true;
  // Our API answers every error in JSON; a non-JSON 5xx came from a proxy in
  // front of it, i.e. the API itself isn't answering.
  return r.status >= 500 && !(r.headers.get("content-type") ?? "").includes("application/json");
}

/** A fetch() rejection while the device reports a network: server unreachable. */
export function isOutageError(e: unknown): boolean {
  return e instanceof TypeError && (typeof navigator === "undefined" || navigator.onLine);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Runs `fn` each time the server comes back after an outage. */
export function onServerBack(fn: () => void): () => void {
  const handler = () => {
    if (!down) fn();
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export function useServerDown(): boolean {
  return useSyncExternalStore(subscribe, () => down, () => false);
}
