import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchJson } from "@/lib/api/authFetch";

export interface TpoStudentRow {
  id: number;
  name: string;
  email: string;
  year: number;
  field: string;
  targetRole: string | null;
  readinessScore: number;
  profileStrength: number;
  milestonesDone: number;
  milestonesTotal: number;
  mockCount: number;
  lastActiveDate: string | null;
  streakCount: number;
}

export interface TpoDashboard {
  college: { id: number; name: string; city: string; inviteCode: string; signupCount: number } | null;
  stats: { studentCount: number; avgReadiness: number; readyCount: number; activeToday: number };
  distribution: { red: number; amber: number; green: number };
  students: TpoStudentRow[];
}

export interface TpoMilestone {
  id: number;
  position: number;
  kind: string;
  title: string;
  description: string;
  config: Record<string, unknown>;
}

export interface TpoTrack {
  track: { id: number; name: string; description: string } | null;
  milestones: TpoMilestone[];
}

export interface TrackTemplate {
  templateKey: string;
  name: string;
  description: string;
  milestones: { kind: string; title: string; description?: string; config?: Record<string, unknown> }[];
}

export interface TpoTrackEditorData {
  track: TpoTrack | null;
  templates: TrackTemplate[];
  milestoneKinds: string[];
}

export function useTpoDashboard() {
  return useQuery({
    queryKey: ["tpo-dashboard"],
    queryFn: () => apiFetchJson<TpoDashboard>(`/api/college-admin/dashboard`),
  });
}

export interface TpoStudentMilestone {
  id: number;
  position: number;
  kind: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
  completedAt: string | null;
}

export interface TpoStudentDetail {
  student: {
    id: number; name: string; email: string; year: number; field: string;
    targetRole: string | null; readinessScore: number; profileStrength: number;
    streakCount: number; lastActiveDate: string | null;
  };
  readiness: { score: number; breakdown: { profile: number; skills: number; track: number; mocks: number } };
  track: {
    track: { id: number; name: string; description: string } | null;
    milestones: TpoStudentMilestone[];
    done: number;
    total: number;
    status: string;
  };
  mockHistory: { id: number; company: string; overallScore: number; createdAt: string }[];
}

export function useTpoStudent(id: string | number | null) {
  return useQuery({
    queryKey: ["tpo-student", String(id)],
    queryFn: () => apiFetchJson<TpoStudentDetail>(`/api/college-admin/students/${id}`),
    enabled: id != null,
  });
}

export function useTpoTrackEditor() {
  return useQuery({
    queryKey: ["tpo-track"],
    queryFn: () => apiFetchJson<TpoTrackEditorData>(`/api/college-admin/track`),
  });
}

export function useTpoTrackMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tpo-track"] });
    qc.invalidateQueries({ queryKey: ["tpo-dashboard"] });
  };

  const create = useMutation({
    mutationFn: (body: { templateKey?: string; name?: string }) =>
      apiFetchJson(`/api/college-admin/track`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const save = useMutation({
    mutationFn: (body: { name: string; description: string; milestones: { id?: number; kind: string; title: string; description?: string; config?: Record<string, unknown> }[] }) =>
      apiFetchJson(`/api/college-admin/track`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  return { create, save };
}

export { apiFetch };
