import type {
  CompanyProfile,
  CustomerSegment,
  GrowthObjective,
  ObjectivePresetId,
  ReasoningNode,
  SegmentRecommendation,
  SegmentScoreBreakdown,
} from "@/lib/types";
import { accountMetrics, segmentUnitContribution } from "./context";
import { bandFor } from "./confidence";
import { clamp, normaliseToMax, slugId } from "./math";

/**
 * Stage 3 — Segment Analyst.
 *
 * Segment Score = 0.30 profitability + 0.25 conversion propensity
 *               + 0.20 repeat behaviour + 0.15 reachable audience
 *               + 0.10 strategic fit
 *
 * Those are the base weights. The objective then re-weights them, because
 * "acquire new customers" and "grow profitable revenue" are not the same
 * question asked twice — and a product that returns the same ranking for both
 * is not actually reading the objective. The applied weights are shown in the
 * UI next to the score, so the re-weighting is inspectable rather than implied.
 */

export const BASE_WEIGHTS: SegmentScoreBreakdown = {
  profitability: 0.3,
  conversionPropensity: 0.25,
  repeatBehaviour: 0.2,
  reachableAudience: 0.15,
  strategicFit: 0.1,
};

const OBJECTIVE_WEIGHTS: Record<ObjectivePresetId, SegmentScoreBreakdown> = {
  "profitable-revenue": {
    profitability: 0.36,
    conversionPropensity: 0.22,
    repeatBehaviour: 0.2,
    reachableAudience: 0.1,
    strategicFit: 0.12,
  },
  "new-customers": {
    profitability: 0.14,
    conversionPropensity: 0.24,
    repeatBehaviour: 0.08,
    reachableAudience: 0.3,
    strategicFit: 0.24,
  },
  "improve-roas": {
    profitability: 0.34,
    conversionPropensity: 0.26,
    repeatBehaviour: 0.14,
    reachableAudience: 0.1,
    strategicFit: 0.16,
  },
  "reduce-cac": {
    profitability: 0.32,
    conversionPropensity: 0.22,
    repeatBehaviour: 0.14,
    reachableAudience: 0.12,
    strategicFit: 0.2,
  },
  "grow-repeat": {
    profitability: 0.22,
    conversionPropensity: 0.16,
    repeatBehaviour: 0.34,
    reachableAudience: 0.08,
    strategicFit: 0.2,
  },
  "launch-product": {
    profitability: 0.16,
    conversionPropensity: 0.24,
    repeatBehaviour: 0.08,
    reachableAudience: 0.3,
    strategicFit: 0.22,
  },
  "expand-category": {
    profitability: 0.18,
    conversionPropensity: 0.2,
    repeatBehaviour: 0.08,
    reachableAudience: 0.32,
    strategicFit: 0.22,
  },
  custom: BASE_WEIGHTS,
};

export function weightsFor(objective: GrowthObjective | null): SegmentScoreBreakdown {
  if (!objective) return BASE_WEIGHTS;
  return OBJECTIVE_WEIGHTS[objective.presetId] ?? BASE_WEIGHTS;
}

/** Human-readable note on how the objective moved the weights. */
export function weightShiftNotes(objective: GrowthObjective | null): string[] {
  const w = weightsFor(objective);
  const labels: Record<keyof SegmentScoreBreakdown, string> = {
    profitability: "Profitability",
    conversionPropensity: "Conversion propensity",
    repeatBehaviour: "Repeat behaviour",
    reachableAudience: "Reachable audience",
    strategicFit: "Strategic fit",
  };
  const notes: string[] = [];
  (Object.keys(labels) as (keyof SegmentScoreBreakdown)[]).forEach((k) => {
    const delta = Math.round((w[k] - BASE_WEIGHTS[k]) * 100);
    if (delta !== 0) {
      notes.push(
        `${labels[k]} weight ${delta > 0 ? "raised" : "lowered"} ${delta > 0 ? "+" : ""}${delta} pts by this objective`,
      );
    }
  });
  return notes;
}

/* -------------------------------------------------------------------------- */
/* Strategic fit                                                               */
/* -------------------------------------------------------------------------- */

/**
 * How well a segment serves an objective, before any economics are considered.
 * Derived from segment shape rather than hard-coded per segment, so a
 * user-supplied segment gets a fair reading too.
 */
function strategicFit(segment: CustomerSegment, objective: GrowthObjective | null): number {
  const repeat = segment.repeatRatePct / 100;
  const size = segment.estimatedSize;
  const cheap = clamp(1 - segment.historicalCacINR / 2500);
  const preset = objective?.presetId ?? "custom";

  switch (preset) {
    case "profitable-revenue":
      return clamp(0.35 + repeat * 0.9 + cheap * 0.35);
    case "new-customers":
      return clamp(
        0.05 + clamp(size / 40_000) * 0.75 + (segment.isReactivation ? 0 : 0.25) - repeat * 0.8,
      );
    case "improve-roas":
      return clamp(0.3 + cheap * 0.55 + repeat * 0.45);
    case "reduce-cac":
      return clamp(0.2 + cheap * 0.85 + repeat * 0.2);
    case "grow-repeat":
      return clamp(0.15 + repeat * 1.5 + (segment.isReactivation ? 0.25 : 0));
    case "launch-product":
      return clamp(0.2 + clamp(size / 40_000) * 0.5 + segment.conversionPropensity * 0.45);
    case "expand-category":
      return clamp(0.15 + clamp(size / 40_000) * 0.75 - repeat * 0.2);
    default:
      return clamp(0.4 + repeat * 0.5 + cheap * 0.3);
  }
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                     */
/* -------------------------------------------------------------------------- */

export function scoreSegments(
  company: CompanyProfile,
  objective: GrowthObjective | null,
): SegmentRecommendation[] {
  const segments = company.segments;
  if (segments.length === 0) return [];

  const metrics = accountMetrics(company);
  const weights = weightsFor(objective);

  const contributions = segments.map(segmentUnitContribution);
  // Square-root of size so a segment three times larger is not scored three
  // times better — reach has diminishing strategic value.
  const reachRaw = segments.map((s) => Math.sqrt(Math.max(s.estimatedSize, 0)) * s.reachability);
  const fitRaw = segments.map((s) => strategicFit(s, objective));

  const profN = normaliseToMax(contributions.map((c) => Math.max(c, 0)));
  const convN = normaliseToMax(segments.map((s) => s.conversionPropensity));
  const repeatN = normaliseToMax(segments.map((s) => s.repeatRatePct));
  const reachN = normaliseToMax(reachRaw);
  const fitN = normaliseToMax(fitRaw);

  const scored = segments.map((segment, i) => {
    const breakdown: SegmentScoreBreakdown = {
      profitability: profN[i],
      conversionPropensity: convN[i],
      repeatBehaviour: repeatN[i],
      reachableAudience: reachN[i],
      strategicFit: fitN[i],
    };
    const score =
      breakdown.profitability * weights.profitability +
      breakdown.conversionPropensity * weights.conversionPropensity +
      breakdown.repeatBehaviour * weights.repeatBehaviour +
      breakdown.reachableAudience * weights.reachableAudience +
      breakdown.strategicFit * weights.strategicFit;

    // Confidence is the segment's own data quality, tempered by how far the
    // decision rests on inferred inputs.
    const confidence = clamp(
      segment.dataConfidence * 0.75 + clamp(score) * 0.25,
      0.25,
      0.95,
    );

    return { segment, breakdown, score, confidence, contribution: contributions[i] };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);

  return ranked.map((entry, index) => {
    const { segment, breakdown, score, confidence, contribution } = entry;
    return {
      segmentId: segment.id,
      segment,
      rank: index + 1,
      score: Number(score.toFixed(4)),
      breakdown: {
        profitability: Number(breakdown.profitability.toFixed(3)),
        conversionPropensity: Number(breakdown.conversionPropensity.toFixed(3)),
        repeatBehaviour: Number(breakdown.repeatBehaviour.toFixed(3)),
        reachableAudience: Number(breakdown.reachableAudience.toFixed(3)),
        strategicFit: Number(breakdown.strategicFit.toFixed(3)),
      },
      weights,
      confidence: Number(confidence.toFixed(3)),
      confidenceBand: bandFor(confidence),
      estimatedUnitContributionINR: Math.round(contribution),
      rationale: segmentRationale(entry, index, metrics.blendedCacINR, objective),
      reasoning: segmentReasoning(entry, index, metrics.blendedCacINR, objective),
      recommended: index === 0,
    };
  });
}

type ScoredEntry = {
  segment: CustomerSegment;
  breakdown: SegmentScoreBreakdown;
  score: number;
  confidence: number;
  contribution: number;
};

function topFactor(breakdown: SegmentScoreBreakdown, weights: SegmentScoreBreakdown): string {
  const labels: Record<keyof SegmentScoreBreakdown, string> = {
    profitability: "contribution per customer",
    conversionPropensity: "conversion propensity",
    repeatBehaviour: "repeat behaviour",
    reachableAudience: "reachable audience size",
    strategicFit: "fit with the stated objective",
  };
  const keys = Object.keys(labels) as (keyof SegmentScoreBreakdown)[];
  const best = keys.reduce((a, b) =>
    breakdown[a] * weights[a] >= breakdown[b] * weights[b] ? a : b,
  );
  return labels[best];
}

function segmentRationale(
  entry: ScoredEntry,
  index: number,
  blendedCac: number,
  objective: GrowthObjective | null,
): string {
  const { segment, breakdown, contribution } = entry;
  const weights = weightsFor(objective);
  const driver = topFactor(breakdown, weights);
  const cacGap = Math.round(((segment.historicalCacINR - blendedCac) / blendedCac) * 100);
  const cacPhrase =
    cacGap < 0
      ? `acquisition cost ${Math.abs(cacGap)}% below the blended account CAC`
      : `acquisition cost ${cacGap}% above the blended account CAC`;

  if (index === 0) {
    return `Ranks first on ${driver}. It carries ${cacPhrase}, a ${segment.repeatRatePct}% repeat rate and roughly ₹${Math.round(contribution).toLocaleString("en-IN")} of contribution per acquired customer.`;
  }
  return `Ranks ${index + 1}. Strongest on ${driver}, but ${cacPhrase} and a ${segment.repeatRatePct}% repeat rate leave it behind the leading segment under this objective.`;
}

function segmentReasoning(
  entry: ScoredEntry,
  index: number,
  blendedCac: number,
  objective: GrowthObjective | null,
): ReasoningNode[] {
  const { segment, contribution, confidence } = entry;
  const cacGap = ((segment.historicalCacINR - blendedCac) / blendedCac) * 100;
  const nodes: ReasoningNode[] = [];

  nodes.push({
    id: slugId("rn-seg-cac", segment.id),
    topic: "segment",
    input: `${segment.name} historical ${segment.isReactivation ? "reactivation" : "acquisition"} cost = ₹${segment.historicalCacINR.toLocaleString("en-IN")}`,
    comparison: `${Math.abs(cacGap).toFixed(0)}% ${cacGap < 0 ? "below" : "above"} blended account CAC of ₹${blendedCac.toLocaleString("en-IN")}`,
    interpretation:
      cacGap < 0
        ? "This segment is cheaper to win than the account average, so every rupee moved into it buys more customers."
        : "This segment costs more than the account average to win, so it has to earn its place on value rather than efficiency.",
    decision:
      index === 0
        ? "Treat as the primary segment for this cycle."
        : `Hold as ${index === 1 ? "secondary" : "tertiary"} priority.`,
    confidence: Number(clamp(segment.dataConfidence + 0.05, 0, 0.95).toFixed(2)),
    wouldChangeIf: [
      `${segment.name} CAC rises above ₹${Math.round(segment.historicalCacINR * 1.25).toLocaleString("en-IN")}`,
      "Blended account CAC falls by more than 15%",
    ],
  });

  nodes.push({
    id: slugId("rn-seg-value", segment.id),
    topic: "segment",
    input: `AOV ₹${segment.aovINR.toLocaleString("en-IN")} at ${segment.grossMarginPct}% margin, ${segment.repeatRatePct}% repeat rate`,
    comparison: `≈ ₹${Math.round(contribution).toLocaleString("en-IN")} contribution per acquired customer after acquisition cost`,
    interpretation:
      contribution > 0
        ? "The segment covers its own acquisition cost within the modelled repeat window."
        : "The segment does not cover its acquisition cost within the modelled repeat window.",
    decision:
      contribution > 0
        ? "Eligible for paid investment this cycle."
        : "Not eligible for scaled paid investment until unit economics improve.",
    confidence: Number(confidence.toFixed(2)),
    wouldChangeIf: [
      `Repeat rate drops below ${Math.max(5, Math.round(segment.repeatRatePct * 0.7))}%`,
      `Gross margin falls below ${Math.max(20, segment.grossMarginPct - 10)}%`,
    ],
  });

  if (objective) {
    nodes.push({
      id: slugId("rn-seg-fit", segment.id),
      topic: "objective",
      input: `Objective: ${objective.interpretation.split(".")[0]}`,
      comparison: `Strategic fit scored ${(entry.breakdown.strategicFit * 100).toFixed(0)}/100 for this segment`,
      interpretation:
        entry.breakdown.strategicFit > 0.7
          ? "The segment's shape matches what this objective actually rewards."
          : "The segment is viable but is not what this particular objective rewards most.",
      decision:
        entry.breakdown.strategicFit > 0.7
          ? "Weight this segment up in the channel and budget stages."
          : "Keep available as an override option rather than the default.",
      confidence: Number(objective.interpretationConfidence.toFixed(2)),
      wouldChangeIf: [
        "The objective changes (for example from profitable revenue to new-customer volume)",
        "A constraint such as the CAC ceiling is relaxed or removed",
      ],
    });
  }

  return nodes;
}
