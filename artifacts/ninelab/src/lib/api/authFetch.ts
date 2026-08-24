// Thin fetch wrapper for the ~10 pages that call the API server directly (as opposed
// to the generated react-query hooks, which go through @workspace/api-client-react's
// custom-fetch.ts). Centralizes the BASE prefix and attaches the same auth headers.

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type TokenGetter = () => Promise<string | null>;

let _tokenGetter: TokenGetter | null = null;

/** Registered once by <AuthBridge/> with Clerk's getToken. */
export function setApiTokenGetter(getter: TokenGetter | null): void {
  _tokenGetter = getter;
}

export function getGuestToken(): string | null {
  return localStorage.getItem("guestToken");
}

export function setGuestToken(token: string | null): void {
  if (token) localStorage.setItem("guestToken", token);
  else localStorage.removeItem("guestToken");
}

let handledStaleSession = false;

/**
 * Drop-in replacement for `fetch(BASE + path, init)` that prefixes BASE and attaches
 * `Authorization: Bearer <clerk token>` (if signed in) and `x-guest-token` (if not).
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  const token = _tokenGetter ? await _tokenGetter() : null;
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const guestToken = getGuestToken();
  if (guestToken && !headers.has("x-guest-token")) {
    headers.set("x-guest-token", guestToken);
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  // The server returns 401 here only when it saw neither a Clerk session nor a
  // guest token at all (a mismatched-but-present guest token is 403, handled
  // elsewhere). If we didn't attach either, the local `studentId` points at a
  // session with no way to authenticate — most often a guest row created
  // before guestToken existed on this device. There's no recovering that
  // session client-side, so reset local identity and let onboarding create a
  // fresh one, instead of leaving every screen stuck on an error/skeleton.
  if (res.status === 401 && !token && !guestToken && !handledStaleSession) {
    handledStaleSession = true;
    localStorage.removeItem("studentId");
    localStorage.removeItem("studentName");
    localStorage.removeItem("clerkUserId");
    localStorage.removeItem("clerkEmail");
    setGuestToken(null);
    window.location.assign(`${BASE}/`);
  }

  return res;
}

/** apiFetch + json parsing + throw on non-2xx, for the common case. */
export async function apiFetchJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
  }
  if (res.status === 204) return null as T;
  return res.json();
}
