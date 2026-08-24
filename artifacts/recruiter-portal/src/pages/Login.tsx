import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Building2, User, Briefcase, ArrowRight, Zap, Mail, Users, GraduationCap, Clock } from "lucide-react";

const ROLES = ["HR Manager", "Technical Recruiter", "Campus Recruiter", "Talent Acquisition Lead", "Founder / CEO"];

const STATIC_STATS = [
  { label: "Verified students", value: "1,200+", icon: Users, color: "#4f46e5" },
  { label: "Partner colleges", value: "15+", icon: GraduationCap, color: "#10b981" },
  { label: "Median shortlist", value: "48 hrs", icon: Clock, color: "#f97316" },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ company: "", name: "", email: "", role: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.company.trim() || !form.name.trim() || !form.email.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/recruiters/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Login failed");
      }
      const recruiter = await res.json();
      localStorage.setItem("recruiter", JSON.stringify({ ...recruiter, loggedInAt: Date.now() }));
      setLocation("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Subtle background pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#4f46e5]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#f97316]/5 rounded-full blur-[80px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2.5 mb-8"
        >
          <div className="w-9 h-9 bg-[#f97316] rounded-xl flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <div className="font-black text-[#0f172a] text-xl tracking-tight leading-none">ninelab</div>
            <div className="text-xs text-[#94a3b8] font-medium">Private Hiring Network</div>
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="grid grid-cols-3 gap-3 mb-6"
        >
          {STATIC_STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white border border-[#f0f4ff] rounded-2xl p-3 text-center shadow-sm">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                  </div>
                </div>
                <p className="font-black text-[#0f172a] text-base leading-none">{s.value}</p>
                <p className="text-[10px] text-[#94a3b8] font-semibold mt-0.5">{s.label}</p>
              </div>
            );
          })}
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-3xl border border-[#e5e7eb] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
        >
          <div className="mb-5">
            <h2 className="text-xl font-black text-[#0f172a] mb-0.5">Sign in / Create account</h2>
            <p className="text-sm text-[#94a3b8]">No password — your work email is your account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block">Work Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="email" required placeholder="you@company.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border border-[#e5e7eb] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-colors bg-[#fafafa] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block">Company Name *</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="text" required placeholder="e.g. Razorpay, Zerodha, Infosys"
                  value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border border-[#e5e7eb] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-colors bg-[#fafafa] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block">Your Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="text" required placeholder="Full name"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border border-[#e5e7eb] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-colors bg-[#fafafa] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block">Your Role</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <select
                  value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border border-[#e5e7eb] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-colors bg-[#fafafa] focus:bg-white appearance-none"
                >
                  <option value="">Select role</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-[#fff5f5] border border-[#fecaca] rounded-xl px-4 py-2.5">
                <p className="text-[#ef4444] text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit" disabled={submitting}
              className="w-full mt-1 bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(79,70,229,0.3)] hover:shadow-[0_8px_24px_rgba(79,70,229,0.4)] transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? "Signing in..." : <>Continue to Dashboard <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-xs text-[#cbd5e1] mt-4">
            Free during beta · No credit card · Private access only
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-4"
        >
          <button
            onClick={() => setLocation("/welcome")}
            className="text-[#94a3b8] hover:text-[#4f46e5] text-sm font-medium transition-colors"
          >
            See sample candidates first →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
