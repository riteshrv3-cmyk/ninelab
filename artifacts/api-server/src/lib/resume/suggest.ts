import type { studentsTable } from "@workspace/db";
import type { Bullet, DensityBudget, EvidenceLedger, ExperienceEntry, ProjectEntry, ResumeDocument, SectionKey } from "@workspace/resume-core";
import { callJson } from "./callJson";
import { unsupportedTech } from "./gate";
import { parsePeriod } from "./stage3-draft";
import { asObjectArray, ShapeError } from "./shapes";
import { introducesNewNumbers, numberTokens } from "./numbers";
import { overlap } from "./similarity";
import { logger } from "../logger";

type Student = typeof studentsTable.$inferSelect;

interface ProjectRow { title: string; description?: string; techStack?: string[]; githubUrl?: string | null; liveUrl?: string | null }
interface ExperienceRow { company: string; role: string; period?: string; bullets?: string[] }

const MIN_BULLETS = 2;

const SYSTEM_PROMPT = `You help an Indian engineering student whose profile is thin. For each entry
below, draft resume bullets the student will review: each one is shown to them marked "Suggested,
confirm this is true" and is not used until they confirm or edit it.

Rules for every bullet:
- Start with a different past-tense action verb (Built, Designed, Implemented, Integrated, Created,
  Configured, Developed, Wrote, Tested, Deployed).
- 12-24 words, active voice, no first person.
- Describe what was built and how, using ONLY the technologies named in that entry's facts.
- Use a number ONLY if that exact number appears in the entry's facts. Never invent a metric,
  percentage or count; the student adds real numbers later.
- No claims of results you cannot see in the facts (no "improved performance", no user counts).
- Each bullet must cover a DIFFERENT aspect than the bullets already on the resume (e.g. the
  data model, a specific feature, testing, deployment, the tools used), never a rephrasing.
- Plain, specific, believable. Never "robust", "scalable", "seamless", "passionate".

Respond with valid JSON only.`;

interface ThinItem {
  ref: string;
  existing: string[];
  kind: "experience" | "projects";
  facts: string;
  need: number;
  docIndex: number | null;
  row: ExperienceRow | ProjectRow;
}

const same = (a: string | undefined, b: string | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * For entries with fewer than 2 bullets (or dropped entirely because nothing
 * verifiable could be written), asks the model for clearly-marked suggestions.
 * They carry the entry's own ledger ID, may not contain numbers or tech the
 * profile never mentions, and stay out of exports and scores until confirmed.
 */
export async function suggestForThinEntries(opts: {
  student: Student;
  ledger: EvidenceLedger;
  doc: ResumeDocument;
  budget: DensityBudget;
  signal?: AbortSignal;
}): Promise<{ doc: ResumeDocument; added: number; degraded: boolean }> {
  const { student, ledger, budget } = opts;
  const experienceRows = (Array.isArray(student.experience) ? student.experience : []) as ExperienceRow[];
  const projectRows = (Array.isArray(student.projects) ? student.projects : []) as ProjectRow[];
  const exRows = ledger.rows.filter((r) => r.kind === "EX");
  const prRows = ledger.rows.filter((r) => r.kind === "PR");

  const items: ThinItem[] = [];
  experienceRows.forEach((row, i) => {
    const ref = exRows[i]?.id;
    if (!ref || !row?.role) return;
    const docIndex = opts.doc.experience.findIndex((e) => same(e.company, row.company) && same(e.role, row.role));
    const have = docIndex === -1 ? 0 : opts.doc.experience[docIndex].bullets.length;
    const existing = docIndex === -1 ? [] : opts.doc.experience[docIndex].bullets.map((b) => b.text);
    if (have < MIN_BULLETS) items.push({ ref, existing, kind: "experience", facts: exRows[i].text, need: MIN_BULLETS - have, docIndex: docIndex === -1 ? null : docIndex, row });
  });
  projectRows.forEach((row, i) => {
    const ref = prRows[i]?.id;
    if (!ref || !row?.title) return;
    const docIndex = opts.doc.projects.findIndex((p) => same(p.title, row.title));
    const have = docIndex === -1 ? 0 : opts.doc.projects[docIndex].bullets.length;
    const existing = docIndex === -1 ? [] : opts.doc.projects[docIndex].bullets.map((b) => b.text);
    if (have < MIN_BULLETS) items.push({ ref, existing, kind: "projects", facts: prRows[i].text, need: MIN_BULLETS - have, docIndex: docIndex === -1 ? null : docIndex, row });
  });

  // Never grow past the page budget with entries the student hasn't vouched for.
  const room = {
    experience: Math.max(0, budget.experienceMaxEntries - opts.doc.experience.length),
    projects: Math.max(0, budget.projectsMaxEntries - opts.doc.projects.length),
  };
  const wanted = items.filter((it) => {
    if (it.docIndex !== null) return true;
    if (room[it.kind] <= 0) return false;
    room[it.kind]--;
    return true;
  }).slice(0, 6);
  if (wanted.length === 0) return { doc: opts.doc, added: 0, degraded: false };

  let raw: Record<string, unknown>;
  try {
    raw = await callJson<Record<string, unknown>>({
      system: SYSTEM_PROMPT,
      user: `Entries that need bullets (write exactly "need" bullets for each, cite nothing, just text):
${wanted.map((w) => `- ref ${w.ref} (need ${w.need}): ${w.facts}${w.existing.length ? `\n  Already on the resume, do NOT restate: ${w.existing.map((e) => `"${e}"`).join("; ")}` : ""}`).join("\n")}

Return JSON: { "items": [{ "ref": "EX:1", "bullets": ["...", "..."] }] }`,
      maxTokens: 1200,
      temperature: 0.4,
      signal: opts.signal,
      stageName: "suggest",
      shape: (r) => {
        if (!r || typeof r !== "object" || Array.isArray(r)) throw new ShapeError("suggestions were not a JSON object");
        return r as Record<string, unknown>;
      },
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    logger.warn({ err }, "resume pipeline: suggestions failed, continuing without them");
    return { doc: opts.doc, added: 0, degraded: true };
  }

  const byRef = new Map<string, string[]>();
  for (const it of asObjectArray(raw.items)) {
    if (typeof it.ref !== "string" || !Array.isArray(it.bullets)) continue;
    byRef.set(it.ref, it.bullets.filter((b): b is string => typeof b === "string"));
  }

  const clean = (text: string, facts: string): string | null => {
    const t = text.trim().replace(/^[-•*]\s*/, "").replace(/\s+/g, " ");
    const words = t.split(" ").length;
    if (words < 6 || words > 32) return null;
    if (introducesNewNumbers(t, numberTokens(facts))) return null;
    if (/\b(i|my|we|our)\b/i.test(t)) return null;
    if (unsupportedTech(t, ledger).length > 0) return null;
    return t;
  };

  let doc = opts.doc;
  let added = 0;
  const orderAdds = new Set<SectionKey>();
  for (const w of wanted) {
    const texts: string[] = [];
    for (const t of (byRef.get(w.ref) ?? []).map((x) => clean(x, w.facts))) {
      if (!t || texts.length >= w.need) continue;
      // A suggestion that restates an existing bullet is padding, and checkers
      // penalise the repetition.
      if ([...w.existing, ...texts].some((e) => overlap(e, t) >= 0.5)) continue;
      texts.push(t);
    }
    if (texts.length === 0) continue;
    const bullets: Bullet[] = texts.map((text) => ({ text, evidence: [w.ref], suggested: true }));
    added += bullets.length;
    if (w.kind === "experience") {
      if (w.docIndex !== null) {
        const idx = w.docIndex;
        doc = { ...doc, experience: doc.experience.map((e, i) => (i === idx ? { ...e, bullets: [...e.bullets, ...bullets] } : e)) };
      } else {
        const row = w.row as ExperienceRow;
        const { start, end } = parsePeriod(row.period);
        const entry: ExperienceEntry = { company: row.company, role: row.role, start, end, bullets };
        doc = { ...doc, experience: [...doc.experience, entry] };
        orderAdds.add("experience");
      }
    } else if (w.docIndex !== null) {
      const idx = w.docIndex;
      doc = { ...doc, projects: doc.projects.map((p, i) => (i === idx ? { ...p, bullets: [...p.bullets, ...bullets] } : p)) };
    } else {
      const row = w.row as ProjectRow;
      const entry: ProjectEntry = { title: row.title, tech: row.techStack ?? [], link: row.githubUrl ?? row.liveUrl ?? null, bullets };
      doc = { ...doc, projects: [...doc.projects, entry] };
      orderAdds.add("projects");
    }
  }
  for (const key of orderAdds) {
    if (!doc.order.includes(key)) doc = { ...doc, order: [...doc.order, key] };
  }
  return { doc, added, degraded: false };
}
