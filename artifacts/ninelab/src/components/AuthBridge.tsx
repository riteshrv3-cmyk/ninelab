import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { setAuthTokenGetter, setGuestTokenGetter } from "@workspace/api-client-react";
import { setApiTokenGetter, getGuestToken, setClerkSignedOut } from "@/lib/api/authFetch";

// Resolves once Clerk has loaded. Until then isSignedIn is undefined, and a
// getter that answered null right away sent a signed-in student's first
// requests with no token (a 401 that wiped their local session).
let markClerkLoaded: () => void = () => {};
const clerkLoaded = new Promise<void>((resolve) => {
  markClerkLoaded = resolve;
});
const CLERK_LOAD_WAIT_MS = 5000;

/**
 * Registers Clerk's getToken into both fetch layers (the generated react-query hooks'
 * custom-fetch, and the hand-written apiFetch used by pages with raw fetch calls) so
 * every API call carries the signed-in bearer token — or, when signed out, the guest
 * token from localStorage. Mount once, above the router.
 */
export function AuthBridge() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const latest = useRef({ getToken, isSignedIn });
  latest.current = { getToken, isSignedIn };

  useEffect(() => {
    if (isLoaded) markClerkLoaded();
    setClerkSignedOut(isLoaded === true && isSignedIn === false);
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const getter = async () => {
      await Promise.race([clerkLoaded, new Promise((r) => setTimeout(r, CLERK_LOAD_WAIT_MS))]);
      return latest.current.isSignedIn ? latest.current.getToken() : null;
    };
    setAuthTokenGetter(getter);
    setApiTokenGetter(getter);
    setGuestTokenGetter(getGuestToken);
    return () => {
      setAuthTokenGetter(null);
      setApiTokenGetter(null);
      setGuestTokenGetter(null);
    };
  }, []);

  return null;
}
