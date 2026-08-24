import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { GraduationCap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type College = { id: number; name: string; city: string; signupCount: number; logoUrl: string | null; inviteCode: string };

export default function Join({ code }: { code: string }) {
  const [, nav] = useLocation();
  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/invite/${encodeURIComponent(code.toUpperCase())}`);
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e?.error || "This invite link is invalid or expired.");
        }
        const data = await r.json();
        if (!cancelled) setCollege(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load invite");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  function startOnboarding() {
    if (!college) return;
    sessionStorage.setItem("inviteCode", college.inviteCode);
    sessionStorage.setItem("inviteCollegeName", college.name);
    sessionStorage.setItem("inviteCollegeCity", college.city || "");
    nav("/");
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-canvas flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin mb-4" />
        <p className="text-[13px] font-bold text-ink-muted">Verifying your invite…</p>
      </div>
    );
  }

  if (error || !college) {
    return (
      <div className="min-h-[100dvh] bg-canvas flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-paper shadow-soft flex items-center justify-center mb-5">
          <AlertCircle className="w-10 h-10 text-danger" />
        </div>
        <h1 className="text-display text-[30px] lg:text-[36px] font-extrabold text-ink mb-2">Invite link invalid</h1>
        <p className="text-[13px] text-danger mb-6 max-w-xs">{error}</p>
        <Button onClick={() => nav("/")} className="bg-brand text-white hover:bg-brand/90 font-bold rounded-full px-4 py-3">
          Continue without invite
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-canvas flex flex-col items-center justify-between p-6 text-center max-w-md lg:max-w-lg mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
          className="w-24 h-24 rounded-[26px] bg-paper shadow-soft flex items-center justify-center mb-6"
        >
          {college.logoUrl ? (
            <img src={college.logoUrl} alt={college.name} className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <GraduationCap className="w-12 h-12 text-brand" />
          )}
        </motion.div>

        <motion.div
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
          className="bg-brand-soft rounded-full px-4 py-1.5 mb-4 inline-flex items-center"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Official college invite</span>
        </motion.div>

        <motion.h1
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-display text-[30px] lg:text-[36px] font-extrabold text-ink mb-2 leading-tight"
        >
          Welcome to ninelab
        </motion.h1>
        <motion.p
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.28 }}
          className="text-[14px] text-ink-muted mb-1"
        >
          You've been invited by
        </motion.p>
        <motion.p
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.32 }}
          className="text-[20px] font-bold text-ink mb-1"
        >
          {college.name}
        </motion.p>
        {college.city && (
          <p className="text-[13px] text-ink-muted mb-5">{college.city}</p>
        )}

        {college.signupCount > 0 && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }}
            className="bg-paper rounded-2xl shadow-soft px-4 py-2.5 mb-6"
          >
            <p className="text-[12px] font-bold text-ink-muted">
              {college.signupCount} {college.signupCount === 1 ? "student" : "students"} from your college already joined
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}
          className="grid grid-cols-3 gap-2.5 w-full max-w-sm mt-2"
        >
          {[
            { e: "🎤", l: "AI mock interviews" },
            { e: "🎯", l: "Live job-fit check" },
            { e: "📚", l: "Personal roadmap" },
          ].map(it => (
            <div key={it.l} className="bg-paper rounded-2xl shadow-soft p-3">
              <div className="text-2xl mb-1">{it.e}</div>
              <div className="text-[10px] font-bold text-ink-muted leading-tight">{it.l}</div>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55 }}
        className="w-full pb-safe"
      >
        <Button
          data-testid="join-start"
          onClick={startOnboarding}
          className="w-full h-14 rounded-full bg-brand text-white hover:bg-brand/90 font-bold text-base"
        >
          Join {college.name.split(" ").slice(0, 3).join(" ")} →
        </Button>
        <p className="text-[11px] text-ink-muted mt-3">Free forever · 60-second setup</p>
      </motion.div>
    </div>
  );
}
