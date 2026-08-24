import { useSyncExternalStore } from "react";

// Single source of truth for "is there a student yet?" across the app.
//
// A student row (guest or claimed) is identified by localStorage.studentId.
// Anonymous explore-mode visitors have none → `isDemo` is true and pages render
// the sample-student fixtures instead of calling authed endpoints. The moment
// the NameGate creates a guest row it dispatches `kt:student-changed`, and every
// component using this hook re-renders into real mode WITHOUT a full reload.

export const STUDENT_CHANGED_EVENT = "kt:student-changed";

/** Call after writing/removing localStorage.studentId to flip the whole app. */
export function notifyStudentChanged(): void {
  window.dispatchEvent(new Event(STUDENT_CHANGED_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(STUDENT_CHANGED_EVENT, onChange);
  // Cross-tab: a sign-in/guest-create in another tab should propagate too.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STUDENT_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): string | null {
  return localStorage.getItem("studentId");
}

export interface StudentIdState {
  studentId: number | null;
  studentIdRaw: string | null;
  isDemo: boolean;
}

/**
 * `isDemo` is true for anonymous visitors (no studentId). Reads from
 * localStorage and stays in sync with `kt:student-changed` + cross-tab storage
 * events, so a demo→real transition needs no reload.
 */
export function useStudentId(): StudentIdState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const parsed = raw != null ? Number(raw) : NaN;
  const studentId = Number.isFinite(parsed) ? parsed : null;
  return { studentId, studentIdRaw: raw, isDemo: studentId === null };
}
