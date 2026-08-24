import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, BookmarkCheck, Trash2, Github, Linkedin, Globe, Download, Users, ExternalLink } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/recruiter-portal", "");

interface CandidateSnap {
  id: number;
  name: string;
  college: string;
  field: string;
  year: number;
  city: string;
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  profileStrength: number;
  commitmentScore: number;
  overallScore: number;
  workMode?: string;
  expectedSalary?: string;
  skills: Record<string, number>;
  openToWork: boolean;
}

export default function Shortlist() {
  const [, setLocation] = useLocation();
  const [ids, setIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("shortlist") || "[]"); } catch { return []; }
  });
  const [candidates, setCandidates] = useState<CandidateSnap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return; }
    Promise.all(ids.map(id => fetch(`/api/students/${id}/full-profile`).then(r => r.json())))
      .then(setCandidates).finally(() => setLoading(false));
  }, []);

  const remove = (id: number) => {
    const updated = ids.filter(i => i !== id);
    setIds(updated);
    setCandidates(c => c.filter(s => s.id !== id));
    localStorage.setItem("shortlist", JSON.stringify(updated));
  };

  const exportCSV = () => {
    const rows = [
      ["Name", "College", "Field", "Year", "City", "Work Mode", "Expected Salary", "Profile %", "Commitment", "AI Score", "GitHub", "LinkedIn", "Portfolio"],
      ...candidates.map(c => [
        c.name, c.college, c.field, c.year, c.city,
        c.workMode || "", c.expectedSalary || "",
        c.profileStrength, c.commitmentScore, c.overallScore,
        c.githubUrl || "", c.linkedinUrl || "", c.portfolioUrl || "",
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ninelab_shortlist.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const recruiter = JSON.parse(localStorage.getItem("recruiter") || "{}");

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#f0f4ff] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => setLocation("/talent")} className="flex items-center gap-2 text-sm font-bold text-[#64748b] hover:text-[#0f172a] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Talent Pool
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-[#4f46e5]" />
              <span className="font-black text-[#0f172a]">Shortlist</span>
            </div>
          </div>
          {candidates.length > 0 && (
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] text-white rounded-xl text-sm font-bold hover:bg-[#3730a3] transition-colors">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#0f172a]">Your Shortlist</h1>
          <p className="text-sm text-[#94a3b8] mt-1">{recruiter.company} · {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : candidates.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
            <div className="w-16 h-16 bg-[#f8fafc] rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-[#d8b4fe]" />
            </div>
            <h2 className="text-xl font-black text-[#0f172a] mb-2">No candidates shortlisted yet</h2>
            <p className="text-sm text-[#94a3b8] mb-6">Browse the talent pool and bookmark candidates you're interested in</p>
            <button onClick={() => setLocation("/talent")} className="bg-[#4f46e5] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#3730a3] transition-colors">
              Browse Talent Pool
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {candidates.map((c, i) => {
              const initials = c.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
              const topSkills = Object.entries(c.skills || {}).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 3);
              return (
                <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl border border-[#f0f4ff] p-5 flex items-center gap-4 hover:border-[#4f46e5]/20 transition-colors group">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#6366f1] flex items-center justify-center text-white font-black text-base flex-shrink-0">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLocation(`/student/${c.id}`)}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-black text-[#0f172a] text-base group-hover:text-[#4f46e5] transition-colors">{c.name}</h3>
                      {c.openToWork && <span className="flex items-center gap-1 text-[10px] font-black text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 bg-[#10b981] rounded-full" />OPEN</span>}
                    </div>
                    <p className="text-xs text-[#64748b] truncate">{c.college} · {c.field} · Year {c.year}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-[#94a3b8]">Profile <span className="font-black text-[#4f46e5]">{c.profileStrength}%</span></span>
                      <span className="text-xs text-[#94a3b8]">Commit <span className="font-black text-[#4f46e5]">{c.commitmentScore}</span></span>
                      {c.expectedSalary && <span className="text-xs font-bold text-[#f59e0b]">{c.expectedSalary}</span>}
                      {c.workMode && <span className="text-xs font-bold text-[#64748b]">{c.workMode}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {topSkills.map(([skill]) => (
                        <span key={skill} className="text-[10px] font-bold bg-[#f8fafc] text-[#4f46e5] px-2 py-0.5 rounded-md">{skill}</span>
                      ))}
                    </div>
                  </div>

                  {/* Links + remove */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.githubUrl && <a href={c.githubUrl} target="_blank" rel="noopener noreferrer" className="text-[#94a3b8] hover:text-[#0f172a] transition-colors" onClick={e => e.stopPropagation()}><Github className="w-4 h-4" /></a>}
                    {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[#94a3b8] hover:text-[#0077b5] transition-colors" onClick={e => e.stopPropagation()}><Linkedin className="w-4 h-4" /></a>}
                    <button onClick={() => setLocation(`/student/${c.id}`)} className="text-[#94a3b8] hover:text-[#4f46e5] transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(c.id)} className="text-[#94a3b8] hover:text-[#ef4444] transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {candidates.length > 0 && (
          <div className="mt-6 p-5 bg-gradient-to-br from-[#4f46e5]/5 to-[#6366f1]/5 border border-[#e0e7ff] rounded-2xl">
            <h3 className="font-black text-[#0f172a] mb-2">Next steps</h3>
            <div className="space-y-2 text-sm text-[#64748b]">
              <p>✓ Export to CSV to share with your team</p>
              <p>✓ Click any candidate to see full profile & request contact info</p>
              <p>✓ All candidates have opted in to job opportunities</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
