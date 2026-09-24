import OpenAI, { toFile } from "openai";

// This package is named "integrations-anthropic-ai" for historical reasons, but the
// whole app talks to it through a small Anthropic-shaped surface: `anthropic.messages
// .create()` (reads `content[0].text`) and `anthropic.messages.stream()` (a for-await
// loop over `content_block_delta` / `text_delta` events). To swap the backend to OpenAI
// we only reimplement that surface here — no route/handler code changes.

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "OPENAI_API_KEY must be set. Did you forget to provision the OpenAI integration?",
  );
}

// Single source of truth for the model id. Override with AI_MODEL (e.g. "gpt-4o" for
// higher quality, "gpt-4o-mini" for lower cost) to switch in one place.
export const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

// Resume generation runs a multi-stage reasoning pipeline where output quality is the
// entire product. It gets a stronger model than the rest of the app, independent of AI_MODEL.
export const AI_MODEL_RESUME = process.env.AI_MODEL_RESUME ?? "gpt-4o";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Optional: point at an OpenAI-compatible gateway if OPENAI_BASE_URL is set.
  ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
});

type Role = "user" | "assistant" | "system";
interface AnthropicMessage {
  role: Role;
  // Every call site in this app passes a plain string. Coerce defensively anyway.
  content: string | Array<{ type?: string; text?: string }>;
}
interface CreateParams {
  model: string;
  max_tokens?: number;
  system?: string;
  messages: AnthropicMessage[];
  temperature?: number;
  // OpenAI-specific: pass { type: "json_object" } to force valid JSON output.
  // Ignored by streaming. Prompts must mention "json" for OpenAI to honor it.
  response_format?: { type: "json_object" | "text" };
  // Forwarded to the OpenAI SDK's request options so a real client disconnect
  // (e.g. `req.on("close", ...)`) actually aborts the in-flight call instead
  // of only stopping the caller from waiting on it.
  signal?: AbortSignal;
  // Per-call overrides of the SDK defaults (600s timeout, 2 retries), which are
  // far too long for a request a student is watching.
  timeoutMs?: number;
  maxRetries?: number;
  [key: string]: unknown;
}

function contentToString(content: AnthropicMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((b) => (typeof b?.text === "string" ? b.text : ""))
    .join("");
}

function toOpenAIMessages(
  params: CreateParams,
): Array<{ role: Role; content: string }> {
  const msgs: Array<{ role: Role; content: string }> = [];
  if (params.system) msgs.push({ role: "system", content: params.system });
  for (const m of params.messages) {
    msgs.push({ role: m.role, content: contentToString(m.content) });
  }
  return msgs;
}

// ── Voice: OpenAI TTS + Whisper transcription (for the AV mock interview) ──────

// Text -> spoken audio (mp3 bytes). Voice/model overridable via env.
export async function textToSpeech(text: string): Promise<Buffer> {
  const resp = await openai.audio.speech.create({
    model: process.env.AI_TTS_MODEL ?? "tts-1",
    voice: (process.env.AI_TTS_VOICE ?? "alloy") as never,
    input: text.slice(0, 4000),
    response_format: "mp3",
  });
  return Buffer.from(await resp.arrayBuffer());
}

// Recorded audio -> transcript text (Whisper).
export async function transcribeAudio(
  audio: Buffer,
  filename = "answer.webm",
): Promise<string> {
  const resp = await openai.audio.transcriptions.create({
    file: await toFile(audio, filename),
    model: process.env.AI_STT_MODEL ?? "whisper-1",
  });
  return resp.text ?? "";
}

// Anthropic-shaped shim over the OpenAI Chat Completions API.
export const anthropic = {
  messages: {
    // Non-streaming: returns an object with `content: [{ type: "text", text }]`.
    async create(params: CreateParams) {
      const resp = await openai.chat.completions.create(
        {
          model: params.model,
          max_tokens: params.max_tokens,
          temperature: params.temperature,
          ...(params.response_format ? { response_format: params.response_format } : {}),
          messages: toOpenAIMessages(params) as never,
        },
        {
          ...(params.signal ? { signal: params.signal } : {}),
          ...(params.timeoutMs !== undefined ? { timeout: params.timeoutMs } : {}),
          ...(params.maxRetries !== undefined ? { maxRetries: params.maxRetries } : {}),
        },
      );
      const text = resp.choices[0]?.message?.content ?? "";
      return {
        id: resp.id,
        type: "message" as const,
        role: "assistant" as const,
        model: resp.model,
        content: [{ type: "text" as const, text }],
        stop_reason: resp.choices[0]?.finish_reason ?? "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: resp.usage?.prompt_tokens ?? 0,
          output_tokens: resp.usage?.completion_tokens ?? 0,
        },
      };
    },

    // Streaming: returns an async-iterable yielding Anthropic-style
    // `content_block_delta` events so `for await (const event of stream)` works unchanged.
    stream(params: CreateParams) {
      async function* generate() {
        const stream = await openai.chat.completions.create({
          model: params.model,
          max_tokens: params.max_tokens,
          temperature: params.temperature,
          messages: toOpenAIMessages(params) as never,
          stream: true,
        });
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            yield {
              type: "content_block_delta" as const,
              index: 0,
              delta: { type: "text_delta" as const, text: delta },
            };
          }
        }
      }
      return generate();
    },
  },
};
