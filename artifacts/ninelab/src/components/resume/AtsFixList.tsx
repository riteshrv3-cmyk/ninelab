import { useState } from "react";
import { Plus, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/api/authFetch";

interface AtsFixListProps {
  studentId: number;
  resumeId: number;
  atsReport: {
    scorePct: number;
    matched: { term: string; where: string }[];
    missing: { term: string; importance: string }[];
  };
  /** Coverage from the evidence map — used to classify missing terms. */
  coverage?: { jdTerm: string; status: string }[];
  content: { skillSections?: { category: string; items: string | string[] }[] };
  onUpdated: (updated: unknown) => void;
}

function classifyTerm(term: string, coverage?: { jdTerm: string; status: string }[]) {
  if (!coverage) return "gap";
  const row = coverage.find(c => c.jdTerm.toLowerCase() === term.toLowerCase());
  if (!row) return "gap";
  return row.status === "strong" || row.status === "partial" ? "have" : "gap";
}

export function AtsFixList({ studentId, resumeId, atsReport, coverage, content, onUpdated }: AtsFixListProps) {
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const { missing } = atsReport;
  const haveTerms = missing.filter(m => classifyTerm(m.term, coverage) === "have" && !added.has(m.term));
  const gapTerms = missing.filter(m => classifyTerm(m.term, coverage) === "gap");

  const displayGaps = showAll ? gapTerms : gapTerms.slice(0, 4);

  async function addToSkills(term: string) {
    setAdding(prev => ({ ...prev, [term]: true }));
    try {
      const existing = content.skillSections ?? [];
      // Append to the last existing category or create a "Technical Skills" category.
      let updated: { category: string; items: string[] }[];
      if (existing.length === 0) {
        updated = [{ category: "Technical Skills", items: [term] }];
      } else {
        // Find a catch-all category; fall back to the last one.
        const targetIdx = existing.findIndex(s =>
          /technical|skills|technologies|tools/i.test(s.category)
        );
        const idx = targetIdx >= 0 ? targetIdx : existing.length - 1;
        updated = existing.map((s, i) => ({
          category: s.category,
          items: [...(Array.isArray(s.items) ? s.items : s.items.split(", ").filter(Boolean)), ...(i === idx ? [term] : [])],
        }));
      }
      const r = await apiFetch(`/api/students/${studentId}/resumes/${resumeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { skillSections: updated } }),
      });
      if (r.ok) {
        const saved = await r.json();
        setAdded(prev => new Set([...prev, term]));
        onUpdated(saved);
      }
    } finally {
      setAdding(prev => ({ ...prev, [term]: false }));
    }
  }

  if (haveTerms.length === 0 && gapTerms.length === 0) return null;

  return (
    <div className="space-y-3 text-[12px]">
      {haveTerms.length > 0 && (
        <div className="rounded-xl border border-brand/20 bg-brand-soft p-3 space-y-2">
          <p className="font-semibold text-ink">You have these — just not listed:</p>
          {haveTerms.map(m => (
            <div key={m.term} className="flex items-center justify-between gap-2">
              <span className="text-ink-muted">{m.term}</span>
              <button
                onClick={() => addToSkills(m.term)}
                disabled={adding[m.term]}
                className="flex items-center gap-1 text-brand font-semibold hover:opacity-80 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
                {adding[m.term] ? "Adding…" : "Add to Skills"}
              </button>
            </div>
          ))}
        </div>
      )}

      {gapTerms.length > 0 && (
        <div className="rounded-xl border border-line bg-canvas p-3 space-y-2">
          <p className="font-semibold text-ink">Skills to build for this role:</p>
          {displayGaps.map(m => (
            <div key={m.term} className="flex items-center justify-between gap-2">
              <div>
                <span className="text-ink-muted">{m.term}</span>
                {m.importance === "must" && (
                  <span className="ml-2 text-[10px] font-bold text-danger uppercase tracking-wide">required</span>
                )}
              </div>
              <a
                href={`/chat?prompt=How+do+I+learn+${encodeURIComponent(m.term)}+for+a+${encodeURIComponent("software")}+role?`}
                className="flex items-center gap-1 text-ink-muted hover:text-ink font-medium"
              >
                <BookOpen className="w-3 h-3" />
                Learn
              </a>
            </div>
          ))}
          {gapTerms.length > 4 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="flex items-center gap-1 text-brand font-semibold mt-1"
            >
              {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showAll ? "Show fewer" : `Show ${gapTerms.length - 4} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
