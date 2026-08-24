import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ShieldCheck, AlertTriangle, ShieldAlert, Download, ChevronRight, ArrowLeft, Clipboard, TrendingUp, CheckCircle2, XCircle, Award, Phone, Ghost, Megaphone } from "lucide-react";
import { toPng, toBlob } from "html-to-image";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api/authFetch";

interface Gate { open: boolean; label: string; }
interface CompanyStats {
  total: number;
  applied?: number;
  called?: number;
  ghosted?: number;
  rejected?: number;
  offer?: number;
  ghostRate: number | null;
  callRate: number | null;
  offerRate: number | null;
}
type Outcome = "pending" | "applied" | "called" | "ghosted" | "rejected" | "offer" | "skipped";
interface DriveCheckRow {
  id: number;
  studentId: number;
  rawText: string;
  company: string | null;
  role: string | null;
  ctc: string | null;
  batch: string | null;
  branches: string[];
  cgpaCutoff: string | null;
  applyLink: string | null;
  scamScore: number;
  scamVerdict: "safe" | "risky" | "scam";
  scamReasons: string[];
  eligibility: Record<string, Gate>;
  gatesOpen: number;
  gatesTotal: number;
  kodeScoreFit: number;
  tpoMatch: string;
  outcome: Outcome;
  appliedAt: string | null;
  outcomeAt: string | null;
  nextPingAt: string | null;
  sharedCount: number;
  createdAt: string;
  companyStats?: CompanyStats | null;
  tpoMatchedDrive?: {
    id: number;
    company: string;
    role: string | null;
    ctc: string | null;
    batch: string | null;
    branches: string[];
    cgpaCutoff: string | null;
    applyLink: string | null;
    notes: string | null;
    driveDate: string | null;
    postedByName: string;
    createdAt: string;
  } | null;
}

const VERDICT_STYLE: Record<string, { icon: typeof ShieldCheck; label: string; className: string }> = {
  safe: { icon: ShieldCheck, label: "Looks safe", className: "bg-done/10 text-done" },
  risky: { icon: ShieldAlert, label: "Looks risky", className: "bg-[#F59E0B]/10 text-[#B45309]" },
  scam: { icon: AlertTriangle, label: "Likely a scam", className: "bg-danger/10 text-danger" },
};

const VERDICT_SUB: Record<string, string> = {
  safe: "Legit signals match. Tu eligible bhi hai? Niche dekh.",
  risky: "Kuch signals iffy hain. Apply karne se pehle source verify kar.",
  scam: "Lagta hai paisa nikalne wala scam hai. Group mein warn kar.",
};

const outcomeBtnClass = (active: boolean) =>
  `text-[11px] font-bold px-2.5 py-2 rounded-xl border active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5 ${
    active ? "bg-brand text-white border-brand" : "border-line text-ink"
  }`;

function GhostRateBadge({ stats }: { stats: CompanyStats }) {
  if (!stats || stats.total === 0) return null;
  const decided =
    (stats.called ?? 0) + (stats.ghosted ?? 0) + (stats.rejected ?? 0) + (stats.offer ?? 0);
  if (decided === 0) {
    return (
      <div className="rounded-2xl p-3 bg-canvas flex items-center gap-2.5">
        <TrendingUp className="w-4 h-4 text-ink-muted shrink-0" />
        <p className="text-[12px] text-ink-muted leading-snug">
          {stats.applied ?? 0} ninelab users applied here. No outcomes reported yet.
        </p>
      </div>
    );
  }
  const ghostRate = stats.ghostRate ?? 0;
  const callRate = stats.callRate ?? 0;
  const offerRate = stats.offerRate ?? 0;

  return (
    <div className="rounded-2xl p-3.5 bg-canvas">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          Real outcomes from ninelab users
        </p>
        <span className="text-[11px] font-bold text-ink-muted">n={decided}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-[18px] font-extrabold text-ink">{ghostRate}%</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Ghosted</p>
        </div>
        <div className="text-center">
          <p className="text-[18px] font-extrabold text-ink">{callRate}%</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Got Call</p>
        </div>
        <div className="text-center">
          <p className="text-[18px] font-extrabold text-ink">{offerRate}%</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Offer</p>
        </div>
      </div>
    </div>
  );
}

function VerdictCard({ row, studentName, college, kodeScore }: {
  row: DriveCheckRow;
  studentName: string;
  college: string;
  kodeScore: number;
}) {
  const v = VERDICT_STYLE[row.scamVerdict] ?? VERDICT_STYLE.risky;
  const Icon = v.icon;
  const sub = VERDICT_SUB[row.scamVerdict] ?? VERDICT_SUB.risky;
  const gates = Object.entries(row.eligibility ?? {});

  return (
    <div className="bg-paper rounded-2xl overflow-hidden shadow-soft">
      {/* Header strip */}
      <div className="px-5 pt-4 pb-4 border-b border-line">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          <span>{studentName} · {college.split(",")[0].slice(0, 22)}</span>
          <span>KodeScore {kodeScore}</span>
        </div>
        <div className={`mt-3 flex items-start gap-3 rounded-xl px-3.5 py-3 ${v.className}`}>
          <Icon className="w-6 h-6 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Verdict</p>
            <h2 className="text-display text-[18px] font-extrabold leading-tight mt-0.5">{v.label}</h2>
            <p className="text-[12px] mt-0.5 opacity-90 leading-snug">{sub}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Company / role / ctc */}
        {(row.company || row.role || row.ctc) && (
          <div className="flex flex-wrap gap-1.5">
            {row.company && (
              <span className="text-[11px] font-bold bg-brand text-white px-2.5 py-1 rounded-full">{row.company}</span>
            )}
            {row.role && (
              <span className="text-[11px] font-bold bg-brand-soft text-brand px-2.5 py-1 rounded-full">{row.role}</span>
            )}
            {row.ctc && (
              <span className="text-[11px] font-bold bg-brand-soft text-brand px-2.5 py-1 rounded-full">{row.ctc}</span>
            )}
            {row.batch && (
              <span className="text-[11px] font-bold bg-canvas text-ink-muted px-2.5 py-1 rounded-full">{row.batch}</span>
            )}
          </div>
        )}

        {/* Scam reasons */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Scam Score</p>
            <span className="text-[11px] font-bold bg-brand-soft text-brand px-2 py-0.5 rounded-full">{row.scamScore}/100</span>
          </div>
          <div className="space-y-1.5">
            {row.scamReasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] text-ink-muted">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-ink-muted shrink-0" />
                <span className="leading-snug">{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Eligibility */}
        {gates.length > 0 && (
          <div className="rounded-2xl p-3.5 bg-canvas">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Tu eligible hai?</p>
              <span className="text-[11px] font-bold text-ink">
                {row.gatesOpen}/{row.gatesTotal} gates open · KodeScore fit {row.kodeScoreFit}
              </span>
            </div>
            <div className="space-y-2">
              {gates.map(([key, g]) => (
                <div key={key} className="flex items-center gap-2 text-[12px]">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${g.open ? "bg-done" : "bg-danger"}`} />
                  <span className="flex-1 text-[12px] text-ink">{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ghost rate badge */}
        {row.companyStats && row.companyStats.total > 0 && (
          <GhostRateBadge stats={row.companyStats} />
        )}

        {/* TPO match badge */}
        {row.tpoMatch === "matched" ? (
          <div className="rounded-2xl p-3.5 bg-canvas">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-done shrink-0" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink">
                Verified by your TPO
              </p>
            </div>
            <p className="text-[12px] text-ink-muted leading-snug">
              {row.tpoMatchedDrive?.postedByName ?? "Your TPO"} officially shared this drive
              {row.tpoMatchedDrive?.createdAt
                ? ` on ${new Date(row.tpoMatchedDrive.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                : ""}.
            </p>
            {row.tpoMatchedDrive && (row.tpoMatchedDrive.role || row.tpoMatchedDrive.ctc || row.tpoMatchedDrive.driveDate) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {row.tpoMatchedDrive.role && (
                  <span className="text-[11px] font-bold bg-paper text-ink-muted px-2 py-0.5 rounded-full">{row.tpoMatchedDrive.role}</span>
                )}
                {row.tpoMatchedDrive.ctc && (
                  <span className="text-[11px] font-bold bg-paper text-ink-muted px-2 py-0.5 rounded-full">{row.tpoMatchedDrive.ctc}</span>
                )}
                {row.tpoMatchedDrive.driveDate && (
                  <span className="text-[11px] font-bold bg-paper text-ink-muted px-2 py-0.5 rounded-full">
                    {new Date(row.tpoMatchedDrive.driveDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : row.tpoMatch === "not_matched" ? (
          <div className="rounded-2xl p-3 bg-canvas flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" />
            <p className="text-[12px] text-ink-muted leading-snug">
              Your TPO has <span className="font-bold text-ink">NOT</span> shared this drive. Verify the source before applying.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[12px] text-ink-muted">
            <span>Your TPO hasn't posted any drives recently — can't cross-check.</span>
          </div>
        )}
      </div>

      {/* Footer watermark */}
      <div className="px-5 py-2.5 flex items-center justify-between border-t border-line">
        <span className="text-[10px] font-bold text-brand tracking-wider uppercase">ninelab · Drive Check</span>
        <span className="text-[10px] text-ink-muted">Paste any drive · 60s verdict</span>
      </div>
    </div>
  );
}

export default function DriveCheck() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("there");
  const [college, setCollege] = useState("");
  const [kodeScore, setKodeScore] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<DriveCheckRow | null>(null);
  const [recent, setRecent] = useState<DriveCheckRow[]>([]);
  const [pendingPings, setPendingPings] = useState<DriveCheckRow[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const refreshPendingPings = (id: string) => {
    apiFetch(`/api/students/${id}/pending-pings`)
      .then((r) => r.json())
      .then((rows) => Array.isArray(rows) && setPendingPings(rows))
      .catch(() => {});
  };

  useEffect(() => {
    const id = localStorage.getItem("studentId");
    if (!id) { setLocation("/"); return; }
    setStudentId(id);
    apiFetch(`/api/students/${id}/full-profile`)
      .then((r) => r.json())
      .then((p) => {
        setStudentName(p.name?.split(" ")[0] ?? "there");
        setCollege(p.college ?? "");
        setKodeScore(Math.round(p.overallScore ?? 0));
      })
      .catch(() => {});
    apiFetch(`/api/students/${id}/drive-checks`)
      .then((r) => r.json())
      .then((rows) => Array.isArray(rows) && setRecent(rows))
      .catch(() => {});
    refreshPendingPings(id);
  }, [setLocation]);

  const fetchCompanyStats = async (company: string): Promise<CompanyStats | null> => {
    try {
      const r = await apiFetch(`/api/drive-checks/company-stats?company=${encodeURIComponent(company)}`);
      return await r.json();
    } catch {
      return null;
    }
  };

  const markApplied = async (row: DriveCheckRow) => {
    if (!studentId || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/students/${studentId}/drive-checks/${row.id}/applied`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json() as DriveCheckRow;
      const stats = row.company ? await fetchCompanyStats(row.company) : null;
      const merged = { ...row, ...updated, companyStats: stats };
      setVerdict((v) => (v?.id === row.id ? merged : v));
      setRecent((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      if (row.applyLink) window.open(row.applyLink, "_blank", "noopener,noreferrer");
      toast({ title: "Marked applied!", description: "We'll ping you in 7 days for the outcome 🎯" });
    } catch {
      toast({ title: "Couldn't update", description: "Try again", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const setOutcome = async (row: DriveCheckRow, outcome: "called" | "ghosted" | "rejected" | "offer" | "skipped") => {
    if (!studentId || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/students/${studentId}/drive-checks/${row.id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json() as DriveCheckRow;
      const stats = row.company ? await fetchCompanyStats(row.company) : null;
      const merged = { ...row, ...updated, companyStats: stats };
      setVerdict((v) => (v?.id === row.id ? merged : v));
      setRecent((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      setPendingPings((prev) => prev.filter((p) => p.id !== row.id));
      const labels: Record<string, string> = {
        called: "Got call recorded 📞", ghosted: "Ghost noted 👻",
        rejected: "Rejection noted", offer: "OFFER 🎉 mast!", skipped: "Skipped",
      };
      toast({ title: labels[outcome] ?? "Saved", description: "Thanks — this helps the next student." });
    } catch {
      toast({ title: "Couldn't update", description: "Try again", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const checkDrive = async () => {
    if (!text.trim() || loading || !studentId) return;
    setLoading(true);
    setVerdict(null);
    try {
      const res = await apiFetch(`/api/students/${studentId}/drive-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      const data = await res.json() as DriveCheckRow;
      setVerdict(data);
      setRecent((prev) => [data, ...prev].slice(0, 10));
      setTimeout(() => {
        document.getElementById("verdict-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      toast({ title: "Couldn't check", description: (e as Error).message ?? "Try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText(t);
    } catch {
      toast({ title: "Clipboard blocked", description: "Paste manually instead." });
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        // The Plus Jakarta Sans stylesheet is loaded cross-origin from Google
        // Fonts, so html-to-image cannot read its cssRules and hangs trying.
        // The card renders fine in the system fallback face.
        skipFonts: true,
      });
      const link = document.createElement("a");
      link.download = `drive-check-${verdict?.company ?? "verdict"}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Saved!", description: "Share kar de drive group mein 🚀" });
    } catch {
      toast({ title: "Download failed", description: "Try screenshot instead.", variant: "destructive" });
    }
  };

  const buildWarningMessage = (r: DriveCheckRow): string => {
    const co = r.company ?? "Yeh drive";
    const reasons = (r.scamReasons ?? []).slice(0, 3).map((x) => `• ${x}`).join("\n");
    return `🚩 SCAM ALERT — ${co}${r.role ? ` (${r.role})` : ""}\n\nninelab Drive Check ne flag kiya — Scam Score ${r.scamScore}/100.\n\n${reasons}\n\nMat apply karna, aur kisi ko paisa mat dena. Verify on company's official careers page first.\n\nChecked via ninelab Drive Check 🛡️`;
  };

  const recordShare = async (r: DriveCheckRow) => {
    try {
      const res = await apiFetch(`/api/drive-checks/${r.id}/shared`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as { id: number; sharedCount: number };
      setVerdict((cur) => (cur && cur.id === data.id ? { ...cur, sharedCount: data.sharedCount } : cur));
      setRecent((prev) => prev.map((x) => (x.id === data.id ? { ...x, sharedCount: data.sharedCount } : x)));
    } catch {
      /* non-fatal */
    }
  };

  const warnTheGroup = async (platform: "whatsapp" | "telegram") => {
    if (!verdict || !cardRef.current) return;
    const message = buildWarningMessage(verdict);

    let pngFile: File | null = null;
    try {
      const blob = await toBlob(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true, // see downloadCard — cross-origin font CSS hangs the export
      });
      if (blob) {
        pngFile = new File([blob], `scam-warning-${verdict.company ?? "drive"}.png`, { type: "image/png" });
      }
    } catch {
      /* fallback below */
    }

    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    // Primary path: native Web Share API with the PNG attached. Works for
    // both WhatsApp and Telegram via the OS share sheet on iOS Safari and
    // most modern Android browsers.
    if (pngFile && nav.canShare && nav.share && nav.canShare({ files: [pngFile], text: message })) {
      try {
        await nav.share({ files: [pngFile], text: message, title: "Scam alert" });
        await recordShare(verdict);
        toast({ title: "Warning sent 🚨", description: "Drive group ko bata diya." });
        return;
      } catch (e) {
        // AbortError = user cancelled — don't count, don't fall back.
        if ((e as DOMException)?.name === "AbortError") return;
        // Other errors → fall through to deep-link fallback.
      }
    }

    // Fallback (desktop / unsupported): download PNG + open deep link
    // with prefilled text. We do NOT count this as a confirmed share.
    if (pngFile) {
      const url = URL.createObjectURL(pngFile);
      const link = document.createElement("a");
      link.href = url;
      link.download = pngFile.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    const encoded = encodeURIComponent(message);
    const shareUrl =
      platform === "whatsapp"
        ? `https://wa.me/?text=${encoded}`
        : `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encoded}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");

    toast({
      title: "Share intent opened",
      description: pngFile
        ? "PNG download ho gayi — group mein attach kar de aur send dabade."
        : "Message group mein paste kar de.",
    });
  };

  const loadRecent = async (r: DriveCheckRow) => {
    setVerdict(r);
    setText(r.rawText);
    setTimeout(() => {
      document.getElementById("verdict-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    if (r.company) {
      const stats = await fetchCompanyStats(r.company);
      setVerdict((v) => (v?.id === r.id ? { ...v, companyStats: stats } : v));
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-24">
      {/* Canopy header */}
      <div className="bg-brand px-6 pt-8 pb-14">
        <div className="max-w-md lg:max-w-3xl mx-auto">
          <button
            onClick={() => setLocation("/home")}
            className="flex items-center gap-1 text-[12px] font-bold text-white/70 mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </button>
          <h1 className="text-display text-[30px] lg:text-[36px] font-extrabold text-white leading-[1.06] tracking-tight">Drive Check</h1>
          <p className="text-[13px] text-white/70 mt-1">
            Paste any placement drive from Telegram / WhatsApp / Insta. Tu instantly dekhega: scam hai ya nahi, aur tu eligible bhi hai ya nahi.
          </p>
        </div>
      </div>

      <div className="px-4 -mt-6 max-w-md lg:max-w-3xl mx-auto">
      {/* Pending pings — drives student applied to 7+ days ago */}
      {pendingPings.length > 0 && (
        <div className="mb-4 bg-paper rounded-2xl shadow-soft p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">
            Quick check — kya hua in drives ka?
          </p>
          <div>
            {pendingPings.slice(0, 3).map((p, i) => (
              <motion.div
                key={p.id}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
                className="py-3 border-t border-line first:border-t-0"
              >
                <p className="text-[13px] font-semibold text-ink truncate">
                  {p.company ?? "Unknown"} {p.role ? `· ${p.role}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    onClick={() => setOutcome(p, "called")}
                    disabled={actionLoading}
                    className={outcomeBtnClass(p.outcome === "called")}
                  >
                    <Phone className="w-3.5 h-3.5" /> Got call
                  </button>
                  <button
                    onClick={() => setOutcome(p, "offer")}
                    disabled={actionLoading}
                    className={outcomeBtnClass(p.outcome === "offer")}
                  >
                    <Award className="w-3.5 h-3.5" /> Got offer
                  </button>
                  <button
                    onClick={() => setOutcome(p, "ghosted")}
                    disabled={actionLoading}
                    className={outcomeBtnClass(p.outcome === "ghosted")}
                  >
                    <Ghost className="w-3.5 h-3.5" /> Ghosted
                  </button>
                  <button
                    onClick={() => setOutcome(p, "rejected")}
                    disabled={actionLoading}
                    className={outcomeBtnClass(p.outcome === "rejected")}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejected
                  </button>
                  <button
                    onClick={() => setOutcome(p, "skipped")}
                    disabled={actionLoading}
                    className="text-[11px] font-bold px-2.5 py-2 rounded-xl text-ink-muted active:scale-95 transition-transform disabled:opacity-50"
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Paste box */}
      <div className="bg-paper rounded-2xl shadow-soft p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Paste drive message yahan...\n\nExample:\n\"Sprinklr off campus drive\nBatch: 2025, 2026\nSalary: 8-11 LPA\nNote: Tier 1 / Tier 2 colleges only\nApply: https://...\""}
          rows={8}
          disabled={loading}
          className="w-full resize-none rounded-2xl border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand transition-colors disabled:opacity-60"
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={pasteFromClipboard}
            disabled={loading}
            className="flex items-center gap-1.5 border border-line text-brand font-bold text-[12px] px-3 py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-40"
          >
            <Clipboard className="w-3.5 h-3.5" /> Paste
          </button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={checkDrive}
            disabled={!text.trim() || loading}
            className="flex-1 bg-brand text-white font-bold text-[14px] py-3 rounded-full disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Check Drive
              </>
            )}
          </motion.button>
        </div>
        <p className="text-[12px] text-ink-muted text-center mt-2.5">
          We tell you: 1) Scam ya nahi · 2) Tu eligible bhi hai ya nahi
        </p>
      </div>

      {/* Verdict */}
      <div id="verdict-anchor" />
      <AnimatePresence mode="wait">
        {verdict && (
          <motion.div
            key={verdict.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6"
          >
            <div ref={cardRef}>
              <VerdictCard
                row={verdict}
                studentName={studentName}
                college={college}
                kodeScore={kodeScore}
              />
            </div>
            {/* Outcome actions — only for non-scam verdicts */}
            {verdict.scamVerdict !== "scam" && (
              <div className="mt-3 bg-paper rounded-2xl shadow-soft p-3.5">
                {verdict.outcome === "pending" && (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">
                      Apply karega is drive ko?
                    </p>
                    <button
                      onClick={() => markApplied(verdict)}
                      disabled={actionLoading}
                      className="w-full bg-brand text-white font-bold text-[14px] py-3 rounded-full active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Maine apply kiya
                      {verdict.applyLink && <span className="text-[11px] opacity-70">+ open link</span>}
                    </button>
                    <p className="text-[12px] text-ink-muted text-center mt-2">
                      We'll ping you in 7 days to ask kya hua — your reply helps every other student.
                    </p>
                  </>
                )}
                {verdict.outcome === "applied" && (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">
                      Status update — kya hua?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Still in the "applied" state, so no outcome is selected yet. */}
                      <button
                        onClick={() => setOutcome(verdict, "called")}
                        disabled={actionLoading}
                        className={outcomeBtnClass(false)}
                      >
                        <Phone className="w-3.5 h-3.5" /> Got call
                      </button>
                      <button
                        onClick={() => setOutcome(verdict, "offer")}
                        disabled={actionLoading}
                        className={outcomeBtnClass(false)}
                      >
                        <Award className="w-3.5 h-3.5" /> Got offer
                      </button>
                      <button
                        onClick={() => setOutcome(verdict, "ghosted")}
                        disabled={actionLoading}
                        className={outcomeBtnClass(false)}
                      >
                        <Ghost className="w-3.5 h-3.5" /> Ghosted
                      </button>
                      <button
                        onClick={() => setOutcome(verdict, "rejected")}
                        disabled={actionLoading}
                        className={outcomeBtnClass(false)}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rejected
                      </button>
                    </div>
                  </>
                )}
                {["called", "ghosted", "rejected", "offer", "skipped"].includes(verdict.outcome) && (
                  <div className="flex items-center gap-2 text-[13px] text-ink font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-done shrink-0" />
                    <span>
                      Outcome saved: <span className="capitalize">{verdict.outcome}</span> · Thanks for sharing
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Warn the group — one tap; only for scam verdicts */}
            {verdict.scamVerdict === "scam" && (
              <div className="mt-3 bg-paper rounded-2xl shadow-soft p-3.5">
                <div className="flex items-start gap-2 mb-2.5">
                  <Megaphone className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[13px] font-bold text-ink leading-tight">
                      Warn the group — one tap
                    </p>
                    <p className="text-[12px] text-ink-muted mt-0.5">
                      Prefilled message + verdict card. Saves friends from getting scammed.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => warnTheGroup("whatsapp")}
                    data-testid="button-warn-whatsapp"
                    className="bg-brand text-white font-bold text-[12px] py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    WhatsApp group
                  </button>
                  <button
                    onClick={() => warnTheGroup("telegram")}
                    data-testid="button-warn-telegram"
                    className="border border-line text-brand font-bold text-[12px] py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    Telegram group
                  </button>
                </div>
                {verdict.sharedCount > 0 && (
                  <p className="text-[12px] text-ink-muted text-center mt-2 font-bold">
                    Shared {verdict.sharedCount} {verdict.sharedCount === 1 ? "time" : "times"}
                  </p>
                )}
              </div>
            )}
            <button
              onClick={downloadCard}
              data-testid="button-download-card"
              className="w-full mt-3 bg-brand text-white font-bold text-[14px] py-3 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Download className="w-4 h-4" />
              {verdict.scamVerdict === "scam" ? "Just download PNG" : "Share verdict to drive group"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent checks */}
      {recent.length > 0 && (
        <div className="mt-10 bg-paper rounded-2xl shadow-soft p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">Recent checks</h3>
          <div>
            {recent.slice(0, 5).map((r, i) => {
              const v = VERDICT_STYLE[r.scamVerdict] ?? VERDICT_STYLE.risky;
              return (
                <motion.button
                  key={r.id}
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
                  onClick={() => loadRecent(r)}
                  className="w-full py-3 border-t border-line first:border-t-0 flex items-center gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-ink truncate">
                      {r.company ?? "Unknown company"} {r.role ? `· ${r.role}` : ""}
                    </p>
                    <p className="text-[12px] text-ink-muted mt-0.5">
                      {v.label} · {r.gatesOpen}/{r.gatesTotal} gates open
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
