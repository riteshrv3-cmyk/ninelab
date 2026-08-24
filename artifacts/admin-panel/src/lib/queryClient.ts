import { QueryClient } from "@tanstack/react-query";

const CHANNEL_NAME = "ninelab-sync";

export const queryClient = new QueryClient({
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

export const defaultQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const url = queryKey[0] as string;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};
