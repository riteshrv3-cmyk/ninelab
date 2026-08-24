import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Zap, ArrowLeft, Sparkles, ArrowRight, Loader2,
  Clock, Mail, CheckCircle, ShieldCheck, Users
} from "lucide-react";

export default function PostJob() {
  const [, setLocation] = useLocation();
  const recruiter = JSON.parse(localStorage.getItem("recruiter") || "{}");

  const [title, setTitle] = useState("");
  const [rawDescription, setRawDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [jobTitle, setJobTitle] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (rawDescription.trim().length < 30) {
      setError("Please paste a real job description (at least 30 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/recruiter-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruiterId: recruiter.id,
          title: title.trim() || undefined,
          rawDescription,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const resolvedTitle = data?.job?.title || title.trim() || "your role";
      setJobTitle(resolvedTitle);
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Nav */}
      <div className="bg-white border-b border-[#f0f4ff] sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => setLocation("/dashboard")}
            className="text-[#64748b] hover:text-[#0f172a] p-1.5 rounded-lg hover:bg-[#f8fafc] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-[#f97316] rounded-xl flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <h1 className="font-black text-[#0f172a] text-[15px]">Post a Job</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8">
        {!submitted ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 bg-[#eef2ff] border border-[#c7d2fe] rounded-full px-3.5 py-1.5 mb-4">
                <Sparkles className="w-3.5 h-3.5 text-[#4f46e5]" />
                <span className="text-xs font-bold text-[#4f46e5]">Private beta · Curated matches</span>
              </div>
              <h2 className="text-2xl font-black text-[#0f172a] mb-1.5">Paste your JD. We'll do the rest.</h2>
              <p className="text-[#64748b] text-sm leading-relaxed">
                Our team will manually review and curate the best-fit candidates from our verified pool — and send them your way within 24–48 hours.
              </p>
            </div>

            <form onSubmit={submit} className="bg-white rounded-2xl border border-[#e5e7eb] p-6 shadow-sm space-y-5">
              {/* Job title */}
              <div>
                <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block">
                  Job / Internship Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Backend Engineer Intern, Product Intern, SDE-1"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-colors bg-[#fafafa] focus:bg-white"
                />
              </div>

              {/* JD */}
              <div>
                <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block">
                  Job Description *
                </label>
                <textarea
                  required
                  value={rawDescription}
                  onChange={e => setRawDescription(e.target.value)}
                  rows={11}
                  placeholder={`Paste your full JD here — include:\n• Role & responsibilities\n• Required skills (React, Python, etc.)\n• CGPA cutoff if any\n• Location & work mode (Remote / Hybrid / On-site)\n• Stipend or package\n• Any other requirements`}
                  className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-colors bg-[#fafafa] focus:bg-white resize-none leading-relaxed"
                />
                <p className="text-[11px] text-[#94a3b8] mt-1.5">More detail = better candidate matches from our team.</p>
              </div>

              {error && (
                <div className="bg-[#fff5f5] border border-[#fecaca] rounded-xl px-4 py-2.5">
                  <p className="text-[#ef4444] text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(79,70,229,0.25)] hover:shadow-[0_8px_24px_rgba(79,70,229,0.35)] transition-all active:scale-[0.98] disabled:opacity-60 text-[15px]"
              >
                {submitting
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                  : <>Submit Job Request <ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>

            {/* Trust strip */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { icon: Clock, text: "24–48 hr response" },
                { icon: ShieldCheck, text: "Verified candidates only" },
                { icon: Users, text: "Manually curated" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="bg-white border border-[#f0f4ff] rounded-xl p-3 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-[#4f46e5] flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-[#64748b]">{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* ── BETA CONFIRMATION SCREEN ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="flex flex-col items-center text-center py-8"
          >
            {/* Animated tick */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-[#f0fdf4] border-2 border-[#86efac] rounded-full flex items-center justify-center mb-6"
            >
              <CheckCircle className="w-10 h-10 text-[#10b981]" />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="inline-flex items-center gap-2 bg-[#fff7ed] border border-[#fed7aa] rounded-full px-4 py-1.5 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse" />
                <span className="text-xs font-bold text-[#ea580c]">Private Beta · Under Review</span>
              </div>

              <h2 className="text-2xl font-black text-[#0f172a] mb-3">
                We've received your job request.
              </h2>
              <p className="text-[#64748b] text-[15px] leading-relaxed max-w-md mx-auto mb-8">
                We're currently in <strong className="text-[#0f172a]">private beta</strong> — our team manually reviews every job posting and personally curates the best-fit candidates from our verified pool.
                <br /><br />
                You'll hear from us at <strong className="text-[#4f46e5]">{recruiter.email}</strong> within <strong className="text-[#0f172a]">24–48 hours</strong> with shortlisted profiles.
              </p>

              {/* What happens next */}
              <div className="bg-white border border-[#f0f4ff] rounded-2xl p-5 mb-6 text-left max-w-md mx-auto w-full shadow-sm">
                <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8] mb-4">What happens next</p>
                <div className="space-y-4">
                  {[
                    {
                      icon: ShieldCheck,
                      color: "#4f46e5",
                      bg: "#eef2ff",
                      title: "JD is reviewed",
                      desc: "Our team reads your requirements and maps them to our talent pool.",
                    },
                    {
                      icon: Users,
                      color: "#10b981",
                      bg: "#f0fdf4",
                      title: "Candidates are handpicked",
                      desc: "Only GitHub-verified, AI-scored students who actually fit your role.",
                    },
                    {
                      icon: Mail,
                      color: "#f97316",
                      bg: "#fff7ed",
                      title: "We email you profiles",
                      desc: `Shortlisted profiles land in ${recruiter.email} — ready to review and reach out.`,
                    },
                  ].map(({ icon: Icon, color, bg, title, desc }, i) => (
                    <motion.div
                      key={title}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div>
                        <div className="font-bold text-[#0f172a] text-sm">{title}</div>
                        <div className="text-xs text-[#64748b] mt-0.5">{desc}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setLocation("/dashboard")}
                  className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-[0.98] text-sm"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => setLocation("/talent")}
                  className="border border-[#e5e7eb] text-[#64748b] hover:border-[#4f46e5]/30 hover:text-[#4f46e5] font-semibold px-6 py-3 rounded-xl transition-all text-sm"
                >
                  Browse talent pool
                </button>
              </div>

              <p className="mt-6 text-xs text-[#cbd5e1]">
                Questions? Reply to any email from us or reach out at hello@ninelab.in
              </p>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
