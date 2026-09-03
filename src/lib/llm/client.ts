"use client";

import type { CreativeAsset } from "@/lib/types";

/**
 * Browser-side wrapper around /api/llm.
 *
 * Everything here degrades to the deterministic copy. A demo running with no
 * network, no key, or a dead provider behaves identically to one with a model
 * attached, except that the copy does not change.
 */

export interface LLMAvailability {
  available: boolean;
  provider: string;
  model: string | null;
  reason: string;
}

export async function checkLLM(): Promise<LLMAvailability> {
  try {
    const res = await fetch("/api/llm", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as LLMAvailability;
  } catch {
    return {
      available: false,
      provider: "none",
      model: null,
      reason: "Copy assistance endpoint unreachable. Running on deterministic output.",
    };
  }
}

export interface RegenerateOutcome {
  headline: string;
  body: string;
  cta: string;
  source: "llm" | "deterministic";
  note?: string;
}

export async function regenerateCopy(
  creative: CreativeAsset,
  brand: string,
  mustAvoid: string[],
): Promise<RegenerateOutcome> {
  const fallback: RegenerateOutcome = {
    headline: creative.headline,
    body: creative.body,
    cta: creative.cta,
    source: "deterministic",
    note: "Copy assistance is not configured. The deterministic concept is unchanged.",
  };
  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        headline: creative.headline,
        body: creative.body,
        cta: creative.cta,
        brand,
        segment: creative.targetSegmentName,
        channel: creative.channelLabel,
        purpose: creative.strategicPurpose,
        mustAvoid,
      }),
    });
    if (!res.ok) return fallback;
    return (await res.json()) as RegenerateOutcome;
  } catch {
    return fallback;
  }
}
