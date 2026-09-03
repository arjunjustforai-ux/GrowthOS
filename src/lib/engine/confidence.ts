import type { Confidence, ConfidenceBand } from "@/lib/types";

export function bandFor(confidence: Confidence): ConfidenceBand {
  if (confidence >= 0.78) return "high";
  if (confidence >= 0.58) return "moderate";
  return "low";
}

export function bandLabel(band: ConfidenceBand): string {
  return band.toUpperCase();
}

/**
 * GrowthOS never renders a confidence number without this caveat nearby.
 * Confidence is a statement about the inputs, not a probability of success.
 */
export const CONFIDENCE_CAVEAT =
  "Confidence describes how well-supported this recommendation is by the data you supplied. It is not a probability that the plan will succeed.";
