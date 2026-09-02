import { useEffect, useRef, useState } from "react";
import { Search, Check } from "lucide-react";
import { apiFetch, apiFetchJson } from "@/lib/api/authFetch";

interface CollegeOption { id: number; name: string; city: string }

/**
 * Searchable college picker. Selecting one sets the student's real collegeId
 * (POST /students/:id/college) so the TPO dashboard can scope to them, and
 * calls onPicked so the surrounding free-text college field stays in sync.
 */
export function CollegePicker({ studentId, onPicked }: { studentId: string | number | null; onPicked: (name: string) => void }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<CollegeOption[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const rows = await apiFetchJson<CollegeOption[]>(`/api/colleges${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
        setOptions(rows);
      } catch {
        setOptions([]);
      }
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, open]);

  const select = async (c: CollegeOption) => {
    if (!studentId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/students/${studentId}/college`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collegeId: c.id }),
      });
      setPicked(c.name);
      onPicked(c.name);
      setOpen(false);
      setQ("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-bold text-ink-muted uppercase tracking-wider">Find your college (links you to your TPO)</p>
      <div className="relative">
        <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          placeholder={picked ? `Linked: ${picked}` : "Search registered colleges"}
          className="pl-9 pr-3 h-11 w-full rounded-xl bg-canvas border border-line text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        {picked && !open && (
          <Check className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />
        )}
        {open && options.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-paper rounded-xl shadow-lg border border-line max-h-56 overflow-auto">
            {options.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={saving}
                onClick={() => select(c)}
                className="w-full text-left px-3 py-2 hover:bg-canvas disabled:opacity-60"
              >
                <p className="text-[14px] font-semibold text-ink">{c.name}</p>
                {c.city && <p className="text-[13px] text-ink-muted">{c.city}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
