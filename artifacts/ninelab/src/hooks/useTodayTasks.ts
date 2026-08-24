import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/authFetch";

export interface TodayTask {
  id: string;
  label: string;
  sublabel?: string;
  done: boolean;
  hot?: boolean;
  ctaLabel?: string;
  href: string;
  /** Manual tasks can be toggled by the student; auto tasks derive `done` from real data. */
  manual?: boolean;
}

interface ServerTask {
  id: string;
  label: string;
  sublabel?: string;
  done: boolean;
  hot: boolean;
  ctaLabel?: string;
  href: string;
  manual: boolean;
}

export interface KitNoticing {
  text: string;
  href: string;
}

interface TodayTasksData {
  tasks: TodayTask[];
  streakCount: number;
  xp: number;
  level: number;
  noticing: KitNoticing | null;
}

interface UseTodayTasksInput {
  studentId: string | null;
}

/**
 * Fetches the day's server-generated tasks (rules R1-R7 in lib/dailyTasks.ts on the
 * API server), the honest server-computed streak, and xp/level. React-query gives
 * this a shared cache with AppLayout/TopBar's streak chip (same queryKey shape as
 * useStudentProfile — student-scoped), proper loading/error flags, and automatic
 * refetch-on-window-focus so the streak stays current across tabs.
 */
export function useTodayTasks({ studentId }: UseTodayTasksInput) {
  const queryClient = useQueryClient();
  const queryKey = ["today-tasks", studentId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<TodayTasksData> => {
      const res = await apiFetch(`/api/students/${studentId}/today-tasks`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { tasks: ServerTask[]; streakCount: number; xp?: number; level?: number; noticing: KitNoticing | null } =
        await res.json();
      return {
        tasks: data.tasks,
        streakCount: data.streakCount,
        xp: data.xp ?? 0,
        level: data.level ?? 1,
        noticing: data.noticing ?? null,
      };
    },
    enabled: !!studentId,
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = query.data?.tasks.find((t) => t.id === id);
      if (!current) throw new Error("Task not found");
      const nextDone = !current.done;
      const res = await apiFetch(`/api/students/${studentId}/tasks/${id}/${nextDone ? "complete" : "uncomplete"}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { streakCount: number; xp: number; level: number } = await res.json();
      return { id, nextDone, ...data };
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TodayTasksData>(queryKey);
      if (previous) {
        queryClient.setQueryData<TodayTasksData>(queryKey, {
          ...previous,
          tasks: previous.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: ({ streakCount, xp, level }) => {
      queryClient.setQueryData<TodayTasksData>(queryKey, (prev) => (prev ? { ...prev, streakCount, xp, level } : prev));
    },
  });

  return {
    tasks: query.data?.tasks ?? [],
    streakCount: query.data?.streakCount ?? 0,
    xp: query.data?.xp ?? 0,
    level: query.data?.level ?? 1,
    noticing: query.data?.noticing ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    toggleManual: (id: string) => toggleMutation.mutate(id),
    lastToggle: toggleMutation.data,
  };
}
