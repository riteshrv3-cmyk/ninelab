import { Component, type ErrorInfo, type ReactNode } from "react";

const RELOAD_FLAG = "kt:chunk-reload";

/** A lazy page whose file no longer exists (the app was updated under us). */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Failed to fetch dynamically/i.test(msg);
}

/** Reload once to pick up the new build; a second failure shows the screen. */
export function reloadOnceForNewBuild(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Clears the one-reload guard once the app has rendered cleanly. */
export function clearReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* storage blocked */
  }
}

interface State {
  failed: boolean;
}

/**
 * Last line of defence. Without it any render error (an unexpected API shape,
 * a missing lazy chunk after a deploy) unmounted the whole tree and left the
 * student on a blank white screen with no way forward.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed", error, info.componentStack);
    if (isChunkLoadError(error)) reloadOnceForNewBuild();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-display text-xl font-extrabold text-ink mb-2">Something went wrong</h1>
        <p className="text-sm text-ink-muted mb-6 max-w-xs">
          This screen hit a problem. Reloading usually fixes it, and nothing you saved is lost.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-brand text-paper font-bold rounded-xl px-6 py-3"
        >
          Reload ninelab
        </button>
      </div>
    );
  }
}
