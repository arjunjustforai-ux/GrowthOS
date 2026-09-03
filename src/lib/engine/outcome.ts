import type {
  BudgetAllocation,
  CompanyProfile,
  GrowthObjective,
  OutcomeScenario,
  SegmentRecommendation,
  StrategyRecommendation,
} from "@/lib/types";
import { accountMetrics } from "./context";
import { bandFor } from "./confidence";
import { clamp } from "./math";
import { computeImpact } from "./budget";
import { formatCompactINR } from "@/lib/format";

/**
 * Stage 9 — Outcome Scenario Generator.
 *
 * This screen deliberately does not produce a forecast.
 *
 * A single predicted number is the most over-trusted object in marketing
 * software: it gets screenshotted, put in a board deck, and defended as though
 * it were a commitment. So GrowthOS publishes a band, states the assumptions
 * that hold the band up, and names the things that would break it. The upper
 * bound is never described as achievable revenue, and any attempt to plan
 * against it is answered in the UI.
 */

/** Forecasting is strictly less certain than the allocation it comes from. */
const FORECAST_CONFIDENCE_DISCOUNT = 0.88;

export function buildOutcome(
  company: CompanyProfile,
  objective: GrowthObjective | null,
  strategy: StrategyRecommendation,
  selectedSegments: SegmentRecommendation[],
  finalAllocation: BudgetAllocation,
  recommendedAllocation: BudgetAllocation,
): OutcomeScenario {
  const impact = finalAllocation.impact;
  const metrics = accountMetrics(company);
  const confidence = clamp(impact.confidence * FORECAST_CONFIDENCE_DISCOUNT, 0.2, 0.9);

  const centre = impact.projectedRevenueINR;
  // Lower confidence widens the band. It never narrows it below +/-8%: the
  // model is not capable of more precision than that and should not imply it.
  const outer = clamp(0.34 - 0.22 * confidence, 0.08, 0.4);
  const inner = outer * 0.42;

  const primary = selectedSegments[0]?.segment;
  const meta = company.channels.find((c) => c.id === "meta");
  const google = company.channels.find((c) => c.id === "google");
  const largest = [...finalAllocation.lines].sort((a, b) => b.sharePct - a.sharePct)[0];

  const assumptions: string[] = [
    meta
      ? `${meta.name} CAC stays within ±12% of the current ₹${meta.cacINR.toLocaleString("en-IN")}.`
      : `Channel acquisition costs stay within ±12% of their current level.`,
    `Repeat purchase rate stays at or above ${Math.max(5, Math.round(company.repeatPurchaseRatePct * 0.87))}% (currently ${company.repeatPurchaseRatePct}%).`,
    google
      ? `Google demand does not decline more than 15% from the volume implied by ${google.impressionSharePct}% impression share.`
      : `Category search demand does not decline more than 15%.`,
    `Gross margin holds at ${company.grossMarginPct}% — no unplanned discounting inside the cycle.`,
  ];

  const uncertaintyDrivers: string[] = [
    `Auction cost volatility on ${largest?.channelName ?? "the largest channel"}, which carries ${largest?.sharePct ?? 0}% of this plan.`,
    primary
      ? `Size and freshness of the ${primary.name} audience (${primary.estimatedSize.toLocaleString("en-IN")} estimated, at ${Math.round(primary.dataConfidence * 100)}% data confidence).`
      : `Segment sizing confidence.`,
    `Diminishing returns as spend moves past levels each channel has actually proven at — the model applies a cost-elasticity curve, but the true curve is only observable after the fact.`,
  ];

  if (impact.deviationFromRecommendationPts > 0) {
    uncertaintyDrivers.push(
      `This allocation sits ${impact.deviationFromRecommendationPts.toFixed(1)} percentage points away from the modelled recommendation, so less of it rests on observed performance.`,
    );
  }

  const whatWouldMakeThisWrong: string[] = [
    `${meta?.name ?? "Primary channel"} CPMs rise sharply — a festive or election-period auction squeeze would move CAC before anything in this plan could react.`,
    `A competitor increases promotional intensity, pulling conversion rate down across every channel at once.`,
    `Landing-page conversion deteriorates — the model assumes site performance is unchanged, and it is the single easiest thing to break.`,
    `Product goes out of stock. Spend continues, revenue does not.`,
    `The repeat base is more saturated than the data suggests, and retention spend reaches people who would have reordered anyway.`,
  ];

  // What this band actually rests on.
  const history = company.campaignHistory;
  const historicalBasis = history.length
    ? `Modelled from ${history.length} months of this account's own performance (${history.map((h) => h.month).join(", ")}: blended CAC ₹${history[0].blendedCacINR.toLocaleString("en-IN")} → ₹${history[history.length - 1].blendedCacINR.toLocaleString("en-IN")}, ROAS ${history[0].roas.toFixed(1)}x → ${history[history.length - 1].roas.toFixed(1)}x), plus the per-channel CAC and elasticity in your context. Blended account CAC today is ₹${metrics.blendedCacINR.toLocaleString("en-IN")}.`
    : `Modelled from the channel-level CAC and margin figures in your company context. No historical campaign series was supplied, which is why the band is wide.`;

  return {
    lowINR: Math.round(centre * (1 - outer)),
    baseLowINR: Math.round(centre * (1 - inner)),
    baseHighINR: Math.round(centre * (1 + inner)),
    highINR: Math.round(centre * (1 + outer)),
    confidence: Number(confidence.toFixed(3)),
    confidenceBand: bandFor(confidence),
    assumptions: assumptions.slice(0, 4),
    uncertaintyDrivers: uncertaintyDrivers.slice(0, 4),
    historicalBasis,
    whatWouldMakeThisWrong,
    upperBoundCaveat:
      "The upper figure is an upper scenario under the stated assumptions. It is not potential revenue, it is not a target, and it should not be used as the basis for any spend commitment.",
  };
}

/**
 * The counterfactual: what the same budget would be expected to return if it
 * were left in the current channel mix. Shown next to the band so the user can
 * see what the plan is actually changing.
 */
export function baselineRevenue(
  company: CompanyProfile,
  objective: GrowthObjective | null,
  selectedSegments: SegmentRecommendation[],
  totalBudgetINR: number,
  baseConfidence: number,
): number {
  const totalCurrent = company.channels.reduce((a, c) => a + c.monthlySpendINR, 0) || 1;
  const lines = company.channels.map((c) => ({
    channelId: c.id,
    channelName: c.name,
    role: c.role,
    roleLabel: c.role,
    sharePct: (c.monthlySpendINR / totalCurrent) * 100,
    amountINR: c.monthlySpendINR,
  }));
  return computeImpact(
    lines,
    lines,
    company,
    objective,
    selectedSegments,
    totalBudgetINR,
    baseConfidence,
  ).projectedRevenueINR;
}

export function describeBand(outcome: OutcomeScenario): string {
  return `${formatCompactINR(outcome.lowINR)} – ${formatCompactINR(outcome.highINR)}, with the central range at ${formatCompactINR(outcome.baseLowINR)} – ${formatCompactINR(outcome.baseHighINR)}`;
}

/** Shown whenever a user tries to plan against the top of the band. */
export const UPPER_SCENARIO_WARNING =
  "Higher scenarios represent uncertainty, not expected performance. Committing spend against the upper bound means planning for the version of the month where everything goes right.";
