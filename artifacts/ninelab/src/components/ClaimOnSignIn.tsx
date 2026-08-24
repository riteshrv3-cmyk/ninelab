import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { apiFetch, setGuestToken } from "@/lib/api/authFetch";

// Renders nothing. Mounted on the explore home ("/"), it runs the account-claim
// handshake whenever a signed-in Clerk user lands there — adopting their guest
// row (or creating a fresh claimed one) exactly as the old RoleSelectRedirect
// did. Difference from before: there is no onboarding wizard to send new users
// to, so a freshly-created account STAYS on "/" (the explore home in real
// mode); returning users are sent to their resume.
export function ClaimOnSignIn() {
  const [, setLocation] = useLocation();
  const { isSignedIn, user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    let alive = true;

    const studentId = localStorage.getItem("studentId");
    const guestToken = localStorage.getItem("guestToken");

    apiFetch("/api/auth/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        studentId: studentId ? Number(studentId) : undefined,
        guestToken: guestToken ?? undefined,
      }),
    })
      .then((r) => r.json())
      .then(
        async (data: {
          student: { id: number };
          claimed: boolean;
          created: boolean;
        }) => {
          if (!alive) return;
          localStorage.setItem("studentId", String(data.student.id));
          localStorage.setItem("clerkUserId", user.id);
          if (user.primaryEmailAddress?.emailAddress) {
            localStorage.setItem(
              "clerkEmail",
              user.primaryEmailAddress.emailAddress,
            );
          }
          setGuestToken(null); // claimed rows never carry a guest token again

          // Claim a pending college invite for users who signed up directly
          // (no guest row, so the NameGate never ran).
          const inviteCode = sessionStorage.getItem("inviteCode");
          if (inviteCode) {
            try {
              await apiFetch(`/api/invite/${inviteCode}/claim`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ studentId: data.student.id }),
              });
            } catch {
              /* best-effort */
            }
            sessionStorage.removeItem("inviteCode");
            sessionStorage.removeItem("inviteCollegeName");
            sessionStorage.removeItem("inviteCollegeCity");
          }

          // New account: stay on the explore home (now in real mode). Returning
          // user: jump to their resume.
          if (!data.created) setLocation("/resume");
        },
      )
      .catch(() => {
        /* leave them on the explore home; they can navigate manually */
      });

    return () => {
      alive = false;
    };
  }, [isLoaded, isSignedIn, user, setLocation]);

  return null;
}
