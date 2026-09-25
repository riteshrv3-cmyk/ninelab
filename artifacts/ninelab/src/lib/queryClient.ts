import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { isOutageError, markServerDown, onServerBack } from "@/lib/serverStatus";

const CHANNEL_NAME = "ninelab-sync";

// Generated hooks don't go through apiFetch; catch an unreachable server here.
function noteOutage(err: unknown) {
  const status = (err as { status?: unknown } | null)?.status;
  if (isOutageError(err) || status === 502 || status === 503 || status === 504) markServerDown();
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: noteOutage }),
  mutationCache: new MutationCache({ onError: noteOutage }),
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
      refetchOnMount: "always",
      retry: 1,
    },
    mutations: {
      retry: 0,
      onSuccess: () => {
        broadcastSync();
        queryClient.invalidateQueries();
      },
    },
  },
});

// Screens that failed during an outage reload their data once it's back.
if (typeof window !== "undefined") onServerBack(() => void queryClient.invalidateQueries());

let channel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (e) => {
    if (e.data?.type === "invalidate") {
      queryClient.invalidateQueries();
    }
  };
}

export function broadcastSync() {
  channel?.postMessage({ type: "invalidate", at: Date.now() });
}

export async function syncFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  const method = (init?.method ?? "GET").toUpperCase();
  if (res.ok && method !== "GET" && method !== "HEAD") {
    broadcastSync();
    queryClient.invalidateQueries();
  }
  return res;
}
