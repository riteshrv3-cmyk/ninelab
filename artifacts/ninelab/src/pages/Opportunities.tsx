import { useState, useMemo, useEffect, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, ExternalLink, Target, Loader2, Search, X, Mic } from "lucide-react";
import { useCreateInterviewSession } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DOMAINS, ROLE_DESTINATIONS, type Domain, type SubDomain } from "@/data/domains";
import { useCoursePreloader, prefetchCourse } from "@/hooks/useCoursePreloader";
import { apiFetch } from "@/lib/api/authFetch";
import { Toko } from "@/components/ninelab/Toko";
import { useStudentId } from "@/hooks/useStudentId";
import { useNameGate } from "@/components/NameGate";
import { DemoSurface } from "@/components/DemoBanner";
import { PageHeader } from "@/components/PageHeader";
import { scoreBadgeClass } from "@/lib/scoreTone";
import { DEMO_MATCHED_TEASER, DEMO_STUDENT_NAME } from "@/data/demoStudent";

type OpportunityType = "jobs" | "internship" | "freelancing";

interface LiveOpportunity {
  id: string;
  title: string;
  company: string;
  logo: string | null;
  location: string;
  pay: string | null;
  postedAt: string | null;
  tags: string[];
  url: string;
  source: string;
  isSearchLink?: boolean;
  /** India-located or from an India-specific source — leads the list, badged. */
  isIndia?: boolean;
}

interface MatchedFeed {
  role: string;
  targetRole: string | null;
  /** The role was inferred, not chosen — say so rather than call it a match. */
  isGuess: boolean;
  matchedFrom: "targetRole" | "skills" | "field";
  order: OpportunityType[];
  newCount: number;
  groups: {
    kind: OpportunityType;
    label: string;
    items: (LiveOpportunity & { isNew?: boolean })[];
    /** Board search pages. Offered as plain links when a group has no real work. */
    searchLinks: { id: string; source: string; url: string }[];
  }[];
}

const GROUP_EMOJI: Record<string, string> = { jobs: "💼", internship: "🎓", freelancing: "🌍" };

function emojiFor(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("remote")) return "🌐";
  if (s.includes("naukri")) return "🇮🇳";
  if (s.includes("linkedin")) return "💼";
  if (s.includes("internshala")) return "🎓";
  if (s.includes("upwork")) return "💚";
  if (s.includes("toptal")) return "💎";
  if (s.includes("freelancer")) return "🛠";
  if (s.includes("fiverr")) return "🟢";
  return "✨";
}

/**
 * The locked card anatomy, shared by the role-drilldown feed and the
 * profile-matched preview at the top of the page: Apply top-right (direct
 * redirect, no detour), Prepare + Practice below acting on the ROLE, not the
 * individual posting. `onPrepare` is null when there's no resolvable role
 * course to generate (e.g. targetRole unset) — the button is omitted rather
 * than wired to something fabricated.
 */
function OpportunityCard({
  o, fallbackSkills, index, practicing, onPractice, onPrepare, onApply,
}: {
  o: LiveOpportunity & { isNew?: boolean };
  fallbackSkills: string[];
  index: number;
  practicing: boolean;
  onPractice: () => void;
  onPrepare: (() => void) | null;
  onApply: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.04 }}>
      <div className="bg-paper rounded-2xl shadow-soft overflow-hidden">
        <div className="p-4 relative">
          <motion.a
            whileTap={{ scale: 0.97 }}
            href={o.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onApply}
            className="absolute top-4 right-4 h-8 px-3.5 rounded-full font-bold text-[12px] bg-brand text-white flex items-center gap-1"
          >
            {o.isSearchLink ? "Search" : "Apply"} <ExternalLink className="w-3 h-3" />
          </motion.a>

          <div className="flex items-center gap-2 min-w-0 mb-2 pr-20">
            {o.logo
              ? <img src={o.logo} alt={o.company} className="w-9 h-9 rounded-lg object-cover border border-line flex-shrink-0" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              : <span className="text-2xl flex-shrink-0">{emojiFor(o.source)}</span>
            }
            <div className="min-w-0">
              <p className="text-[11px] text-ink-muted truncate">
                {o.isNew && <span className="text-brand font-bold">New · </span>}
                {o.company} · {o.source}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[14px] font-bold text-ink leading-tight line-clamp-2">{o.title}</p>
                {o.isIndia && !o.isSearchLink && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-soft text-brand shrink-0">
                    India
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-[12px] text-ink-muted mb-3">
            📍 {o.location}{o.postedAt ? ` · ${o.postedAt}` : ""}
            {o.pay && ` · ${o.pay}`}
            {o.isSearchLink && " · Opens this platform's search — not a specific posting"}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(o.tags.length ? o.tags : fallbackSkills).slice(0, 4).map(s => (
              <span key={s} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-soft text-brand">
                {s}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            {onPrepare && (
              <Button
                onClick={onPrepare}
                variant="outline"
                className="flex-1 h-11 rounded-full font-bold text-[12px] border border-line text-brand bg-paper"
              >
                <Target className="w-3.5 h-3.5 mr-1.5" /> Prepare
              </Button>
            )}
            <Button
              onClick={onPractice}
              disabled={practicing}
              variant="outline"
              className="flex-1 h-11 rounded-full font-bold text-[12px] border border-line text-brand bg-paper"
            >
              {practicing
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <Mic className="w-3.5 h-3.5 mr-1.5" />}
              Practice
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Deep-link support: `/opportunities?domain=webdev&sub=fullstack` opens straight
 * into that specialisation's live feed. Onboarding uses this to drop a new
 * student onto real jobs/internships/freelance work for the role they picked.
 * Unknown or missing ids fall back to the normal domain grid.
 */
function deepLinkSelection(): { domain: Domain | null; sub: SubDomain | null } {
  const params = new URLSearchParams(window.location.search);
  const domain = DOMAINS.find(d => d.id === params.get("domain")) ?? null;
  if (!domain) return { domain: null, sub: null };
  const sub = domain.subDomains.find(s => s.id === params.get("sub")) ?? null;
  return { domain, sub };
}

export default function Opportunities() {
  const [, setLocation] = useLocation();
  const { isDemo } = useStudentId();
  const { requireStudent } = useNameGate();
  const initialSelection = useState(deepLinkSelection)[0];
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(initialSelection.domain);
  const [selectedSubDomain, setSelectedSubDomain] = useState<SubDomain | null>(initialSelection.sub);
  const [activeTab, setActiveTab] = useState<OpportunityType>("jobs");
  const [searchQuery, setSearchQuery] = useState("");
  const [practicingId, setPracticingId] = useState<string | null>(null);
  // Global-remote section starts collapsed whenever India listings exist —
  // reset on every tab/specialisation change so it doesn't carry a stale
  // expanded state into an unrelated feed.
  const [showGlobal, setShowGlobal] = useState(false);
  useEffect(() => { setShowGlobal(false); }, [activeTab, selectedSubDomain]);

  const createInterview = useCreateInterviewSession();

  const studentId = typeof window !== "undefined" ? localStorage.getItem("studentId") : null;

  // The profile-matched "best matches for you" preview — the payoff feed that
  // sits above the domain grid. Grouped by kind, ordered by student year
  // server-side (locked spec: order-by-year, no fit numbers). Only shown at
  // the top level, when not searching or drilled into a domain.
  const matchedQuery = useQuery<MatchedFeed>({
    queryKey: ["matched-opportunities", studentId],
    queryFn: async () => {
      const r = await apiFetch(`/api/students/${studentId}/opportunities/matched`);
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    enabled: !!studentId && !selectedDomain && !selectedSubDomain,
    staleTime: 10 * 60 * 1000,
  });

  // Once the matched feed is on screen, everything in it stops being "new".
  // Marked after render (not at fetch) so a failed render never eats the
  // badge, and keyed on the data object so it fires once per fresh load.
  useEffect(() => {
    const feed = matchedQuery.data;
    if (!feed || !studentId) return;
    // Server already excludes search links from items, so everything here is
    // a real posting the student actually saw.
    const ids = feed.groups.flatMap(g => g.items.map(i => i.id));
    if (ids.length === 0) return;
    apiFetch(`/api/students/${studentId}/opportunities/mark-seen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => null);
  }, [matchedQuery.data, studentId]);

  // Apply logs activity only — never a pipeline entry. Opening a posting is
  // not the same as applying to it, and the locked spec keeps the pipeline
  // fully student-owned. Fire-and-forget so the redirect is never delayed.
  const logApply = (o: LiveOpportunity) => {
    if (!studentId || o.isSearchLink) return;
    apiFetch(`/api/students/${studentId}/activity/opportunity-opened`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: o.title, company: o.company, source: o.source, url: o.url }),
    }).catch(() => null);
  };

  // Resolve a matched card's role back to a domain/subdomain so its
  // Prepare/Practice buttons carry real course/interview context. Uses the
  // shared ROLE_DESTINATIONS mapping; null when the student's targetRole has
  // no course mapping (e.g. "Not sure") — Prepare is then hidden on that card.
  const matchedDestination = (targetRole: string | null): { domain: Domain; sub: SubDomain } | null => {
    if (!targetRole) return null;
    const dest = ROLE_DESTINATIONS[targetRole];
    if (!dest) return null;
    const domain = DOMAINS.find(d => d.id === dest.domain);
    const sub = domain?.subDomains.find(s => s.id === dest.sub);
    return domain && sub ? { domain, sub } : null;
  };

  // Practice, for this specific role, zero setup: the role name IS the
  // context — no company/JD form, per the locked card spec. contextPack
  // (server-side) layers the student's own projects/skills on top of every
  // question, so this reads as "knows me", not a generic question bank.
  const startPractice = (op: LiveOpportunity, roleLabel: string) => {
    const run = async () => {
      // Fresh id — after the NameGate creates a guest row it isn't closed over.
      const studentId = Number(localStorage.getItem("studentId") || "0");
      if (!studentId) return;
      setPracticingId(op.id);
      try {
        // A search-link "card" isn't a real posting — no real company to name,
        // so it keeps the generic role-based framing. A real posting gets
        // grounded questions instead of a placebo "Any Tech Company" script.
        const company = !op.isSearchLink && op.company && op.title
          ? `${op.company} (${op.title})`
          : `an employer hiring for the ${roleLabel} role`;
        const session = await createInterview.mutateAsync({
          data: {
            studentId,
            company,
            round: "Mixed|Standard",
          },
        });
        setLocation(`/practice/interview/${session.id}`);
      } catch {
        setPracticingId(null);
      }
    };
    requireStudent(run, { title: "Starting your interview" });
  };

  // Apply opens the real posting. For an anonymous visitor the first click
  // routes through the NameGate: create a guest row, then open the posting and
  // log the activity. An existing student's click keeps the native new-tab
  // open (no async gap that a popup blocker would eat).
  const handleApply = (o: LiveOpportunity, e: MouseEvent<HTMLAnchorElement>) => {
    if (o.isSearchLink || localStorage.getItem("studentId")) {
      logApply(o);
      return;
    }
    e.preventDefault();
    requireStudent(
      () => {
        logApply(o);
        window.open(o.url, "_blank", "noopener,noreferrer");
      },
      { title: `Applying to ${o.company}` },
    );
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as { domain: Domain; sub: SubDomain; matchedSkill?: string }[];
    const out: { domain: Domain; sub: SubDomain; matchedSkill?: string; score: number }[] = [];
    for (const d of DOMAINS) {
      const dHit = d.name.toLowerCase().includes(q);
      for (const sd of d.subDomains) {
        const nameHit = sd.name.toLowerCase().includes(q);
        const exactName = sd.name.toLowerCase() === q;
        const skillHit = sd.skills.find(s => s.toLowerCase().includes(q));
        const exactSkill = sd.skills.find(s => s.toLowerCase() === q);
        if (nameHit || skillHit || dHit) {
          let score = 0;
          if (exactName) score += 100;
          else if (nameHit && sd.name.toLowerCase().startsWith(q)) score += 60;
          else if (nameHit) score += 40;
          if (exactSkill) score += 80;
          else if (skillHit) score += 30;
          if (dHit) score += 10;
          out.push({ domain: d, sub: sd, matchedSkill: skillHit, score });
        }
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [searchQuery]);

  const jumpToSubDomain = (domain: Domain, sub: SubDomain) => {
    setSelectedDomain(domain);
    setSelectedSubDomain(sub);
    setSearchQuery("");
    prefetchCourse(sub.id, sub.name, domain.name, sub.skills);
  };

  // Silently pre-generate all 48 courses in the background
  useCoursePreloader();

  const navigateToCourse = (domain?: Domain, sub?: SubDomain) => {
    const d = domain ?? selectedDomain;
    const s = sub ?? selectedSubDomain;
    if (!d || !s) return;
    sessionStorage.setItem("courseContext", JSON.stringify({
      subDomainId: s.id,
      subDomainName: s.name,
      domainName: d.name,
      domainColor: d.color,
      domainBg: d.bg,
      domainEmoji: d.emoji,
      skills: s.skills,
    }));
    setLocation("/opportunities/course");
  };

  const goBack = () => {
    if (selectedSubDomain) {
      setSelectedSubDomain(null);
      setActiveTab("jobs");
    } else if (selectedDomain) {
      setSelectedDomain(null);
    }
  };

  const TABS: { id: OpportunityType; label: string; emoji: string }[] = [
    { id: "jobs", label: "Jobs", emoji: "💼" },
    { id: "internship", label: "Internship", emoji: "🎓" },
    { id: "freelancing", label: "Freelancing", emoji: "🌍" },
  ];

  const skillsParam = selectedSubDomain?.skills.join(",") ?? "";
  const roleParam = selectedSubDomain?.name ?? "";
  const liveQuery = useQuery<{ items: LiveOpportunity[] }>({
    queryKey: ["opportunities", activeTab, roleParam, skillsParam],
    queryFn: async () => {
      const url = `/api/opportunities?kind=${activeTab}&role=${encodeURIComponent(roleParam)}&skills=${encodeURIComponent(skillsParam)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    enabled: !!selectedSubDomain,
    staleTime: 5 * 60 * 1000,
  });

  const renderLiveCards = () => {
    if (!selectedSubDomain || !selectedDomain) return null;
    const skills = selectedSubDomain.skills.slice(0, 3);

    if (liveQuery.isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-ink" />
          <p className="text-[12px] text-ink-muted">Fetching live {activeTab}…</p>
        </div>
      );
    }

    const items = liveQuery.data?.items ?? [];
    if (!items.length) {
      return (
        <div className="text-center py-10">
          <p className="text-[14px] text-ink">No live results</p>
          <p className="text-[12px] text-ink-muted mt-1">Try another specialisation.</p>
        </div>
      );
    }

    // Search-link cards (Naukri/LinkedIn/Upwork "search this platform" cards)
    // aren't real postings — they never join the India/global split, they
    // just render last, same as before this change.
    const realItems = items.filter(o => !o.isSearchLink);
    const searchLinkItems = items.filter(o => o.isSearchLink);
    const indiaItems = realItems.filter(o => o.isIndia);
    const globalItems = realItems.filter(o => !o.isIndia);
    // Without an India source configured, indiaItems can be empty — never
    // collapse the whole feed behind a section a student then has to know to
    // expand just to see anything at all.
    const globalIsExpanded = showGlobal || indiaItems.length === 0;

    const card = (o: LiveOpportunity & { isNew?: boolean }, i: number) => (
      <OpportunityCard
        key={o.id}
        o={o}
        index={i}
        fallbackSkills={skills}
        practicing={practicingId === o.id}
        onPractice={() => startPractice(o, selectedSubDomain.name)}
        onPrepare={() => navigateToCourse()}
        onApply={(e) => handleApply(o, e)}
      />
    );

    return (
      <div className="space-y-4">
        {indiaItems.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {indiaItems.map((o, i) => card(o, i))}
          </div>
        )}

        {globalItems.length > 0 && (
          <div className="space-y-2">
            {indiaItems.length > 0 && (
              <button
                onClick={() => setShowGlobal(s => !s)}
                className="w-full flex items-center justify-between text-[12px] font-bold text-ink-muted"
              >
                <span>Global remote ({globalItems.length})</span>
                <ChevronRight className={cn("w-4 h-4 transition-transform", globalIsExpanded && "rotate-90")} />
              </button>
            )}
            {indiaItems.length === 0 && (
              <p className="text-[12px] text-ink-muted">No India listings right now — showing global remote.</p>
            )}
            {globalIsExpanded && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {globalItems.map((o, i) => card(o, i))}
              </div>
            )}
          </div>
        )}

        {searchLinkItems.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {searchLinkItems.map((o, i) => card(o, i))}
          </div>
        )}
      </div>
    );
  };

  const renderCards = () => renderLiveCards();


  return (
    <div className="min-h-screen bg-canvas pb-28">
      {/* Canopy header at the top level; sticky drilldown header once a
          domain is open (back button + tabs stay page-owned). */}
      {!selectedDomain ? (
        <PageHeader
          title="Opportunities"
          subtitle="Real jobs, internships and freelance work — updated daily"
        />
      ) : (
        <div className="sticky top-0 z-10 bg-paper px-4 pt-4 pb-2 border-b border-line">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-full border border-line bg-paper flex items-center justify-center text-ink flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-display text-[30px] lg:text-[36px] font-extrabold text-ink leading-[1.06] tracking-tight">
                {!selectedSubDomain ? selectedDomain.name : selectedSubDomain.name}
              </h1>
              <p className="type-caption text-ink-muted mt-1">
                {!selectedSubDomain
                  ? `${selectedDomain.subDomains.length} roles in this domain`
                  : "Apply, prepare with a course, or practice an interview"}
              </p>
            </div>
          </div>

          {/* Tabs — shown only at sub-domain level */}
          {selectedSubDomain && (
            <div className="flex gap-2 mt-3 pb-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[13px] font-bold border transition-colors",
                    activeTab === tab.id
                      ? "bg-brand text-white border-brand"
                      : "bg-paper text-ink-muted border-line"
                  )}
                >
                  {tab.emoji} {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Page sheet below the canopy at the top level; plain flow in drilldowns. */}
      <div className={cn("px-4", !selectedDomain ? "bg-paper rounded-t-3xl -mt-6 pt-5 min-h-[60vh]" : "pt-2")}>
        {/* mode="wait" requires exactly ONE child at a time. Level 0's search bar
            and domain grid are therefore wrapped in a single keyed child — as two
            sibling children they deadlocked the exit queue, leaving the outgoing
            level stuck at opacity:0 and the incoming one never mounting (which is
            what froze the feed when switching Jobs/Internship/Freelancing tabs). */}
        <AnimatePresence mode="wait">
          {/* Level 0 — Search bar + Domain grid */}
          {!selectedDomain && (
            <motion.div
              key="level-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search skills or roles"
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-paper border border-line type-body text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand"
                  data-testid="input-opportunity-search"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-line bg-paper flex items-center justify-center text-ink-muted"
                    data-testid="button-clear-search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {searchQuery.trim() && (
                <div className="mt-2 bg-paper rounded-2xl shadow-soft overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-[14px] text-ink">No matches</p>
                      <p className="text-[12px] text-ink-muted mt-1">Try "React", "Data", "Cloud", or browse all domains below.</p>
                    </div>
                  ) : (
                    searchResults.map(({ domain, sub, matchedSkill }, i) => (
                      <motion.button
                        key={`${domain.id}-${sub.id}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => jumpToSubDomain(domain, sub)}
                        className={cn(
                          "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
                          i !== searchResults.length - 1 && "border-b border-line"
                        )}
                        data-testid={`search-result-${sub.id}`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center text-xl shrink-0">
                          {domain.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-ink text-[14px] truncate">{sub.name}</p>
                          <p className="text-[11px] text-ink-muted truncate">
                            <span>{domain.name}</span>
                            {matchedSkill && (
                              <span> · {matchedSkill}</span>
                            )}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                      </motion.button>
                    ))
                  )}
                </div>
              )}
            </div>

            {!searchQuery.trim() && (
            <div>
              {/* Matched for you — the payoff feed. Real work for this
                  student's own role, before any browsing decision is asked
                  of them. Grouped, never scored: the locked spec is
                  grouping-only, no fit percentages. */}
              {/* Skeleton shaped like the feed it replaces (group label + a
                  2-up grid of 173px cards), not a bare spinner row. The old
                  one-line spinner let the pipeline card and domain grid render
                  at the top of the page, then the resolved feed inserted
                  ~1345px above them — a 0.52 CLS, five times the 0.1 budget. */}
              {matchedQuery.isLoading && (
                <div className="mb-6" data-testid="matched-feed-skeleton">
                  <div className="flex items-center gap-2.5 mb-4 px-1">
                    <Toko pose="think" size={30} className="shrink-0" />
                    <p className="text-[12px] text-ink-muted">Toko is checking the boards…</p>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-muted" />
                  </div>
                  {[0, 1].map((g) => (
                    <div key={g} className="mb-4">
                      <Skeleton className="h-3.5 w-24 mb-2 ml-1 rounded-full" />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {[0, 1].map((c) => (
                          <Skeleton key={c} className="h-[173px] w-full rounded-2xl" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {matchedQuery.data && (() => {
                const feed = matchedQuery.data;
                const dest = matchedDestination(feed.targetRole);
                const totalReal = feed.groups.reduce((n, g) => n + g.items.length, 0);
                return (
                  <div className="mb-6">
                    <div className="flex items-baseline justify-between mb-1 px-1">
                      <p className="text-display text-[15px] font-extrabold text-ink">
                        {feed.isGuess ? "A place to start" : "Matched for you"}
                        {feed.newCount > 0 && (
                          <span className="ml-2 text-[11px] font-bold text-brand bg-brand-soft rounded-full px-2 py-0.5 align-middle">
                            {feed.newCount} new
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-ink-muted">{feed.role}</p>
                    </div>

                    {/* An inferred role is never presented as a match. Saying
                        so is what makes the fix honest rather than just
                        non-empty. */}
                    <p className="text-[12px] text-ink-muted mb-3 px-1">
                      {feed.isGuess
                        ? <>Showing {feed.role} work while you decide. <button onClick={() => setLocation("/profile")} className="text-brand font-semibold underline">Pick your goal</button> to sharpen this.</>
                        : <>Live {feed.role} openings, updated daily.</>}
                    </p>

                    {feed.groups.map(group => (
                      <div key={group.kind} className="mb-4">
                        <button
                          onClick={() => {
                            if (!dest) return;
                            setSelectedDomain(dest.domain);
                            setSelectedSubDomain(dest.sub);
                            setActiveTab(group.kind);
                          }}
                          className="w-full flex items-center justify-between py-3.5 px-1 text-left"
                        >
                          <p className="text-[12px] font-bold text-ink-muted uppercase tracking-wider">
                            {GROUP_EMOJI[group.kind]} {group.label}
                          </p>
                          {dest && group.items.length > 0 && <ChevronRight className="w-4 h-4 text-ink-muted" />}
                        </button>
                        {group.items.length > 0 ? (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {group.items.map((o, i) => (
                              <OpportunityCard
                                key={o.id}
                                o={o}
                                index={i}
                                fallbackSkills={dest?.sub.skills ?? []}
                                practicing={practicingId === o.id}
                                onPractice={() => startPractice(o, dest?.sub.name ?? feed.role)}
                                onPrepare={dest ? () => navigateToCourse(dest.domain, dest.sub) : null}
                                onApply={(e) => handleApply(o, e)}
                              />
                            ))}
                          </div>
                        ) : (
                          /* Nothing real today. Said plainly, with the boards
                             offered as plain links — deliberately not cards
                             with Apply buttons, which is what made a search
                             redirect read as a job. */
                          <div className="bg-paper rounded-2xl shadow-soft p-4 flex gap-3">
                            <Toko pose="shrug" size={36} className="shrink-0 mt-0.5" />
                            <div className="min-w-0">
                            <p className="text-[13px] text-ink font-semibold mb-1">
                              No {group.label.toLowerCase()} for {feed.role} today.
                            </p>
                            <p className="text-[12px] text-ink-muted">
                              We check every day — this fills up as new postings appear.
                              {group.searchLinks.length > 0 && " Meanwhile, search directly on "}
                              {group.searchLinks.map((l, i) => (
                                <span key={l.id}>
                                  {i > 0 && (i === group.searchLinks.length - 1 ? " or " : ", ")}
                                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brand font-semibold underline">
                                    {l.source}
                                  </a>
                                </span>
                              ))}
                              {group.searchLinks.length > 0 && "."}
                            </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {totalReal === 0 && (
                      <p className="text-[12px] text-ink-muted px-1">
                        Nothing live for {feed.role} right now. Explore the domains below to find a role with more openings.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Held back until the feed resolves. Mounting these while the
                  feed is still loading is what put them at the top of the page
                  and made the feed's arrival a half-viewport shift; mounting
                  them in the same commit as the feed costs no shift at all. */}
              {!matchedQuery.isLoading && (
              <>
              {/* Step 2 -> Step 3 bridge: once a matched job looks right, the
                  next move in the pipeline is rehearsing it. Points at the Prep
                  page (not a live interview) so it reads as "go to the next
                  step", matching the per-card instant-Practice power action. */}
              <button
                onClick={() => setLocation("/practice")}
                className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-paper shadow-soft text-left transition-colors"
                data-testid="link-practice-prep"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center text-lg shrink-0">
                  🎤
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink text-[14px]">Practice for these interviews</p>
                  <p className="text-[11px] text-ink-muted">Found a fit? Rehearse it with a mock interview in Prep</p>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
              </button>

              <button
                onClick={() => setLocation("/pipeline")}
                className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-paper shadow-soft text-left transition-colors"
                data-testid="link-my-pipeline"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center text-lg shrink-0">
                  🎯
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink type-body">My Pipeline</p>
                  <p className="type-micro text-ink-muted">Paste a job post or drive link — we check scam risk, eligibility and fit</p>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
              </button>

              <p className="text-[12px] font-bold text-ink-muted uppercase tracking-wider mb-2 px-1">
                Explore {DOMAINS.length} domains
              </p>
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {DOMAINS.map((domain, i) => (
                  <motion.button
                    key={domain.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setSelectedDomain(domain)}
                    className="rounded-2xl p-3 flex flex-col items-center text-center gap-1.5 bg-brand-soft transition-colors"
                  >
                    <span className="text-3xl">{domain.emoji}</span>
                    <span className="text-[11px] font-bold leading-tight text-brand">
                      {domain.name}
                    </span>
                  </motion.button>
                ))}
              </div>

              {/* Explore mode: a believable "matched for you" strip from
                  fixtures. Lives BELOW the live explore grid — real content
                  wins the fold — compressed to one horizontal-scroll row.
                  DemoSurface carries the banner + demo signposting here. */}
              {isDemo && (
                <div className="mt-8">
                  <DemoSurface className="mb-4">
                    <p className="text-display type-body font-extrabold text-ink mb-3 px-1">
                      Sample matches for {DEMO_STUDENT_NAME.split(" ")[0]}
                    </p>
                    <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x pb-2">
                      {DEMO_MATCHED_TEASER.map((m, i) => (
                        <motion.button
                          key={`${m.company}-${i}`}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i, 8) * 0.04 }}
                          onClick={() =>
                            requireStudent(() => {}, {
                              title: `Applying to ${m.company}`,
                            })
                          }
                          className="snap-start shrink-0 w-[240px] text-left bg-paper rounded-2xl shadow-soft border border-line p-4"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="min-w-0">
                              <p className="type-micro text-ink-muted truncate">{m.company}</p>
                              <p className="type-caption font-bold text-ink leading-tight line-clamp-2">{m.role}</p>
                            </div>
                            <span className={cn("type-micro font-bold px-2 py-0.5 rounded-full shrink-0", scoreBadgeClass(m.matchPct))}>
                              {m.matchPct}% match
                            </span>
                          </div>
                          <p className="type-micro text-ink-muted">📍 {m.location}</p>
                        </motion.button>
                      ))}
                    </div>
                  </DemoSurface>
                </div>
              )}
              </>
              )}
            </div>
            )}
            </motion.div>
          )}

          {/* Level 1 — Sub-domain list */}
          {selectedDomain && !selectedSubDomain && (
            <motion.div
              key="subdomains"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-2"
            >
              {/* Domain banner */}
              <div className="rounded-2xl bg-paper shadow-soft p-4 mb-4 flex items-center gap-3">
                <span className="text-4xl">{selectedDomain.emoji}</span>
                <div>
                  <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Domain</p>
                  <p className="text-[18px] font-extrabold text-ink">{selectedDomain.name}</p>
                  <p className="text-[12px] text-ink-muted">{selectedDomain.subDomains.length} specialisations</p>
                </div>
              </div>

              {selectedDomain.subDomains.map((sd, i) => (
                <motion.button
                  key={sd.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSelectedSubDomain(sd);
                    // Eagerly generate the course in the background so that
                    // by the time the student clicks "Prepare" on a job card
                    // the Course page loads from cache in <1s.
                    prefetchCourse(sd.id, sd.name, selectedDomain.name, sd.skills);
                  }}
                  className="w-full bg-paper shadow-soft rounded-2xl p-4 flex items-center justify-between text-left"
                >
                  <div>
                    <p className="font-bold text-ink text-[15px]">{sd.name}</p>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {sd.skills.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-line text-ink-muted">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-line flex items-center justify-center flex-shrink-0 ml-3">
                    <ChevronRight className="w-4 h-4 text-ink" />
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Level 2 — Opportunity cards.
              Keyed on the level, NOT on activeTab: switching Jobs/Internship/
              Freelancing should swap the list in place, not unmount and remount
              the whole level. Re-keying per tab made each switch wait on an exit
              animation before the new tab could mount — a needless dependency
              that leaves the feed blank if that animation never completes (e.g.
              the tab is backgrounded, which suspends requestAnimationFrame).
              The per-card stagger below still animates on every refetch. */}
          {selectedSubDomain && (
            <motion.div
              key="cards"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              {/* Sub-domain + type badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{selectedDomain!.emoji}</span>
                <div>
                  <p className="text-[12px] font-bold text-ink">
                    {selectedDomain!.name} › {selectedSubDomain.name}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {activeTab === "jobs" ? "Full-time roles" : activeTab === "internship" ? "Internship openings" : "Freelance gigs"}
                  </p>
                </div>
              </div>

              {renderCards()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
