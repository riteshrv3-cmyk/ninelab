import { useEffect } from "react";
import { ALL_SUBDOMAINS } from "@/data/domains";

const CACHE_VERSION = "v3";
const BATCH_SIZE = 3;
/**
 * Deliberately far below the server's ai-heavy allowance (30/hour), which this
 * endpoint shares with resume generation, resume import, roadmap generation and
 * pipeline analysis.
 *
 * At 30 a single page load spent the student's entire hourly budget on courses
 * they had not asked for, so the next tap on "Build resume" came back 429 and
 * looked like the app was broken. Speculative work must never crowd out what
 * the student actually requested.
 */
const MAX_PER_SESSION = 6;
const STATUS_KEY = "course_preload_status";

// Module-level singleton — only one preloader runs across the app lifetime
let preloaderStarted = false;

function getCacheKey(subDomainId: string) {
  return `course_content_${CACHE_VERSION}_${subDomainId}`;
}

function getStatusMap(): Record<string, "done" | "error"> {
  try { return JSON.parse(localStorage.getItem(STATUS_KEY) || "{}"); }
  catch { return {}; }
}

function setStatus(id: string, status: "done" | "error") {
  const map = getStatusMap();
  map[id] = status;
  localStorage.setItem(STATUS_KEY, JSON.stringify(map));
}

/** Resolves true when the server asked us to back off, so callers can stop. */
async function generateOne(
  subDomainId: string,
  subDomainName: string,
  domainName: string,
  skills: string[],
): Promise<{ rateLimited: boolean }> {
  const key = getCacheKey(subDomainId);
  if (localStorage.getItem(key)) {
    setStatus(subDomainId, "done");
    return { rateLimited: false };
  }
  try {
    const resp = await fetch("/api/course/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subDomainName, domainName, skills }),
    });
    // A 429 is not a failure of this course — it means we are asking for too
    // much. Leaving the status unset keeps it eligible for a later session;
    // marking it "error" would be wrong, and marking it "done" would lose it.
    if (resp.status === 429) return { rateLimited: true };
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    localStorage.setItem(key, JSON.stringify(data));
    setStatus(subDomainId, "done");
    return { rateLimited: false };
  } catch {
    setStatus(subDomainId, "error");
    return { rateLimited: false };
  }
}

async function runPreloader() {
  if (preloaderStarted) return;
  preloaderStarted = true;

  const statusMap = getStatusMap();

  // Only process subdomains not yet successfully generated
  // Cap per session so we don't hammer the AI endpoint when 100 courses are pending.
  const allPending = ALL_SUBDOMAINS.filter(
    sd => !localStorage.getItem(getCacheKey(sd.id)) && statusMap[sd.id] !== "done"
  );
  const pending = allPending.slice(0, MAX_PER_SESSION);

  if (pending.length === 0) return;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(sd => generateOne(sd.id, sd.name, sd.domain.name, sd.skills))
    );
    // Stop the whole run the moment the server pushes back. Continuing would
    // keep spending a budget the student needs for resumes and roadmaps, and
    // every extra call is guaranteed to fail anyway.
    if (results.some(r => r.rateLimited)) return;
    // Small pause between batches to be kind to the API
    if (i + BATCH_SIZE < pending.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

export function isCourseReady(subDomainId: string): boolean {
  return !!localStorage.getItem(getCacheKey(subDomainId));
}

// Track in-flight prefetches so we never fire the same request twice.
const inflight = new Map<string, Promise<void>>();

/**
 * Eagerly generate (or confirm cached) a single course. Call this the moment
 * the user shows intent — e.g. picks a subdomain on the Opportunities page —
 * so that by the time they click "Prepare" the course loads from localStorage
 * in <1s instead of waiting 5-15s for the AI.
 */
export function prefetchCourse(
  subDomainId: string,
  subDomainName: string,
  domainName: string,
  skills: string[],
): Promise<void> {
  if (localStorage.getItem(getCacheKey(subDomainId))) return Promise.resolve();
  const existing = inflight.get(subDomainId);
  if (existing) return existing;
  const p = generateOne(subDomainId, subDomainName, domainName, skills)
    .then(() => undefined)
    .finally(() => inflight.delete(subDomainId));
  inflight.set(subDomainId, p);
  return p;
}

export function useCoursePreloader() {
  useEffect(() => {
    // Defer start so the page renders first
    const t = setTimeout(() => { runPreloader(); }, 1500);
    return () => clearTimeout(t);
  }, []);
}
