import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/authFetch";

export interface MeRole {
  role: "college_admin" | "student" | "none";
  collegeId?: number;
  collegeName?: string | null;
}

/**
 * The signed-in user's role. Only fetched where needed (the /tpo gate), so it
 * adds no request to normal student loads. Also performs the one-time
 * email->clerkUserId binding for allowlisted college admins server-side.
 */
export function useMeRole(enabled: boolean) {
  return useQuery({
    queryKey: ["me-role"],
    queryFn: async (): Promise<MeRole> => {
      const res = await apiFetch(`/api/me/role`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });
}
