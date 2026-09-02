import { motion } from "framer-motion";
import { X, Github, Linkedin, Globe, Phone, BarChart2, Edit2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { apiFetch, setGuestToken } from "@/lib/api/authFetch";
import { useStudentId } from "@/hooks/useStudentId";
import { useIsGuest, GuestSavedChip } from "@/components/GuestSavedChip";
import { useNameGate } from "@/components/NameGate";

interface StudentProfile {
  id: number;
  name: string;
  college: string;
  field: string;
  year: number;
  bio: string;
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  phone: string;
  profileStrength: number;
  overallScore: number;
  commitmentScore: number;
  xp: number;
  streakCount: number;
  level: number;
  openToWork: boolean;
  skills: Record<string, number>;
  projects: Array<{ title: string; description: string; techStack: string[] }>;
  certifications: Array<{ name: string; issuer: string }>;
}

function StrengthArc({ value }: { value: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ * 0.75;
  const gap = circ - dash;

  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#ecedf3" strokeWidth="8" strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" transform="rotate(-135 50 50)" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#4a55c7" strokeWidth="8" strokeDasharray={`${dash} ${gap + circ * 0.25}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" transform="rotate(-135 50 50)" />
      <text x="50" y="47" textAnchor="middle" className="fill-[#1a1d2e]" fontSize="16" fontWeight="800">{value}</text>
      <text x="50" y="62" textAnchor="middle" className="fill-[#9aa0ae]" fontSize="8">/ 100</text>
    </svg>
  );
}

export function ProfileSidebar({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { isDemo } = useStudentId();
  const isGuest = useIsGuest();
  const { requireStudent } = useNameGate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("studentId");
    if (!id) return;
    apiFetch(`/api/students/${id}/full-profile`)
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => null);
  }, []);

  const startProfile = () => {
    onClose();
    requireStudent(() => setLocation("/profile"), { title: "Start your profile" });
  };

  const goToProfile = () => {
    onClose();
    setLocation("/profile");
  };

  const logout = async () => {
    await signOut();
    localStorage.removeItem("studentId");
    localStorage.removeItem("studentName");
    localStorage.removeItem("clerkUserId");
    localStorage.removeItem("clerkEmail");
    setGuestToken(null);
    onClose();
    setLocation("/");
  };

  const initials = profile
    ? profile.name.split(/\s+/).map((p) => p[0]).join("").substring(0, 2).toUpperCase()
    : "?";

  const GENERIC_SKILLS = new Set(["dsa","data structures","algorithms","problem solving","communication","teamwork","leadership","time management","critical thinking","git","linux","python","networking"]);
  const topSkills = Object.entries(profile?.skills ?? {})
    .filter(([name]) => !GENERIC_SKILLS.has(name.toLowerCase().trim()))
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-ink/40"
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed right-0 top-0 bottom-0 z-[51] w-[92%] max-w-sm bg-canvas flex flex-col overflow-hidden"
      >
        {/* Canopy header */}
        <div className="bg-brand px-5 pt-12 pb-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-2xl font-extrabold text-white">
                {initials}
              </div>
              {profile?.openToWork && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-done border-2 border-brand" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[20px] font-extrabold text-white leading-tight truncate">{profile?.name || (isDemo ? "Explore mode" : "Loading...")}</h2>
              <p className="text-[13px] text-white/70 mt-0.5 truncate">{profile?.college}</p>
              <p className="text-[13px] text-white/70">{profile?.field} · Year {profile?.year}</p>
            </div>
          </div>

          {profile?.openToWork && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-done" />
              <span className="text-[13px] font-bold text-white">Open to Opportunities</span>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-canvas -mt-4 rounded-t-3xl pt-2">

          {isDemo ? (
            /* Anonymous explore-mode visitor — no row yet. One clear CTA that
               opens the NameGate, rather than a wall of empty score cards. */
            <div className="px-4 pt-4 pb-6">
              <div className="bg-paper rounded-2xl shadow-soft p-5 text-center">
                <h3 className="text-[15px] font-extrabold text-ink mb-1">Start your profile</h3>
                <p className="text-[13px] text-ink-muted mb-4">
                  Create your space to save resumes, mock scores, and matched jobs — no signup needed.
                </p>
                <button
                  onClick={startProfile}
                  className="w-full bg-brand text-white font-bold py-3 rounded-full active:scale-95 transition-transform"
                >
                  Get started
                </button>
                <button
                  onClick={() => { onClose(); setLocation("/sign-in"); }}
                  className="w-full mt-2 text-[13px] font-semibold text-brand py-2"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </div>
          ) : (
          <>
          {/* Guest (row exists but not claimed) — device-only save + upgrade. */}
          {isGuest && (
            <div className="px-4 pt-4">
              <GuestSavedChip />
            </div>
          )}

          {/* Score + Strength */}
          <div className="px-4 pt-4">
            <div className="bg-paper rounded-2xl shadow-soft p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-[14px] font-extrabold text-ink mb-3">Profile Strength</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-brand-soft rounded-xl p-2.5 text-center">
                      <p className="text-lg font-extrabold text-brand">{profile ? Math.round(profile.overallScore) : "—"}</p>
                      <p className="text-[10px] text-ink-muted font-bold uppercase">AI Score</p>
                    </div>
                    <div className="bg-brand-soft rounded-xl p-2.5 text-center">
                      {profile?.githubUrl ? (
                        <>
                          <p className="text-lg font-extrabold text-brand">{profile?.commitmentScore ?? "—"}</p>
                          <p className="text-[10px] text-ink-muted font-bold uppercase">Commitment</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-extrabold text-ink-muted">—</p>
                          <p className="text-[10px] text-ink-muted font-bold uppercase">Link GitHub</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <StrengthArc value={profile?.profileStrength ?? 0} />
              </div>
            </div>
          </div>

          {/* Links */}
          {profile && (profile.githubUrl || profile.linkedinUrl || profile.portfolioUrl || profile.phone) && (
            <div className="px-4 pt-3">
              <div className="bg-paper rounded-2xl shadow-soft p-4 space-y-2.5">
                {[
                  { icon: Github, value: profile.githubUrl },
                  { icon: Linkedin, value: profile.linkedinUrl },
                  { icon: Globe, value: profile.portfolioUrl },
                  { icon: Phone, value: profile.phone },
                ].filter(l => l.value).map(({ icon: Icon, value }, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0 text-ink" />
                    <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
                      className="text-[13px] font-bold text-ink truncate flex-1">
                      {value.replace(/^https?:\/\/(www\.)?/, "")}
                      <ExternalLink className="w-2.5 h-2.5 inline-block ml-0.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {profile?.bio && (
            <div className="px-4 pt-3">
              <div className="bg-paper rounded-2xl shadow-soft p-4">
                <h3 className="text-[14px] font-extrabold text-ink mb-2">About</h3>
                <p className="text-[13px] text-ink-muted leading-relaxed">{profile.bio}</p>
              </div>
            </div>
          )}

          {/* Top skills */}
          {topSkills.length > 0 && (
            <div className="px-4 pt-3">
              <div className="bg-paper rounded-2xl shadow-soft p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="w-4 h-4 text-ink" />
                  <h3 className="text-[14px] font-extrabold text-ink">Top Skills</h3>
                </div>
                <div className="space-y-2">
                  {topSkills.map(([skill, val]) => (
                    <div key={skill} className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-ink w-20 shrink-0 truncate">{skill}</span>
                      <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${val}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full bg-brand"
                        />
                      </div>
                      <span className="text-[10px] font-extrabold text-ink w-6 text-right">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Projects count + Certs count */}
          {profile && (
            <div className="px-4 pt-3">
              <div className="bg-paper rounded-2xl shadow-soft p-4">
                <div className="flex justify-around">
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-ink">{profile.projects?.length ?? 0}</p>
                    <p className="text-[10px] text-ink-muted font-bold uppercase">Projects</p>
                  </div>
                  <div className="w-px bg-line" />
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-ink">{profile.certifications?.length ?? 0}</p>
                    <p className="text-[10px] text-ink-muted font-bold uppercase">Certifications</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-4 pt-4 pb-6">
            <button
              onClick={goToProfile}
              className="w-full bg-brand text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Edit2 className="w-4 h-4" />
              Edit Full Profile
            </button>
            <button
              onClick={logout}
              className="w-full mt-3 bg-paper text-danger font-bold py-3.5 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <X className="w-4 h-4" />
              Log out
            </button>
          </div>
          </>
          )}
        </div>
      </motion.div>
    </>
  );
}
