import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/authFetch";

export interface StudentProfile {
  id: number;
  name: string;
  field: string;
  year: number;
  targetRole: string | null;
  targetBatch: number | null;
  skills: Record<string, number>;
  xp?: number;
  level?: number;
  streakCount?: number;
}

/**
 * Shared query for GET /api/students/:id/full-profile. Home and AppLayout both
 * need this on every page load — routing them through react-query (same
 * queryKey) means concurrent mounts share one in-flight request instead of
 * firing a duplicate fetch each.
 */
export function useStudentProfile(studentId: string | null) {
  return useQuery({
    queryKey: ["student-full-profile", studentId],
    queryFn: async (): Promise<StudentProfile> => {
      const res = await apiFetch(`/api/students/${studentId}/full-profile`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!studentId,
  });
}
