import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ShieldCheck, ShieldAlert, Loader2, ChevronRight, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api/authFetch";
import { cn } from "@/lib/utils";

interface Application {
  id: number;
  company: string | null;
  role: string | null;
  rawText: string | null;
  ctc: string | null;
  applyLink: string | null;
  scamScore: number | null;
  scamVerdict: "safe" | "risky" | "scam" | null;
  scamReasons: string[] | null;
  gates: Record<string, { open: boolean; label: string }> | null;
  gatesOpen: number | null;
  gatesTotal: number | null;
  fitScore: number | null;
  fitSummary: string | null;
  have: string[] | null;
  missing: string[] | null;
  suggestedPrep: Array<{ title: string; hours: number; action: string }> | null;
  status: string;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: "viewed", label: "Viewed" },
  { value: "clicked_apply", label: "Applied" },
  { value: "heard_back", label: "Heard back" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
] as const;

const VERDICT_STYLE: Record<string, { icon: typeof ShieldCheck; label: string; className: string }> = {
  safe: { icon: ShieldCheck, label: "Looks safe", className: "bg-done/10 text-done" },
  risky: { icon: ShieldAlert, label: "Looks risky", className: "bg-brand-soft text-brand" },
  scam: { icon: AlertTriangle, label: "Likely a scam", className: "bg-danger/10 text-danger" },
};

function tailorResumeFor(app: Application, setLocation: (path: string) => void) {
  sessionStorage.setItem("resumeContext", JSON.stringify({
    role: app.role ?? "",
    tags: [],
    name: app.company ? `${app.company}${app.role ? ` — ${app.role}` : ""}` : "",
  }));
  setLocation("/resume");
}

export default function Pipeline() {
  const [, setLocation] = useLocation();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Application | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [addedPrep, setAddedPrep] = useState<Set<number>>(new Set());
  const reduced = useReducedMotion();

  useEffect(() => {
    const id = localStorage.getItem("studentId");
    if (!id) {
      setLocation("/");
      return;
    }
    setStudentId(id);
    loadApplications(id);
  }, [setLocation]);

  async function loadApplications(id: string) {
    try {
      const res = await apiFetch(`/api/students/${id}/applications`);
      if (res.ok) setApplications(await res.json());
    } catch {
      // Tracked list is a nice-to-have; a failed load shouldn't block the analyzer.
    }
  }

  async function analyze() {
    if (!studentId || rawText.trim().length < 5) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/students/${studentId}/pipeline/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawText.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't analyze this. Try again.");
      }
      const data: Application = await res.json();
      setResult(data);
      setApplications((prev) => [data, ...prev]);
      setRawText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setAnalyzing(false);
    }
  }

  async function addPrepToTomorrow(item: { title: string; hours: number; action: string }) {
    if (!studentId) return;
    try {
      const res = await apiFetch(`/api/students/${studentId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: item.title, sublabel: item.action, href: "/practice" }),
      });
      if (res.ok) setAddedPrep((prev) => new Set(prev).add(item.hours * 1000 + item.title.length));
    } catch {
      // Non-critical — student can still act on the prep item manually.
    }
  }

  async function updateStatus(appId: number, status: string) {
    if (!studentId) return;
    setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
    try {
      await apiFetch(`/api/students/${studentId}/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      // Optimistic update stands; a retry on next visit will reconcile via loadApplications.
    }
  }

  return (
    <div className="min-h-screen bg-canvas pb-24">
      <div className="bg-brand px-6 pt-8 pb-14">
        {/* Same clamp as the sheet below. Without it the canopy title sat at
            the canopy's own left edge while the card it heads was centred at
            2xl — a 144px gap between a heading and its content on desktop. */}
        <div className="lg:max-w-2xl lg:mx-auto">
          <h1 className="text-display text-[30px] lg:text-[36px] font-extrabold text-white leading-[1.06] tracking-tight">Pipeline</h1>
          <p className="text-[13px] text-white/70 mt-1">
            Paste any job posting or placement drive — scam check, eligibility, and fit, in one shot.
          </p>
        </div>
      </div>

      <div className="bg-paper rounded-t-3xl -mt-6 px-6 pt-6 pb-6 shadow-soft">
        <div className="lg:max-w-2xl lg:mx-auto">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the job description or drive message here…"
            rows={6}
            className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand resize-none"
          />
          {error && <p className="text-[12px] text-danger mt-2">{error}</p>}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={analyze}
            disabled={analyzing || rawText.trim().length < 5}
            className="mt-3 w-full bg-brand text-white text-[14px] font-bold rounded-full py-3.5 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {analyzing ? "Analyzing…" : "Analyze"}
          </motion.button>

          <button onClick={() => setLocation("/drive-check")} className="mt-2 text-[12px] text-ink-muted underline">
            Just want a quick scam check? Use Drive Check
          </button>
        </div>
      </div>

      <div className="px-6">
      {result && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mt-6 bg-paper rounded-2xl shadow-soft p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-bold text-ink">
              {result.company ?? "Unknown company"}{result.role ? ` · ${result.role}` : ""}
            </p>
            {result.scamVerdict && (
              <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1", VERDICT_STYLE[result.scamVerdict].className)}>
                {VERDICT_STYLE[result.scamVerdict].label}
              </span>
            )}
          </div>

          {result.scamReasons && result.scamReasons.length > 0 && (
            <ul className="mb-4 space-y-1">
              {result.scamReasons.map((r, i) => (
                <li key={i} className="text-[12px] text-ink-muted">• {r}</li>
              ))}
            </ul>
          )}

          {result.gates && Object.keys(result.gates).length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">
                Eligibility {result.gatesOpen}/{result.gatesTotal}
              </p>
              <div className="space-y-1.5">
                {Object.entries(result.gates).map(([key, gate]) => (
                  <div key={key} className="flex items-center gap-2 text-[12px]">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", gate.open ? "bg-done" : "bg-danger")} />
                    <span className="text-ink">{gate.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.fitScore !== null && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                Fit score: {result.fitScore}/100
              </p>
              {result.fitSummary && <p className="text-[13px] text-ink">{result.fitSummary}</p>}
              {result.have && result.have.length > 0 && (
                <p className="text-[12px] text-ink-muted mt-1">Have: {result.have.join(", ")}</p>
              )}
              {result.missing && result.missing.length > 0 && (
                <p className="text-[12px] text-ink-muted mt-0.5">Missing: {result.missing.join(", ")}</p>
              )}
            </div>
          )}

          {result.suggestedPrep && result.suggestedPrep.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">Suggested prep</p>
              {result.suggestedPrep.map((item, i) => {
                const key = item.hours * 1000 + item.title.length;
                return (
                  <div key={i} className="flex items-center justify-between gap-2 py-2 border-t border-line first:border-t-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{item.title}</p>
                      <p className="text-[11px] text-ink-muted">{item.hours}h · {item.action}</p>
                    </div>
                    <button
                      onClick={() => addPrepToTomorrow(item)}
                      disabled={addedPrep.has(key)}
                      className="shrink-0 text-[11px] font-bold text-brand disabled:text-ink-muted"
                    >
                      {addedPrep.has(key) ? "Added ✓" : "Add to tomorrow"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {applications.length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-3">Tracked ({applications.length})</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            {applications.map((app, i) => (
              <motion.div
                key={app.id}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
                className="bg-paper rounded-2xl shadow-soft p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[14px] font-semibold text-ink truncate">
                    {app.company ?? "Unknown"}{app.role ? ` · ${app.role}` : ""}
                  </p>
                  <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={app.status}
                    onChange={(e) => updateStatus(app.id, e.target.value)}
                    className="text-[12px] font-semibold text-brand bg-brand-soft rounded-lg px-2 py-1 border-0 focus:outline-none"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => tailorResumeFor(app, setLocation)}
                    className="shrink-0 flex items-center gap-1 text-[12px] font-bold text-brand"
                  >
                    <FileText className="w-3.5 h-3.5" /> Tailor resume
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
