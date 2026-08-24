import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/authFetch";

export interface TrackMilestone {
  id: number;
  position: number;
  kind: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
  completedAt: string | null;
}

export interface ReadinessBreakdown {
  profile: number;
  skills: number;
  track: number;
  mocks: number;
}

export interface StudentTrackData {
  track: { id: number; name: string; description: string } | null;
  milestones: TrackMilestone[];
  done: number;
  total: number;
  status: string;
  readiness: { score: number; breakdown: ReadinessBreakdown };
}

/**
 * The student's learning track + readiness. Shares the "track" queryKey with
 * the Home TrackCard so both render from one fetch. The server self-heals
 * milestone completion on this read, so it always reflects real progress.
 */
export function useStudentTrack(studentId: string | null) {
  return useQuery({
    queryKey: ["student-track", studentId],
    queryFn: async (): Promise<StudentTrackData> => {
      const res = await apiFetch(`/api/students/${studentId}/track`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!studentId,
  });
}
