import "server-only";

/**
 * Provider-agnostic LLM service layer.
 *
 * GrowthOS treats the LLM as an optional finishing pass, never as the thing
 * that makes the decision. The recommendation, the reasoning trace, the budget
 * and the guardrail findings are all produced deterministically by the engine.
 * A model, if one is configured, is only ever asked to re-phrase copy the
 * engine has already committed to — which is why the product is fully
 * demonstrable with no API key, no network, and no vendor.
 *
 * If no key is configured the layer reports itself unavailable and every caller
 * falls back to the deterministic output. That is the default.
 */

export type LLMProvider = "anthropic" | "openai" | "none";

export interface LLMStatus {
  available: boolean;
  provider: LLMProvider;
  model: string | null;
  reason: string;
}

const DEFAULT_MODELS: Record<Exclude<LLMProvider, "none">, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o-mini",
};

function configuredProvider(): LLMProvider {
  const raw = (process.env.LLM_PROVIDER ?? "none").trim().toLowerCase();
  return raw === "anthropic" || raw === "openai" ? raw : "none";
}

export function llmStatus(): LLMStatus {
  const provider = configuredProvider();
  if (provider === "none") {
    return {
      available: false,
      provider: "none",
      model: null,
      reason: "No LLM provider configured. GrowthOS is running on deterministic output.",
    };
  }
  if (!process.env.LLM_API_KEY) {
    return {
      available: false,
      provider,
      model: null,
      reason: `LLM_PROVIDER is set to "${provider}" but LLM_API_KEY is empty. Falling back to deterministic output.`,
    };
  }
  return {
    available: true,
    provider,
    model: process.env.LLM_MODEL || DEFAULT_MODELS[provider],
    reason: "LLM copy assistance is enabled.",
  };
}

export interface RewriteRequest {
  headline: string;
  body: string;
  cta: string;
  brand: string;
  segment: string;
  channel: string;
  purpose: string;
  /** Constraints the engine has already decided and the model must not undo. */
  mustAvoid: string[];
}

export interface RewriteResult {
  headline: string;
  body: string;
  cta: string;
  source: "llm" | "deterministic";
  note?: string;
}

function buildPrompt(req: RewriteRequest): string {
  return [
    `You are rewriting one advertising concept for an Indian D2C brand. Return JSON only.`,
    ``,
    `Brand: ${req.brand}`,
    `Channel: ${req.channel}`,
    `Audience: ${req.segment}`,
    `Strategic purpose (do not change this): ${req.purpose}`,
    ``,
    `Current copy:`,
    `headline: ${req.headline}`,
    `body: ${req.body}`,
    `cta: ${req.cta}`,
    ``,
    `Rules:`,
    `- Keep the same strategic angle and the same audience. This is a rewrite, not a new idea.`,
    `- Do not add any claim that is not already present.`,
    req.mustAvoid.length
      ? `- Do not reintroduce any of these, which a compliance check already removed: ${req.mustAvoid.join("; ")}.`
      : `- Do not add efficacy, health, financial or superlative claims.`,
    `- Indian English. No exclamation marks. Headline under 60 characters, body under 200.`,
    ``,
    `Return exactly: {"headline": "...", "body": "...", "cta": "..."}`,
  ].join("\n");
}

async function callAnthropic(prompt: string, model: string, key: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Anthropic responded ${res.status}`);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return json.content?.find((c) => c.type === "text")?.text ?? "";
}

async function callOpenAI(prompt: string, model: string, key: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`OpenAI responded ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseCopy(raw: string): Partial<RewriteResult> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const pick = (k: string) => (typeof parsed[k] === "string" ? (parsed[k] as string) : undefined);
    return { headline: pick("headline"), body: pick("body"), cta: pick("cta") };
  } catch {
    return null;
  }
}

/**
 * Never throws. A failed or unconfigured provider returns the original copy
 * with `source: "deterministic"` — a live demo must not be able to break here.
 */
export async function rewriteCreative(req: RewriteRequest): Promise<RewriteResult> {
  const status = llmStatus();
  const fallback: RewriteResult = {
    headline: req.headline,
    body: req.body,
    cta: req.cta,
    source: "deterministic",
    note: status.reason,
  };
  if (!status.available || !status.model) return fallback;

  try {
    const key = process.env.LLM_API_KEY as string;
    const prompt = buildPrompt(req);
    const raw =
      status.provider === "anthropic"
        ? await callAnthropic(prompt, status.model, key)
        : await callOpenAI(prompt, status.model, key);
    const parsed = parseCopy(raw);
    if (!parsed?.headline || !parsed.body) {
      return { ...fallback, note: "The model returned copy GrowthOS could not parse. Kept the original." };
    }
    return {
      headline: parsed.headline,
      body: parsed.body,
      cta: parsed.cta || req.cta,
      source: "llm",
      note: `Rewritten by ${status.provider}/${status.model}. The strategy, budget and guardrail findings were not produced by a model.`,
    };
  } catch (error) {
    return {
      ...fallback,
      note: `LLM call failed (${error instanceof Error ? error.message : "unknown error"}). Kept the deterministic copy.`,
    };
  }
}
