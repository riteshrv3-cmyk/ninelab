import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setAuthTokenGetter, setGuestTokenGetter } from "@workspace/api-client-react";
import { setApiTokenGetter, getGuestToken } from "@/lib/api/authFetch";

/**
 * Registers Clerk's getToken into both fetch layers (the generated react-query hooks'
 * custom-fetch, and the hand-written apiFetch used by pages with raw fetch calls) so
 * every API call carries the signed-in bearer token — or, when signed out, the guest
 * token from localStorage. Mount once, above the router.
 */
export function AuthBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    const getter = async () => (isSignedIn ? getToken() : null);
    setAuthTokenGetter(getter);
    setApiTokenGetter(getter);
    setGuestTokenGetter(getGuestToken);
    return () => {
      setAuthTokenGetter(null);
      setApiTokenGetter(null);
      setGuestTokenGetter(null);
    };
  }, [getToken, isSignedIn]);

  return null;
}
