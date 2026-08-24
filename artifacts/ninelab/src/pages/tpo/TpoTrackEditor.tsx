import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { useTpoTrackEditor, useTpoTrackMutations, type TrackTemplate } from "@/hooks/useTpo";

interface EditMilestone {
  id?: number;
  kind: string;
  title: string;
  description: string;
  config: Record<string, unknown>;
}

const KIND_LABELS: Record<string, string> = {
  complete_profile: "Complete profile",
  add_skills: "Add skills",
  first_mock: "First mock interview",
  mock_series: "Several mock interviews",
  mock_score: "Reach a mock score",
  finish_course: "Finish a course",
  build_resume: "Build a resume",
  apply_jobs: "Apply to jobs",
};

export default function TpoTrackEditor() {
  const { data, isLoading, isError } = useTpoTrackEditor();
  const { create, save } = useTpoTrackMutations();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [milestones, setMilestones] = useState<EditMilestone[]>([]);
  const [addKind, setAddKind] = useState("");

  useEffect(() => {
    if (data?.track?.track) {
      setName(data.track.track.name);
      setDescription(data.track.track.description);
      setMilestones(data.track.milestones.map((m) => ({ id: m.id, kind: m.kind, title: m.title, description: m.description, config: m.config ?? {} })));
    }
  }, [data]);

  if (isLoading) return <div className="h-[400px] rounded-2xl bg-paper shadow-soft animate-pulse" />;
  if (isError || !data) return <div className="bg-paper rounded-2xl shadow-soft p-6 text-center text-[14px] text-danger">Couldn't load the track editor.</div>;

  const kinds = data.milestoneKinds ?? Object.keys(KIND_LABELS);

  // No active track yet — show the template picker.
  if (!data.track?.track) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink leading-tight" style={{ fontFamily: "var(--font-display)" }}>Choose a track</h1>
          <p className="text-[13px] text-ink-muted">Pick a starting template for your batch, then customize it. You can reorder, add, or remove milestones any time.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.templates.map((t: TrackTemplate) => (
            <div key={t.templateKey} className="bg-paper rounded-2xl shadow-soft p-4 flex flex-col">
              <p className="text-[15px] font-extrabold text-ink">{t.name}</p>
              <p className="text-[12px] text-ink-muted mt-1 flex-1">{t.description}</p>
              <p className="text-[11px] text-ink-muted mt-2">{t.milestones.length} milestones</p>
              <button
                type="button"
                disabled={create.isPending}
                onClick={() => create.mutate({ templateKey: t.templateKey })}
                className="mt-3 bg-brand text-white text-[13px] font-bold py-2 rounded-xl disabled:opacity-60"
              >
                {create.isPending ? "Setting up…" : "Use this track"}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate({ name: "Our placement track" })}
          className="text-[13px] font-bold text-brand"
        >
          Or start from a blank track →
        </button>
      </div>
    );
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= milestones.length) return;
    const next = [...milestones];
    [next[i], next[j]] = [next[j], next[i]];
    setMilestones(next);
  };
  const remove = (i: number) => setMilestones(milestones.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<EditMilestone>) => setMilestones(milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const add = () => {
    if (!addKind) return;
    setMilestones([...milestones, { kind: addKind, title: KIND_LABELS[addKind] ?? addKind, description: "", config: {} }]);
    setAddKind("");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink leading-tight" style={{ fontFamily: "var(--font-display)" }}>Track editor</h1>
          <p className="text-[13px] text-ink-muted">This is your batch's curriculum. Students see it as their milestones and next actions.</p>
        </div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate({ name, description, milestones })}
          className="shrink-0 bg-brand text-white text-[13px] font-bold px-4 py-2 rounded-xl disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="bg-paper rounded-2xl shadow-soft p-4 space-y-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Track name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl bg-canvas border border-line text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 rounded-xl bg-canvas border border-line text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
      </div>

      <div className="space-y-2.5">
        {milestones.map((m, i) => (
          <div key={m.id ?? `new-${i}`} className="bg-paper rounded-2xl shadow-soft p-3 flex items-center gap-2">
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-ink-muted disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === milestones.length - 1} className="text-ink-muted disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
            </div>
            <span className="text-[13px] font-bold text-ink-muted tabular-nums w-5 text-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <input value={m.title} onChange={(e) => update(i, { title: e.target.value })} className="w-full h-9 px-2 rounded-lg bg-canvas border border-line text-[14px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand/30" />
              <p className="text-[11px] text-ink-muted mt-1 ml-1">{KIND_LABELS[m.kind] ?? m.kind}</p>
            </div>
            <button type="button" onClick={() => remove(i)} className="text-rose-500 shrink-0 p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {milestones.length === 0 && <p className="text-[13px] text-ink-muted text-center py-6">No milestones yet — add one below.</p>}
      </div>

      <div className="bg-paper rounded-2xl shadow-soft p-3 flex items-center gap-2">
        <select value={addKind} onChange={(e) => setAddKind(e.target.value)} className="flex-1 h-10 px-3 rounded-xl bg-canvas border border-line text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/30">
          <option value="">Add a milestone…</option>
          {kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>)}
        </select>
        <button type="button" onClick={add} disabled={!addKind} className="inline-flex items-center gap-1 bg-ink text-white text-[13px] font-bold px-3 py-2 rounded-xl disabled:opacity-40">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </div>
  );
}
