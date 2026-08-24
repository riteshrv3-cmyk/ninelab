import { useEffect, useState } from "react";
import { Copy, Check, RefreshCw, Share2, Users, Sparkles, Link as LinkIcon, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type College = {
  id: number;
  name: string;
  city: string;
  inviteCode: string;
  signupCount: number;
  logoUrl: string | null;
};

function getTpo() {
  try { return JSON.parse(localStorage.getItem("tpo") || "{}"); } catch { return {}; }
}

export default function Invite() {
  const tpo = getTpo();
  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        email: tpo.email || "",
        name: tpo.name || "",
        college: tpo.college || "",
      });
      const r = await fetch(`/api/tpo/my-college?${params}`);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setCollege(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load college");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const inviteUrl = college
    ? `${window.location.origin}/ninelab/join/${college.inviteCode}`
    : "";

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function shareWhatsApp() {
    if (!college) return;
    const msg = `Hey! 🚀 ${college.name} ke saare students ke liye ninelab — AI Career Companion. Sign up using our college invite link:\n\n${inviteUrl}\n\n• AI mock interviews (with camera)\n• Live job-fit checker\n• Personalized roadmap\n• Free forever`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function regenerate() {
    if (!college) return;
    if (!confirm("Regenerate invite code? Old link will stop working immediately.")) return;
    setRegenerating(true);
    try {
      const r = await fetch(`/api/tpo/colleges/${college.id}/regenerate`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const updated = await r.json();
      setCollege(updated);
    } catch (e) {
      alert("Failed to regenerate. Try again.");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#e2e8f0] rounded w-1/3" />
          <div className="h-48 bg-[#e2e8f0] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !college) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-sm text-red-700 font-bold mb-2">Couldn't load your college</p>
          <p className="text-xs text-red-600">{error}</p>
          <Button onClick={load} className="mt-3" size="sm">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <p className="text-xs font-bold text-[#6366f1] uppercase tracking-wider mb-1">Onboarding</p>
        <h1 className="text-2xl font-black text-[#0f172a]">Invite Your Students</h1>
        <p className="text-sm text-[#64748b] mt-1">Share one link. Students sign up themselves and auto-join {college.name}.</p>
      </div>

      {/* Invite Link Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#4f46e5] via-[#6366f1] to-[#7c3aed] p-7 text-white shadow-2xl mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4" />
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-white/90">Your College Invite Link</p>
        </div>
        <p className="text-2xl font-black mb-1">{college.name}</p>
        <p className="text-sm text-white/75 mb-5">Code: <span className="font-mono font-bold tracking-wider">{college.inviteCode}</span></p>

        <div className="bg-white/15 backdrop-blur rounded-2xl p-4 mb-4 border border-white/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Share this link</p>
          <p className="text-sm font-mono break-all leading-relaxed">{inviteUrl}</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={copy}
            className="bg-white text-[#4f46e5] hover:bg-white/90 font-bold rounded-xl"
          >
            {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied!</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy link</>}
          </Button>
          <Button
            onClick={shareWhatsApp}
            className="bg-[#25d366] hover:bg-[#20bf5b] text-white font-bold rounded-xl"
          >
            <MessageCircle className="w-4 h-4 mr-1.5" /> Send on WhatsApp
          </Button>
          <Button
            onClick={regenerate}
            disabled={regenerating}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 border-white/30 text-white font-bold rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${regenerating ? "animate-spin" : ""}`} /> Regenerate
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#10b981]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Signups via link</p>
          </div>
          <p className="text-3xl font-black text-[#0f172a]">{college.signupCount}</p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <LinkIcon className="w-4 h-4 text-[#6366f1]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Status</p>
          </div>
          <p className="text-base font-bold text-[#10b981]">Active</p>
          <p className="text-xs text-[#64748b]">Anyone with link can join</p>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="w-4 h-4 text-[#ec4899]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Best channel</p>
          </div>
          <p className="text-base font-bold text-[#0f172a]">WhatsApp</p>
          <p className="text-xs text-[#64748b]">College batch group</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-6">
        <p className="text-sm font-extrabold text-[#0f172a] mb-4">How it works</p>
        <div className="space-y-3">
          {[
            { n: 1, t: "Copy your invite link", d: "One link works for all students. No CSV upload, no manual adds." },
            { n: 2, t: "Drop it in college WhatsApp groups", d: "Final-year, third-year, placement broadcast — wherever your students are." },
            { n: 3, t: "Students sign up themselves", d: "They tap the link, go through 60-second onboarding, and auto-join your college." },
            { n: 4, t: "You see them in Students tab", d: "Track profile strength, placement readiness, and engagement on your dashboard." },
          ].map(s => (
            <div key={s.n} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#6366f1] text-white text-xs font-black flex items-center justify-center flex-shrink-0">{s.n}</div>
              <div>
                <p className="text-sm font-bold text-[#0f172a]">{s.t}</p>
                <p className="text-xs text-[#64748b]">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
