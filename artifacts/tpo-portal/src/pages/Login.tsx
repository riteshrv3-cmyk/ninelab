import { useState } from "react";
import { useLocation } from "wouter";
import { Zap, Building2, User, Lock, Mail, ChevronRight, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/tpo-portal", "");

const DEMO_COLLEGES = [
  "IIT Bombay", "IIT Delhi", "IIT Madras", "NIT Trichy", "VIT Vellore",
  "BITS Pilani", "Jadavpur University", "RVCE Bangalore", "Thapar University", "COEP Pune",
];

export default function Login() {
  const [, nav] = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [college, setCollege] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && (!college.trim() || !name.trim() || password.length < 6)) {
      setError("Name, college and a 6+ char password are required to sign up.");
      return;
    }
    setLoading(true);
    try {
      const url = mode === "login" ? `${BASE}/api/tpo/login` : `${BASE}/api/tpo/signup`;
      const body = mode === "login"
        ? { email: email.trim(), password }
        : { email: email.trim(), password, name: name.trim(), college: college.trim(), dept: dept.trim() };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Auth failed");
        setLoading(false);
        return;
      }
      localStorage.setItem("tpoToken", data.token);
      localStorage.setItem("tpo", JSON.stringify(data.tpo));
      nav("/dashboard");
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#312e81] to-[#4c1d95] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-11 h-11 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">ninelab</p>
            <p className="text-xs text-indigo-300 font-medium">Training & Placement Portal</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 p-8">
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${mode === "login" ? "bg-[#4f46e5] text-white" : "bg-[#f1f5f9] text-[#64748b]"}`}
            >Sign In</button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${mode === "signup" ? "bg-[#4f46e5] text-white" : "bg-[#f1f5f9] text-[#64748b]"}`}
            >Create Account</button>
          </div>
          <h2 className="text-xl font-bold text-[#0f172a] mb-1">{mode === "login" ? "Welcome back, TPO" : "Create your TPO account"}</h2>
          <p className="text-sm text-[#64748b] mb-6">
            {mode === "login"
              ? "Sign in to manage your batch's placement journey."
              : "Your college identity is bound to this account — no one else can post drives on your behalf."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email *" Icon={Mail}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@college.edu"
                     className={inputCls} />
            </Field>
            <Field label="Password *" Icon={Lock}>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••"
                     className={inputCls} />
            </Field>

            {mode === "signup" && (
              <>
                <Field label="Your Name *" Icon={User}>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Prof. Ramesh Kumar"
                         className={inputCls} />
                </Field>
                <Field label="Institution *" Icon={Building2}>
                  <input value={college} onChange={e => setCollege(e.target.value)} list="colleges" placeholder="e.g. IIT Bombay"
                         className={inputCls} />
                  <datalist id="colleges">
                    {DEMO_COLLEGES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </Field>
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1.5 uppercase tracking-wide">Department</label>
                  <input value={dept} onChange={e => setDept(e.target.value)} placeholder="CSE, ECE, IT…"
                         className="w-full px-4 py-3 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition" />
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">{error}</div>
            )}

            <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white py-3 rounded-xl font-semibold text-sm shadow-lg shadow-[#4f46e5]/25 hover:shadow-[#4f46e5]/40 transition-all disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>{mode === "login" ? "Sign In" : "Create Account"} <ChevronRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-indigo-300/60 mt-6">ninelab · AI Career Companion for India</p>
      </div>
    </div>
  );
}

const inputCls = "w-full pl-10 pr-4 py-3 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition";

function Field({ label, Icon, children }: { label: string; Icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#475569] mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
        {children}
      </div>
    </div>
  );
}
