import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Building2, Briefcase, Clock, CheckCircle, XCircle, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api/authFetch";

interface Invite {
  id: number;
  studentId: number;
  recruiterCompany: string;
  recruiterName: string;
  recruiterEmail: string;
  role?: string;
  message?: string;
  status: string;
  studentSeen: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function InviteCard({ invite, onUpdate }: { invite: Invite; onUpdate: (id: number, status: string) => void }) {
  const [loading, setLoading] = useState<"accepted" | "declined" | null>(null);
  const { toast } = useToast();

  async function respond(status: "accepted" | "declined") {
    setLoading(status);
    try {
      const r = await apiFetch(`/api/recruiter-invites/${invite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error();
      onUpdate(invite.id, status);
      toast({
        title: status === "accepted" ? "✅ Invite accepted!" : "Invite declined",
        description: status === "accepted" ? `${invite.recruiterCompany} will be notified.` : "We've let them know.",
      });
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }

  const isPending = invite.status === "pending";
  const isAccepted = invite.status === "accepted";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-paper rounded-2xl shadow-soft p-4"
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-brand-soft flex items-center justify-center text-brand font-extrabold text-[16px] shrink-0">
          {invite.recruiterCompany.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-extrabold text-ink text-[15px] leading-tight">{invite.recruiterCompany}</p>
              {invite.role && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Briefcase className="w-3 h-3 text-ink-muted" />
                  <p className="text-[13px] text-ink">{invite.role}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isPending && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-line/60 px-2 py-0.5 rounded-full">
                  {invite.status}
                </span>
              )}
              {isPending && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-highlight px-2 py-0.5 rounded-full">
                  New
                </span>
              )}
              <span className="text-[13px] text-ink-muted">{timeAgo(invite.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Building2 className="w-3 h-3 text-ink-muted" />
            <p className="text-[13px] text-ink-muted">{invite.recruiterName}</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {invite.message && (
        <div className="mt-3 bg-canvas rounded-xl px-3.5 py-2.5">
          <p className="text-[13px] text-ink-muted leading-relaxed italic">"{invite.message}"</p>
        </div>
      )}

      {/* Accepted: show recruiter email */}
      {isAccepted && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 bg-done/10 rounded-xl px-3.5 py-2.5 flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4 text-done shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-ink">You accepted! Reach out directly:</p>
            <a href={`mailto:${invite.recruiterEmail}`} className="text-[13px] font-bold text-ink flex items-center gap-1 mt-0.5 underline">
              {invite.recruiterEmail} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      )}

      {/* Declined state */}
      {invite.status === "declined" && (
        <div className="mt-3 bg-canvas rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-ink-muted shrink-0" />
          <p className="text-[13px] text-ink-muted">You passed on this one</p>
        </div>
      )}

      {/* Action buttons for pending */}
      {isPending && (
        <div className="flex gap-2 mt-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => respond("accepted")}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-full bg-brand text-white font-bold text-[14px] disabled:opacity-60 transition-opacity"
          >
            {loading === "accepted" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Accept</>}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => respond("declined")}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-full bg-paper text-brand border border-line font-bold text-[14px] disabled:opacity-60 transition-opacity"
          >
            {loading === "declined" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /> Pass</>}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

export default function Inbox() {
  const [, setLocation] = useLocation();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "accepted" | "declined">("all");

  useEffect(() => {
    const id = localStorage.getItem("studentId");
    if (!id) { setLocation("/"); return; }
    setStudentId(parseInt(id, 10));
  }, [setLocation]);

  useEffect(() => {
    if (!studentId) return;
    apiFetch(`/api/students/${studentId}/invites`)
      .then(r => r.json())
      .then((data: Invite[]) => {
        setInvites(data);
        // Mark all as seen
        apiFetch(`/api/students/${studentId}/mark-invites-seen`, { method: "POST" });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  function handleUpdate(id: number, status: string) {
    setInvites(prev => prev.map(inv => inv.id === id ? { ...inv, status, studentSeen: true } : inv));
  }

  const filtered = activeFilter === "all" ? invites : invites.filter(i => i.status === activeFilter);
  const pendingCount = invites.filter(i => i.status === "pending").length;

  const FILTERS: { key: typeof activeFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: invites.length },
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "accepted", label: "Accepted", count: invites.filter(i => i.status === "accepted").length },
    { key: "declined", label: "Declined", count: invites.filter(i => i.status === "declined").length },
  ];

  return (
    <div className="min-h-screen bg-canvas pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-paper px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[26px] font-extrabold text-ink leading-[1.06] tracking-tight">Recruiter Inbox</h1>
              {pendingCount > 0 && !loading && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-highlight text-white text-[13px] font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center"
                >
                  {pendingCount}
                </motion.span>
              )}
            </div>
            <p className="text-[13px] text-ink-muted mt-0.5">Companies interested in hiring you</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-brand-soft flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-brand" />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${
                activeFilter === f.key
                  ? "bg-brand text-white border border-brand"
                  : "bg-paper text-ink-muted border border-line"
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`text-[10px] font-bold px-1 rounded-full ${
                  activeFilter === f.key ? "text-paper" : "text-ink-muted"
                }`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-line rounded-2xl p-4 h-32 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-16 px-6"
          >
            <p className="text-[14px] text-ink">
              {activeFilter === "all" ? "No invites yet." : `No ${activeFilter} invites.`}
            </p>
            <p className="text-[13px] text-ink-muted mt-1 leading-relaxed">
              {activeFilter === "all"
                ? "Invites will appear here when a recruiter reaches out — nothing yet."
                : `You don't have any ${activeFilter} invites right now.`}
            </p>
            {activeFilter === "all" && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setLocation("/profile")}
                className="mt-5 flex items-center gap-2 bg-brand text-white font-bold text-[14px] px-4 py-3 rounded-full"
              >
                Update your profile <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            <AnimatePresence>
              {filtered.map(invite => (
                <InviteCard key={invite.id} invite={invite} onUpdate={handleUpdate} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
