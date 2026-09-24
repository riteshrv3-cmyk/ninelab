import type { studentsTable } from "@workspace/db";
import type { EvidenceMap, GenerationMeta, ResumeDocument, StageTelemetry, TemplateDensity } from "@workspace/resume-core";
import { buildAtsReport, countSuggestions, densityBudget, estimateLayout } from "@workspace/resume-core";
import { AI_MODEL_RESUME } from "@workspace/integrations-anthropic-ai";
import { buildLedger, ledgerVolume } from "./ledger";
import { analyzeJd } from "./stage1-jd";
import { buildEvidenceMap } from "./stage2-map";
import { draftResume } from "./stage3-draft";
import { critique } from "./stage4-critic";
import { fabricationGate } from "./gate";
import { applyPatches } from "./patch";
import { suggestForThinEntries } from "./suggest";

type Student = typeof studentsTable.$inferSelect;

export type PipelineStageName = "jd" | "map" | "draft" | "critic";
export type PipelineProgressPayload = Record<string, unknown>;
export type PipelineProgress = (stage: PipelineStageName, status: "start" | "done", payload?: PipelineProgressPayload) => void;

export interface RunPipelineOptions {
  student: Student;
  jdText: string;
  roleTitle: string;
  jobTags: string[];
  templateDensity: TemplateDensity;
  signal?: AbortSignal;
  onProgress?: PipelineProgress;
}

export interface RunPipelineResult {
  doc: ResumeDocument;
  generation: GenerationMeta;
  evidenceMap: EvidenceMap;
}

async function timed<T>(
  name: PipelineStageName,
  onProgress: PipelineProgress | undefined,
  run: () => Promise<{ value: T; cached: boolean; degraded: boolean; payload?: PipelineProgressPayload }>,
): Promise<{ value: T; telemetry: StageTelemetry }> {
  onProgress?.(name, "start");
  const start = Date.now();
  const { value, cached, degraded, payload } = await run();
  onProgress?.(name, "done", payload);
  return { value, telemetry: { name, ms: Date.now() - start, cached, ok: !degraded } };
}

/**
 * Runs the full 4-stage resume pipeline. Every stage degrades gracefully
 * instead of throwing — a total failure only happens if the ledger build
 * itself throws (it doesn't call the model, so this should never 500).
 */
export async function runResumePipeline(opts: RunPipelineOptions): Promise<RunPipelineResult> {
  const totalStart = Date.now();
  const stages: StageTelemetry[] = [];
  const removedByGate: GenerationMeta["removedByGate"] = [];

  // Ledger build is pure/sync but wrapped in Promise.all with stage 1 per the
  // plan's latency budget — the two have no dependency on each other.
  const [ledger, jdStage] = await Promise.all([
    Promise.resolve(buildLedger(opts.student)),
    timed("jd", opts.onProgress, async () => {
      const r = await analyzeJd({ jdText: opts.jdText, roleTitle: opts.roleTitle, jobTags: opts.jobTags, signal: opts.signal });
      return { value: r.analysis, cached: r.cached, degraded: r.degraded, payload: { keywordCount: r.analysis.hardSkills.length } };
    }),
  ]);
  stages.push(jdStage.telemetry);
  const jd = jdStage.value;

  const mapStage = await timed("map", opts.onProgress, async () => {
    const r = await buildEvidenceMap(ledger, jd, opts.signal);
    const { coverage } = r.map;
    const have = coverage.filter(c => c.status === "strong").length;
    const partial = coverage.filter(c => c.status === "partial").length;
    const missing = coverage.filter(c => c.status === "absent").map(c => c.jdTerm).slice(0, 6);
    return { value: r.map, cached: r.cached, degraded: r.degraded, payload: { have, partial, missing } };
  });
  stages.push(mapStage.telemetry);
  const map = mapStage.value;

  const budget = densityBudget(opts.templateDensity, ledgerVolume(ledger));

  const draftStage = await timed("draft", opts.onProgress, async () => {
    const r = await draftResume({ student: opts.student, ledger, jd, map, budget, signal: opts.signal });
    return { value: r.doc, cached: false, degraded: r.degraded };
  });
  stages.push(draftStage.telemetry);

  let { doc: gated, removed } = fabricationGate(draftStage.value, ledger);
  removedByGate.push(...removed);

  const computeAts = (d: ResumeDocument) => buildAtsReport({ doc: d, jdAnalysis: jd, jdText: opts.jdText, jobTags: opts.jobTags });
  const computeLayout = (d: ResumeDocument) => estimateLayout(d, opts.templateDensity);

  let atsReport = computeAts(gated);
  let layout = computeLayout(gated);

  let criticIterations: 1 | 2 = 1;
  let criticSummary: GenerationMeta["critic"] = null;

  for (let iteration = 1 as 1 | 2; iteration <= 2; iteration++) {
    const criticStage = await timed("critic", opts.onProgress, async () => {
      const r = await critique({ doc: gated, jd, ledger, keywordCoveragePct: atsReport?.scorePct ?? 0, layout, signal: opts.signal });
      return { value: r.report, cached: false, degraded: r.degraded };
    });
    stages.push(criticStage.telemetry);
    const report = criticStage.value;
    criticIterations = iteration;
    criticSummary = {
      scores: report.scores,
      overall: report.overall,
      iterations: criticIterations,
      recruiterSevenSecondRead: report.recruiterSevenSecondRead,
      topThreeFixes: report.topThreeFixes,
    };

    const shipReady = report.overall >= 82 && report.scores.truthfulness === 100;
    if (shipReady || iteration === 2 || report.patches.length === 0) break;

    gated = applyPatches(gated, report.patches);
    const regated = fabricationGate(gated, ledger);
    gated = regated.doc;
    removedByGate.push(...regated.removed);
    atsReport = computeAts(gated);
    layout = computeLayout(gated);
  }

  // Thin profiles: marked suggestions for entries with fewer than 2 bullets.
  // They never count toward scores or exports until the student confirms.
  const suggestion = await suggestForThinEntries({ student: opts.student, ledger, doc: gated, budget, signal: opts.signal });
  if (suggestion.added > 0) {
    const regated = fabricationGate(suggestion.doc, ledger);
    gated = regated.doc;
    removedByGate.push(...regated.removed);
  }

  const generation: GenerationMeta = {
    pipelineVersion: "v2",
    model: AI_MODEL_RESUME,
    degraded: stages.some((s) => !s.ok),
    stages,
    critic: criticSummary,
    removedByGate,
    suggestedBullets: countSuggestions(gated),
    totalMs: Date.now() - totalStart,
  };

  return { doc: { ...gated, atsMeta: atsReport }, generation, evidenceMap: map };
}
