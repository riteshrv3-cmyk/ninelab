import { getGuestToken } from "@/lib/api/authFetch";

/**
 * True when the current visitor is an unclaimed guest session — has a
 * guest token and no Clerk session. Cheap: works on any page without an
 * extra fetch, unlike the full-profile-based `isGuest` check on the
 * Profile page (which also has to catch RoleSelect's placeholder
 * `name: "Student"` rows by their `guest_<uuid>@…` server-assigned email).
 */
export function isGuestSession(isLoaded: boolean, isSignedIn: boolean | undefined): boolean {
  return isLoaded && !isSignedIn && !!getGuestToken();
}
