import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentProfile } from "@/hooks/useStudentProfile";

// Company/role/skill mapping is a static reference taxonomy (which stacks
// these companies are known to hire for) — not a live listing. It carries no
// salary figure or opening count, since neither can be verified per-student.
interface RoleRec {
  company: string;
  role: string;
  tier: "tier1" | "tier2" | "startup";
  triggerSkills: string[];
  logo: string;
}

const ALL_RECS: RoleRec[] = [
  // Tier 1 — Product companies
  { company: "Google", role: "SDE-1", tier: "tier1", logo: "G", triggerSkills: ["python", "java", "c++", "dsa", "algorithms", "data structures"] },
  { company: "Microsoft", role: "SDE-1", tier: "tier1", logo: "M", triggerSkills: ["java", "c#", ".net", "azure", "python", "typescript", "dsa"] },
  { company: "Amazon", role: "SDE-1", tier: "tier1", logo: "A", triggerSkills: ["java", "python", "aws", "dsa", "distributed systems"] },
  { company: "Flipkart", role: "SDE-1", tier: "tier1", logo: "F", triggerSkills: ["java", "python", "react", "dsa", "kafka", "mysql"] },
  { company: "Atlassian", role: "Software Dev", tier: "tier1", logo: "AT", triggerSkills: ["java", "python", "javascript", "react", "jira"] },
  { company: "Adobe", role: "MTS-1", tier: "tier1", logo: "AD", triggerSkills: ["java", "c++", "python", "ml", "graphics", "javascript"] },
  // Data / ML
  { company: "Google", role: "Data Analyst", tier: "tier1", logo: "G", triggerSkills: ["python", "sql", "pandas", "machine learning", "bigquery", "data analytics"] },
  { company: "Meesho", role: "Data Analyst", tier: "tier2", logo: "ME", triggerSkills: ["python", "pandas", "sql", "machine learning", "tableau", "data analytics", "numpy"] },
  { company: "Juspay", role: "ML Engineer", tier: "tier2", logo: "JP", triggerSkills: ["machine learning", "python", "tensorflow", "pytorch", "data science", "ai", "ml"] },
  // Tier 2 — Indian unicorns
  { company: "Razorpay", role: "Backend Engineer", tier: "tier2", logo: "R", triggerSkills: ["node.js", "python", "java", "golang", "go", "postgresql", "redis"] },
  { company: "Swiggy", role: "SDE-1", tier: "tier2", logo: "SW", triggerSkills: ["react", "node.js", "python", "java", "golang", "mongodb"] },
  { company: "Zomato", role: "SDE-1", tier: "tier2", logo: "Z", triggerSkills: ["react", "node.js", "python", "redis", "kafka", "mysql"] },
  { company: "PhonePe", role: "SDE-1", tier: "tier2", logo: "PP", triggerSkills: ["java", "kotlin", "spring", "mysql", "kafka", "microservices"] },
  { company: "CRED", role: "SDE-1", tier: "tier2", logo: "CR", triggerSkills: ["kotlin", "swift", "react native", "java", "ios", "android", "mobile"] },
  { company: "Zerodha", role: "Software Dev", tier: "tier2", logo: "ZE", triggerSkills: ["python", "javascript", "react", "go", "golang", "postgresql"] },
  { company: "Groww", role: "SDE-1", tier: "tier2", logo: "GR", triggerSkills: ["react", "java", "kotlin", "spring", "android", "mysql"] },
  { company: "Ola", role: "SDE-1", tier: "tier2", logo: "OL", triggerSkills: ["react", "node.js", "python", "java", "kafka", "aws"] },
  // Frontend / Full-stack
  { company: "upGrad", role: "Full Stack Dev", tier: "startup", logo: "UG", triggerSkills: ["react", "node.js", "mongodb", "express", "javascript", "typescript", "nextjs"] },
  { company: "BrowserStack", role: "SDE-1", tier: "startup", logo: "BS", triggerSkills: ["java", "javascript", "react", "selenium", "qa", "testing", "automation"] },
  { company: "Freshworks", role: "SDE-1", tier: "startup", logo: "FW", triggerSkills: ["ruby", "react", "javascript", "python", "salesforce"] },
  { company: "Postman", role: "SDE-1", tier: "startup", logo: "PM", triggerSkills: ["javascript", "typescript", "react", "node.js", "api", "rest"] },
  { company: "Hasura", role: "Backend Dev", tier: "startup", logo: "HA", triggerSkills: ["graphql", "postgresql", "haskell", "node.js", "typescript", "api"] },
  // Cloud / DevOps
  { company: "Nutanix", role: "SDE-1", tier: "tier2", logo: "NU", triggerSkills: ["kubernetes", "docker", "cloud", "aws", "azure", "devops", "linux"] },
  { company: "Druva", role: "Cloud Dev", tier: "startup", logo: "DR", triggerSkills: ["aws", "go", "golang", "kubernetes", "docker", "cloud", "devops"] },
  // Cybersec
  { company: "Rubrik", role: "SDE-1", tier: "tier2", logo: "RU", triggerSkills: ["cybersecurity", "security", "python", "c++", "networking"] },
];

function getMatchScore(rec: RoleRec, userSkills: string[]): number {
  if (!userSkills.length) return 0;
  const lower = userSkills.map(s => s.toLowerCase());
  let hits = 0;
  for (const trigger of rec.triggerSkills) {
    if (lower.some(us => us.includes(trigger) || trigger.includes(us))) hits++;
  }
  return hits / rec.triggerSkills.length;
}

// matchPct is a real skill-overlap percentage against each company's listed
// stack — it can be 0, and is never padded with an artificial floor.
function getRecommendations(userSkills: string[]): (RoleRec & { matchPct: number })[] {
  const scored = ALL_RECS.map(rec => ({
    ...rec,
    matchPct: Math.round(getMatchScore(rec, userSkills) * 100),
  }));

  if (!userSkills.length) {
    // No skills yet: show a balanced mix with an honest 0% match rather than guessing.
    return scored
      .filter(r => ["Google", "Flipkart", "Razorpay", "Swiggy", "upGrad", "Freshworks"].includes(r.company))
      .slice(0, 8);
  }

  const seen = new Set<string>();
  return scored
    .filter(r => { const k = `${r.company}|${r.role}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.matchPct - a.matchPct)
    .slice(0, 8);
}

const TIER_META = {
  tier1: { label: "Tier 1" },
  tier2: { label: "Unicorn" },
  startup: { label: "Startup" },
};

/** What a rec card seeds into generation: a target role and its skill tags.
 * No company/JD — generation is profile-driven; the company only names the file. */
export interface RecSeed {
  role: string;
  tags: string[];
  name: string;
}

export function TargetRecommendations({
  studentId,
  onGenerate,
}: {
  studentId: number;
  onGenerate: (seed: RecSeed) => void;
}) {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading, isError } = useStudentProfile(String(studentId));
  const skills = Object.keys((profile?.skills as Record<string, number> | undefined) ?? {}).map(s => s.toLowerCase());
  const hasSkills = skills.length > 0;
  const recs = isLoading && !isError ? [] : getRecommendations(isError ? [] : skills);

  if (isLoading && !isError) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-48 rounded-lg" />
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-44 rounded-2xl shrink-0" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Target Companies &amp; Roles</h2>
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted ml-auto">
          {recs.length} matches
        </span>
      </div>
      <p className="text-[12px] text-ink-muted -mt-1">Companies known to hire for this stack — match % is your skill overlap, not a live opening. Click to generate a resume aimed at that role.</p>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
        {recs.map((rec, i) => {
          const tier = TIER_META[rec.tier];
          return (
            <motion.div
              key={`${rec.company}-${rec.role}-${i}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0 w-44 bg-paper rounded-2xl shadow-soft overflow-hidden"
            >
              <div className="p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-line text-ink font-bold text-[10px]">
                    {rec.logo}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    {tier.label}
                  </span>
                </div>

                <div>
                  <p className="font-bold text-ink text-[14px] leading-tight">{rec.company}</p>
                  <p className="text-[11px] text-ink-muted font-semibold leading-tight mt-0.5">{rec.role}</p>
                </div>

                {hasSkills ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Skill match</span>
                      <span className="text-[11px] font-bold text-ink">{rec.matchPct}%</span>
                    </div>
                    <div className="h-1.5 bg-line rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${rec.matchPct}%` }} />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setLocation("/profile")}
                    className="text-[11px] font-semibold text-brand underline underline-offset-2 text-left"
                  >
                    Add skills to see your match
                  </button>
                )}

                <button
                  onClick={() => onGenerate({ role: rec.role, tags: rec.triggerSkills, name: `${rec.company} — ${rec.role}` })}
                  className="w-full h-8 rounded-full bg-brand text-white font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-transform"
                >
                  <Zap className="w-3 h-3" />
                  Generate Resume
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
