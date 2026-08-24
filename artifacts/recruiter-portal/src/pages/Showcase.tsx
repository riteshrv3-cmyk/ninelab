import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, ArrowRight, Lock, Github, Users, GraduationCap, TrendingUp,
  CheckCircle, X, Sparkles, ChevronRight, Search, Brain, FileText,
  Calendar, Database, BarChart3, Check, Minus
} from "lucide-react";

const PREVIEW_CANDIDATE = {
  initials: "AR", college: "BITS Pilani", field: "Computer Science", year: 3,
  profileStrength: 87, overallScore: 82, skills: ["React", "Node.js", "PostgreSQL"],
  github: { repos: 14, stars: 47, streak: 32 },
};

const STATS = [
  { value: "1,200+", label: "Verified students", icon: Users, color: "#4f46e5" },
  { value: "15+", label: "Partner colleges", icon: GraduationCap, color: "#10b981" },
  { value: "90%+", label: "Have real projects", icon: Github, color: "#0f172a" },
  { value: "48 hrs", label: "Median shortlist", icon: TrendingUp, color: "#f97316" },
];

const OLD_TOOLS = [
  { name: "Naukri / LinkedIn", icon: Search, color: "#0077b5", pain: "200+ irrelevant applications" },
  { name: "HackerRank / Test", icon: FileText, color: "#00b94a", pain: "Manual test setup & grading" },
  { name: "Calendly", icon: Calendar, color: "#006bff", pain: "No-shows. Reschedule loops." },
  { name: "ATS / Sheets", icon: Database, color: "#34a853", pain: "Data scattered everywhere" },
  { name: "Analytics tool", icon: BarChart3, color: "#ff6d00", pain: "No insight on why hires fail" },
];

const SAMPLE_JD = `We're looking for a Backend Engineering Intern at our Bangalore office.

Requirements:
- Strong in Node.js or Python
- Familiarity with REST APIs and PostgreSQL
- CGPA 7.5 or above preferred
- Open to hybrid work (3 days/week in office)
- 6-month internship, stipend ₹25,000/month`;

const DEMO_MATCHES = [
  { initials: "PR", name: "Priya R.", college: "IIT Bombay", field: "CSE", year: 3, match: 94, skills: ["Node.js", "PostgreSQL", "REST APIs"], cgpa: "8.9", github: true },
  { initials: "AK", name: "Arjun K.", college: "BITS Pilani", field: "CS", year: 3, match: 88, skills: ["Python", "FastAPI", "SQL"], cgpa: "8.4", github: true },
  { initials: "SM", name: "Shreya M.", college: "NIT Trichy", field: "IT", year: 4, match: 81, skills: ["Node.js", "Express", "MongoDB"], cgpa: "8.1", github: true },
];

const COMPARISON: {
  feature: string;
  note?: string;
  kt: boolean | "partial" | string;
  linkedin: boolean | "partial" | string;
  ats: boolean | "partial" | string;
  campus: boolean | "partial" | string;
  boards: boolean | "partial" | string;
}[] = [
  {
    feature: "Verified coding proof",
    note: "Real GitHub repos, not self-declared skills",
    kt: true, linkedin: false, ats: false, campus: false, boards: false,
  },
  {
    feature: "Large professional network",
    note: "Reach across seniority levels & industries",
    kt: "Focused", linkedin: true, ats: false, campus: false, boards: "partial",
  },
  {
    feature: "AI-ranked candidate matches",
    note: "JD → ranked shortlist without manual screening",
    kt: true, linkedin: "partial", ats: "partial", campus: false, boards: false,
  },
  {
    feature: "HRMS / workflow integrations",
    note: "Greenhouse, Workday, Lever, JIRA HR etc.",
    kt: "Planned", linkedin: "partial", ats: true, campus: false, boards: "partial",
  },
  {
    feature: "Engineering-specific talent pool",
    note: "CS / IT / ECE students from IIT, NIT, BITS",
    kt: true, linkedin: false, ats: false, campus: true, boards: false,
  },
  {
    feature: "Activity & commitment score",
    note: "Streak, XP, test scores — not just resume words",
    kt: true, linkedin: false, ats: false, campus: false, boards: false,
  },
  {
    feature: "Team hiring workflow",
    note: "Stage tracking, feedback, collaboration tools",
    kt: "partial", linkedin: false, ats: true, campus: false, boards: false,
  },
  {
    feature: "Instant JD → top matches",
    note: "Paste JD, get ranked candidates in seconds",
    kt: true, linkedin: "partial", ats: false, campus: false, boards: "partial",
  },
  {
    feature: "Real project portfolios",
    note: "Deployed apps, open-source contributions, demos",
    kt: true, linkedin: "partial", ats: false, campus: false, boards: false,
  },
  {
    feature: "Interview scheduling",
    note: "Built-in calendar coordination with candidates",
    kt: "Planned", linkedin: false, ats: true, campus: "partial", boards: false,
  },
  {
    feature: "Free to browse talent",
    note: "No per-seat or per-InMail fees to start",
    kt: true, linkedin: false, ats: false, campus: false, boards: false,
  },
  {
    feature: "Setup time",
    kt: "2 min", linkedin: "~1 hour", ats: "2–4 weeks", campus: "3–6 months", boards: "~30 min",
  },
];

type DemoStep = "idle" | "parsing" | "matching" | "done";

export default function Showcase() {
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [demoStep, setDemoStep] = useState<DemoStep>("idle");
  const [parsedSkills, setParsedSkills] = useState<string[]>([]);
  const [visibleCards, setVisibleCards] = useState(0);
  const [activeOldTool, setActiveOldTool] = useState(0);
  const demoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setActiveOldTool(i => (i + 1) % OLD_TOOLS.length), 2200);
    return () => clearInterval(t);
  }, []);

  const runDemo = async () => {
    if (demoStep !== "idle") return;
    setDemoStep("parsing");
    setParsedSkills([]);
    setVisibleCards(0);
    await new Promise(r => setTimeout(r, 600));
    const skills = ["Node.js", "Python", "PostgreSQL", "REST APIs", "CGPA 7.5+", "Hybrid"];
    for (const s of skills) {
      setParsedSkills(prev => [...prev, s]);
      await new Promise(r => setTimeout(r, 280));
    }
    await new Promise(r => setTimeout(r, 500));
    setDemoStep("matching");
    await new Promise(r => setTimeout(r, 700));
    setDemoStep("done");
    for (let i = 1; i <= 3; i++) {
      await new Promise(r => setTimeout(r, 380));
      setVisibleCards(i);
    }
  };

  const resetDemo = () => {
    setDemoStep("idle");
    setParsedSkills([]);
    setVisibleCards(0);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[#f0f0f0] shadow-sm">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#f97316] rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-black text-[#0f172a] text-[15px] tracking-tight">ninelab</span>
            <span className="hidden sm:block text-[#cbd5e1] text-sm">/ Recruiter</span>
          </div>
          <button onClick={() => setLocation("/login")} className="bg-[#4f46e5] hover:bg-[#4338ca] active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all">
            Get early access <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      <section className="bg-white border-b border-[#f0f4ff] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#4f46e5]/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-[10%] w-[400px] h-[400px] bg-[#f97316]/5 rounded-full blur-[100px]" />
        </div>
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-24 grid lg:grid-cols-[1fr_340px] gap-10 lg:gap-16 items-center relative z-10">
          <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 bg-[#fff7ed] border border-[#fed7aa] rounded-full px-3.5 py-1.5 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse" />
              <span className="text-[11px] font-bold text-[#ea580c] tracking-wider uppercase">Private beta · Invite-only</span>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="text-[38px] sm:text-[52px] font-black text-[#0f172a] leading-[1.1] tracking-tight mb-5">
              Stop juggling<br />5 hiring tools.<br />
              <span className="text-[#4f46e5]">Get one that works.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }} className="text-[17px] text-[#64748b] mb-8 leading-relaxed max-w-md">
              ninelab replaces your entire campus hiring stack — sourcing, screening, scoring — with one AI-powered pool of verified engineering students.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setLocation("/login")} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-black px-7 py-3.5 rounded-xl flex items-center gap-2 shadow-[0_4px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_8px_32px_rgba(79,70,229,0.4)] transition-all active:scale-[0.98] text-[15px]">
                Get early access <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => demoRef.current?.scrollIntoView({ behavior: "smooth" })} className="text-[#64748b] hover:text-[#4f46e5] font-semibold px-5 py-3.5 rounded-xl transition-colors text-[15px] flex items-center gap-1.5 border border-[#e5e7eb] hover:border-[#4f46e5]/30">
                See live demo <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 flex flex-wrap gap-4">
              {["No credit card", "2-min setup", "Works immediately"].map(t => (
                <div key={t} className="flex items-center gap-1.5 text-xs text-[#94a3b8] font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" /> {t}
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, type: "spring", stiffness: 90 }} className="hidden lg:block flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 -m-3 bg-[#4f46e5]/8 rounded-3xl blur-xl" />
              <div className="relative bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Candidate Preview</span>
                  <div className="flex items-center gap-1.5 bg-[#fef9ee] border border-[#fde68a] rounded-full px-2 py-0.5">
                    <Lock className="w-2.5 h-2.5 text-[#f59e0b]" />
                    <span className="text-[9px] font-bold text-[#b45309]">Locked</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#6366f1] flex items-center justify-center text-white font-black text-base flex-shrink-0">
                    {PREVIEW_CANDIDATE.initials}
                  </div>
                  <div>
                    <div className="font-black text-[#0f172a] text-sm blur-sm select-none">Arjun R.</div>
                    <div className="text-xs text-[#64748b] mt-0.5">{PREVIEW_CANDIDATE.college}</div>
                    <div className="text-[10px] text-[#94a3b8]">{PREVIEW_CANDIDATE.field} · Year {PREVIEW_CANDIDATE.year}</div>
                  </div>
                </div>
                <div className="space-y-2.5 mb-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Profile Strength</span>
                      <span className="text-[11px] font-black text-[#10b981]">{PREVIEW_CANDIDATE.profileStrength}/100</span>
                    </div>
                    <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${PREVIEW_CANDIDATE.profileStrength}%` }} transition={{ delay: 0.8, duration: 1 }} className="h-full rounded-full" style={{ background: "#10b981" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">AI Score</span>
                      <span className="text-[11px] font-black text-[#4f46e5]">{PREVIEW_CANDIDATE.overallScore}/100</span>
                    </div>
                    <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${PREVIEW_CANDIDATE.overallScore}%` }} transition={{ delay: 1, duration: 1 }} className="h-full rounded-full" style={{ background: "#4f46e5" }} />
                    </div>
                  </div>
                </div>
                <div className="bg-[#f8fafc] border border-[#f0f4ff] rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Github className="w-3.5 h-3.5 text-[#475569]" />
                      <span className="text-[10px] font-black text-[#64748b] uppercase tracking-wider">GitHub</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#10b981]">Verified</span>
                  </div>
                  <div className="flex gap-4">
                    {[["14", "Repos"], ["47", "Stars"], ["32d", "Streak"]].map(([v, l]) => (
                      <div key={l} className="text-center">
                        <div className="text-sm font-black text-[#0f172a]">{v}</div>
                        <div className="text-[9px] text-[#94a3b8]">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {PREVIEW_CANDIDATE.skills.map(s => (
                    <span key={s} className="text-[10px] font-bold bg-[#eef2ff] text-[#4f46e5] px-2 py-1 rounded-lg">{s}</span>
                  ))}
                </div>
                <button onClick={() => setLocation("/login")} className="w-full bg-[#4f46e5] text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Unlock full profile
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-white border-b border-[#f0f4ff]"><div className="max-w-6xl mx-auto px-5"><div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#f1f5f9]">{STATS.map((s, i) => { const Icon = s.icon; return (<motion.div key={s.label} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="py-5 px-5 flex items-center gap-3"><div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}12` }}><Icon className="w-4 h-4" style={{ color: s.color }} /></div><div><p className="font-black text-[#0f172a] text-lg leading-none">{s.value}</p><p className="text-[10px] text-[#94a3b8] font-semibold mt-0.5">{s.label}</p></div></motion.div>)})}</div></div></section>

      <section className="py-20 px-5 bg-[#f8fafc] border-b border-[#f0f4ff]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-xs font-black uppercase tracking-widest text-[#f97316] mb-2">The problem</motion.p>
            <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl sm:text-[38px] font-black text-[#0f172a] leading-[1.15] mb-3">
              You're already paying for<br />5 tools that don't talk to each other.
            </motion.h2>
            <p className="text-[#64748b] max-w-lg mx-auto">Each one adds friction. None of them know if a candidate actually codes.</p>
          </div>

          <div className="flex flex-col items-center gap-6 w-full">
            {/* Mobile: vertical stacked list; Desktop: 5-col grid */}
            <div className={`w-full transition-all duration-700 ${collapsed ? "opacity-0 scale-90 pointer-events-none h-0 overflow-hidden" : ""}`}>
              {/* Desktop grid */}
              <div className="hidden sm:grid grid-cols-5 gap-3">
                {OLD_TOOLS.map((tool, i) => { const Icon = tool.icon; const isActive = activeOldTool === i; return (<motion.div key={tool.name} animate={{ scale: isActive ? 1.05 : 1, y: isActive ? -4 : 0 }} className={`bg-white rounded-2xl border-2 p-4 text-center transition-all cursor-default ${isActive ? "border-[#ef4444]/40 shadow-[0_4px_20px_rgba(239,68,68,0.12)]" : "border-[#f0f4ff]"}`}><div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ background: `${tool.color}18` }}><Icon className="w-5 h-5" style={{ color: tool.color }} /></div><div className="text-[10px] font-bold text-[#0f172a] leading-tight">{tool.name}</div><AnimatePresence>{isActive && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-[9px] text-[#ef4444] font-semibold mt-1.5 leading-tight overflow-hidden">{tool.pain}</motion.div>)}</AnimatePresence></motion.div>);})}
              </div>
              {/* Mobile: card list */}
              <div className="sm:hidden space-y-2">
                {OLD_TOOLS.map((tool, i) => { const Icon = tool.icon; const isActive = activeOldTool === i; return (
                  <motion.div key={tool.name} animate={{ x: isActive ? 4 : 0 }} className={`bg-white rounded-2xl border-2 px-4 py-3 flex items-center gap-4 transition-all ${isActive ? "border-[#ef4444]/40 shadow-[0_4px_16px_rgba(239,68,68,0.1)]" : "border-[#f0f4ff]"}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${tool.color}18` }}><Icon className="w-5 h-5" style={{ color: tool.color }} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#0f172a]">{tool.name}</div>
                      <AnimatePresence>{isActive && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-[#ef4444] font-semibold mt-0.5 overflow-hidden">{tool.pain}</motion.div>)}</AnimatePresence>
                    </div>
                    {isActive && <div className="w-2 h-2 rounded-full bg-[#ef4444] flex-shrink-0 animate-pulse" />}
                  </motion.div>
                );})}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              {!collapsed ? (
                <>
                  <div className="flex gap-1">{OLD_TOOLS.map((_, i) => (<motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="w-1.5 h-1.5 rounded-full bg-[#ef4444]/40" />))}</div>
                  <button onClick={() => setCollapsed(true)} className="flex items-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]">
                    <Sparkles className="w-4 h-4" /> Replace all 5 with ninelab
                  </button>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-[#4f46e5] rounded-3xl flex items-center justify-center shadow-[0_8px_32px_rgba(79,70,229,0.4)]">
                    <Zap className="w-10 h-10 text-white fill-white" />
                  </div>
                  <div className="text-center">
                    <div className="font-black text-[#0f172a] text-xl mb-1">ninelab</div>
                    <div className="text-[#64748b] text-sm">One platform. Everything done.</div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["Source ✓", "Screen ✓", "Score ✓", "Shortlist ✓", "Track ✓"].map(t => (<span key={t} className="text-xs font-bold bg-[#f0fdf4] border border-[#86efac] text-[#10b981] px-2.5 py-1 rounded-full">{t}</span>))}
                  </div>
                  <button onClick={() => setCollapsed(false)} className="text-xs text-[#94a3b8] hover:text-[#64748b] underline underline-offset-2">Show old stack again</button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section ref={demoRef} className="py-20 px-5 bg-white border-b border-[#f0f4ff]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-xs font-black uppercase tracking-widest text-[#4f46e5] mb-2">Live demo — try it now</motion.p>
            <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl font-black text-[#0f172a] mb-2">Paste a JD. Watch AI find your candidates.</motion.h2>
            <p className="text-[#64748b] text-sm">No sign-up needed to try. We'll show you what's waiting.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#f8fafc] border border-[#e5e7eb] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-[#94a3b8]">Job Description</span>
                {demoStep !== "idle" && <button onClick={resetDemo} className="text-xs text-[#94a3b8] hover:text-[#64748b] font-medium">Reset</button>}
              </div>
              <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 text-sm text-[#475569] font-mono leading-relaxed whitespace-pre-wrap min-h-[180px]">{SAMPLE_JD}</div>
              <AnimatePresence>
                {parsedSkills.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-3.5 h-3.5 text-[#4f46e5]" />
                      <span className="text-[11px] font-bold text-[#4f46e5] uppercase tracking-wider">AI extracted</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedSkills.map((s, i) => (<motion.span key={s} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="text-[11px] font-bold bg-[#eef2ff] text-[#4f46e5] px-2.5 py-1 rounded-lg">{s}</motion.span>))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={runDemo} disabled={demoStep !== "idle"} className="mt-4 w-full bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 text-sm">
                {demoStep === "idle" && <><Search className="w-4 h-4" /> Find matching candidates</>}
                {demoStep === "parsing" && <><Brain className="w-4 h-4 animate-pulse" /> Parsing JD requirements…</>}
                {demoStep === "matching" && <><Sparkles className="w-4 h-4 animate-spin" /> Ranking candidates by fit…</>}
                {demoStep === "done" && <><CheckCircle className="w-4 h-4" /> Matches found — sign in to unlock</>}
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-[#94a3b8]">{demoStep === "done" ? "Top matches for your JD" : "Waiting for JD…"}</span>
                {demoStep === "done" && <span className="text-[10px] font-bold text-[#10b981] bg-[#f0fdf4] border border-[#86efac] px-2 py-0.5 rounded-full">23 candidates found</span>}
              </div>

              {demoStep === "idle" && (
                <div className="bg-[#f8fafc] border-2 border-dashed border-[#e2e8f0] rounded-2xl h-[280px] flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-[#f1f5f9] rounded-2xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#cbd5e1]" />
                  </div>
                  <p className="text-sm text-[#94a3b8] font-medium text-center">Hit "Find candidates" to see<br />who matches your JD</p>
                </div>
              )}

              {(demoStep === "parsing" || demoStep === "matching") && (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white border border-[#f0f4ff] rounded-2xl p-4 animate-pulse">
                      <div className="flex gap-3 items-center mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#f1f5f9]" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-[#f1f5f9] rounded w-2/3" />
                          <div className="h-2 bg-[#f1f5f9] rounded w-1/2" />
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[#f1f5f9]" />
                      </div>
                      <div className="flex gap-2">{[1, 2, 3].map(j => <div key={j} className="h-5 bg-[#f1f5f9] rounded-lg w-16" />)}</div>
                    </div>
                  ))}
                </div>
              )}

              {demoStep === "done" && (
                <div className="space-y-3 relative">
                  {DEMO_MATCHES.map((m, i) => (
                    <AnimatePresence key={m.initials}>
                      {visibleCards > i && (
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`bg-white border-2 rounded-2xl p-4 ${i === 0 ? "border-[#4f46e5]/30 shadow-[0_4px_20px_rgba(79,70,229,0.1)]" : "border-[#f0f4ff]"}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#6366f1] flex items-center justify-center text-white font-black text-sm flex-shrink-0">{m.initials}</div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-black text-[#0f172a] text-sm ${i > 0 ? "blur-sm select-none" : ""}`}>{m.name}</div>
                              <div className="text-xs text-[#64748b]">{m.college} · {m.field} · Year {m.year}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-black text-[#10b981]">{m.match}</div>
                              <div className="text-[9px] uppercase font-bold text-[#94a3b8]">match</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {m.skills.map(s => (<span key={s} className="text-[10px] font-bold bg-[#eef2ff] text-[#4f46e5] px-2 py-0.5 rounded-lg">{s}</span>))}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-[#94a3b8]"><span>CGPA {m.cgpa}</span>{m.github && <><span>·</span><span className="flex items-center gap-0.5 text-[#10b981]"><Github className="w-3 h-3" /> GitHub verified</span></>}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ))}
                  {visibleCards >= 3 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                  )}
                  {visibleCards >= 3 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 text-center pt-2">
                      <p className="text-sm text-[#64748b] mb-3">
                        <span className="font-black text-[#0f172a]">+20 more candidates</span> matched your JD.
                      </p>
                      <button onClick={() => setLocation("/login")} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-black px-6 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto transition-all active:scale-[0.98]">
                        <Lock className="w-4 h-4" /> Sign up to unlock all profiles
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-5 bg-[#f8fafc] border-b border-[#f0f4ff]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-xs font-black uppercase tracking-widest text-[#4f46e5] mb-2">Honest comparison</motion.p>
            <motion.h2 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl font-black text-[#0f172a] mb-2">
              How does ninelab actually stack up?
            </motion.h2>
            <p className="text-[#64748b] text-sm max-w-lg mx-auto">We're not trying to replace everything. We're great at what others can't do — and we're honest about the rest.</p>
          </div>

          {/* ── Mobile: feature cards ── */}
          <div className="md:hidden space-y-3">
            {COMPARISON.map((row, i) => {
              const icon = (val: boolean | "partial" | string, isKt = false) =>
                val === true ? <Check className="w-4 h-4 text-[#10b981]" /> :
                val === false ? (isKt ? <Minus className="w-4 h-4 text-[#f59e0b]" /> : <X className="w-4 h-4 text-[#dc2626]/40" />) :
                val === "partial" ? <Minus className="w-4 h-4 text-[#f59e0b]" /> :
                <span className={`text-[11px] font-bold ${isKt ? "text-[#4f46e5]" : "text-[#64748b]"}`}>{val}</span>;
              return (
                <motion.div key={row.feature} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }} className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 pt-4 pb-3 border-b border-[#f0f4ff]">
                    <div className="text-sm font-black text-[#0f172a]">{row.feature}</div>
                    {row.note && <div className="text-[11px] text-[#94a3b8] mt-0.5">{row.note}</div>}
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-[#f0f4ff]">
                    {[
                      { label: "ninelab", val: row.kt, highlight: true, isKt: true },
                      { label: "LinkedIn", val: row.linkedin, highlight: false, isKt: false },
                      { label: "ATS Tools", val: row.ats, highlight: false, isKt: false },
                    ].map(({ label, val, highlight, isKt }) => (
                      <div key={label} className={`flex flex-col items-center py-3 gap-1 ${highlight ? "bg-[#eef2ff]/60" : ""}`}>
                        <div>{icon(val, isKt)}</div>
                        <span className={`text-[9px] font-black uppercase tracking-wider ${highlight ? "text-[#4f46e5]" : "text-[#94a3b8]"}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
            <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
              <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#10b981]" /><span className="text-[11px] text-[#64748b]">Full support</span></div>
              <div className="flex items-center gap-1.5"><Minus className="w-3.5 h-3.5 text-[#f59e0b]" /><span className="text-[11px] text-[#64748b]">Partial</span></div>
              <div className="flex items-center gap-1.5"><X className="w-3.5 h-3.5 text-[#dc2626]/40" /><span className="text-[11px] text-[#64748b]">Not available</span></div>
            </div>
          </div>

          {/* ── Desktop: full 6-column table ── */}
          <div className="hidden md:block bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden shadow-sm">
            <div className="grid text-[10px] font-black uppercase tracking-wider" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr" }}>
              <div className="px-5 py-3.5 text-[#94a3b8] bg-[#f8fafc] border-b border-[#f0f4ff]">Feature</div>
              <div className="px-3 py-3.5 text-center text-[#4f46e5] bg-[#eef2ff] border-b border-[#c7d2fe]">ninelab</div>
              <div className="px-3 py-3.5 text-center text-[#0077b5] bg-[#f8fafc] border-b border-[#f0f4ff]">LinkedIn</div>
              <div className="px-3 py-3.5 text-center text-[#64748b] bg-[#f8fafc] border-b border-[#f0f4ff]">ATS Tools</div>
              <div className="px-3 py-3.5 text-center text-[#64748b] bg-[#f8fafc] border-b border-[#f0f4ff]">Campus Drive</div>
              <div className="px-3 py-3.5 text-center text-[#64748b] bg-[#f8fafc] border-b border-[#f0f4ff]">Job Boards</div>
            </div>
            {COMPARISON.map((row, i) => {
              const renderCell = (val: boolean | "partial" | string, highlight = false, isKt = false) => {
                const base = highlight ? "bg-[#eef2ff]/60" : (i % 2 === 0 ? "" : "bg-[#fafafa]");
                const inner =
                  val === true ? <Check className="w-4 h-4 text-[#10b981] mx-auto" /> :
                  val === false ? (isKt ? <Minus className="w-4 h-4 text-[#f59e0b] mx-auto" /> : <X className="w-4 h-4 text-[#dc2626]/50 mx-auto" />) :
                  val === "partial" ? <Minus className="w-4 h-4 text-[#f59e0b] mx-auto" /> :
                  <span className={`text-[10px] font-bold ${highlight ? "text-[#4f46e5]" : "text-[#64748b]"}`}>{val}</span>;
                return <div className={`px-3 py-3.5 text-center ${base} border-b border-[#f0f4ff]`}>{inner}</div>;
              };
              return (
                <motion.div key={row.feature} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }} className="grid last:border-0" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr" }}>
                  <div className={`px-5 py-3.5 border-b border-[#f0f4ff] ${i % 2 === 0 ? "" : "bg-[#fafafa]"}`}>
                    <div className="text-sm font-bold text-[#0f172a] leading-tight">{row.feature}</div>
                    {row.note && <div className="text-[10px] text-[#94a3b8] mt-0.5 leading-tight">{row.note}</div>}
                  </div>
                  {renderCell(row.kt, true, true)}
                  {renderCell(row.linkedin)}
                  {renderCell(row.ats)}
                  {renderCell(row.campus)}
                  {renderCell(row.boards)}
                </motion.div>
              );
            })}
            <div className="px-5 py-3 bg-[#f8fafc] border-t border-[#f0f4ff] flex items-center gap-5 flex-wrap">
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Legend</span>
              <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#10b981]" /><span className="text-[11px] text-[#64748b]">Full support</span></div>
              <div className="flex items-center gap-1.5"><Minus className="w-3.5 h-3.5 text-[#f59e0b]" /><span className="text-[11px] text-[#64748b]">Partial / limited</span></div>
              <div className="flex items-center gap-1.5"><X className="w-3.5 h-3.5 text-[#dc2626]/50" /><span className="text-[11px] text-[#64748b]">Not available</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-5 bg-white">
        <div className="max-w-xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 bg-[#eef2ff] border border-[#c7d2fe] rounded-full px-4 py-1.5 mb-5">
              <Sparkles className="w-3.5 h-3.5 text-[#4f46e5]" />
              <span className="text-xs font-bold text-[#4f46e5]">Private beta — serious hiring teams only</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] mb-4 leading-[1.15]">
              Shortlist in 48 hours.<br />
              <span className="text-[#4f46e5]">Not 4 weeks.</span>
            </h2>
            <p className="text-[#64748b] mb-8 text-[15px] leading-relaxed">No credit card. No sales call. Sign in with your work email and start browsing verified talent right now.</p>
            <button onClick={() => setLocation("/login")} className="bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white font-black px-10 py-4 rounded-2xl inline-flex items-center gap-2 shadow-[0_8px_32px_rgba(79,70,229,0.25)] hover:shadow-[0_12px_40px_rgba(79,70,229,0.4)] transition-all active:scale-[0.98] text-[15px] w-full sm:w-auto justify-center">
              Request access now <ArrowRight className="w-5 h-5" />
            </button>
            <p className="mt-4 text-xs text-[#cbd5e1]">Only verified hiring teams accepted. No public sign-up.</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
