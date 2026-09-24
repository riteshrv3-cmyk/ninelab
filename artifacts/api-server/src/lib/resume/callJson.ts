import { anthropic, AI_MODEL_RESUME } from "@workspace/integrations-anthropic-ai";
import { extractJson } from "../extractJson";
import { logger } from "../logger";

export interface CallJsonOptions<T> {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
  stageName: string;
  /** Coerces the parsed JSON into the expected shape; throw to reject it. */
  shape?: (raw: unknown) => T;
}

// One model call must finish well inside the time a student will watch a
// spinner. Two attempts at this cap keep a single stage under ~3 minutes.
const CALL_TIMEOUT_MS = 90_000;

/**
 * Calls the resume model with JSON mode, extracts + parses the response, runs
 * the optional shape check, and retries once on any failure (the model
 * occasionally wraps JSON in prose or drops a key). Never retries on an
 * abort — that's the caller's cancellation, not a transient failure.
 */
export async function callJson<T>(opts: CallJsonOptions<T>): Promise<T> {
  const attempt = async (): Promise<T> => {
    const response = await anthropic.messages.create({
      model: AI_MODEL_RESUME,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      system: opts.system,
      response_format: { type: "json_object" },
      signal: opts.signal,
      timeoutMs: CALL_TIMEOUT_MS,
      maxRetries: 0,
      messages: [{ role: "user", content: opts.user }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = extractJson<unknown>(text);
    return opts.shape ? opts.shape(parsed) : (parsed as T);
  };

  try {
    return await attempt();
  } catch (err) {
    if (opts.signal?.aborted || (err instanceof Error && err.name === "AbortError")) throw err;
    logger.warn({ err, stage: opts.stageName }, "resume pipeline: JSON call failed, retrying once");
    return await attempt();
  }
}
