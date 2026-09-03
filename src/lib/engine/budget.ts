import type {
  BudgetAllocation,
  BudgetImpact,
  BudgetLine,
  ChannelId,
  ChannelPerformance,
  CompanyProfile,
  GrowthObjective,
  SegmentRecommendation,
  StrategyRecommendation,
} from "@/lib/types";
import { accountMetrics, REPEAT_VALUE_FACTOR } from "./context";
import { bandFor } from "./confidence";
import { clamp, roundSharesTo100, safeDiv, sum } from "./math";
import { roleLabel } from "./strategy";

/**
 * Stage 5 — Budget Allocator, and the impact model behind the sliders.
 *
 * Editing a budget has to move real numbers or the edit is theatre. Every
 * channel carries a cost-elasticity curve:
 *
 *   effectiveCAC(spend) = baseCAC x (spend / baseSpend) ^ exponent
 *
 * The curve is deliberately asymmetric. Scaling a channel past the level it has
 * actually proven at costs full elasticity — you buy the next-worst responder,
 * frequency climbs, and the marginal customer is more expensive. Cutting a
 * channel back returns only a third of that: you do not instantly reclaim the
 * theoretically most efficient inventory, because account structure, learning
 * phases and fixed operational cost do not shrink with the budget.
 *
 * A symmetric curve would let a user "improve" blended CAC simply by starving
 * their expensive channel, which is the sort of answer that looks clever in a
 * model and loses money in an ad account.
 */

/** Efficiency recovered when spend is cut, as a fraction of the scaling cost. */
const DOWNSCALE_RECOVERY = 0.35;

function effectiveCac(
  baseCacINR: number,
  baseSpendINR: number,
  spendINR: number,
  costElasticity: number,
): number {
  const ratio = Math.max(safeDiv(spendINR, baseSpendINR, 1), 0.05);
  const exponent = ratio >= 1 ? costElasticity : costElasticity * DOWNSCALE_RECOVERY;
  return baseCacINR * Math.pow(ratio, exponent);
}

export function allocationFromStrategy(
  strategy: StrategyRecommendation,
  company: CompanyProfile,
  objective: GrowthObjective | null,
  selectedSegments: SegmentRecommendation[],
  totalBudgetINR: number,
): BudgetAllocation {
  const lines: BudgetLine[] = strategy.channelRoles.map((c) => ({
    channelId: c.channelId,
    channelName: c.channelName,
    role: c.role,
    roleLabel: c.roleLabel,
    sharePct: c.sharePct,
    amountINR: Math.round((c.sharePct / 100) * totalBudgetINR),
  }));
  const impact = computeImpact(
    lines,
    lines,
    company,
    objective,
    selectedSegments,
    totalBudgetINR,
    strategy.confidence,
  );
  return { totalBudgetINR, lines, impact };
}

/* -------------------------------------------------------------------------- */
/* Reflow                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The user moves one channel; the others absorb the difference in proportion to
 * their current shares, so the split always adds to exactly 100%.
 * Locked channels hold their value and are excluded from the reflow.
 */
export function reflowShares(
  lines: BudgetLine[],
  changedChannelId: ChannelId,
  nextSharePct: number,
  locked: Set<ChannelId> = new Set(),
): BudgetLine[] {
  if (lines.length <= 1) return lines;
  const lockedTotal = sum(
    lines.filter((l) => locked.has(l.channelId) && l.channelId !== changedChannelId).map((l) => l.sharePct),
  );
  const maxForChanged = Math.max(0, 100 - lockedTotal);
  const target = clamp(nextSharePct, 0, maxForChanged);

  const movable = lines.filter(
    (l) => l.channelId !== changedChannelId && !locked.has(l.channelId),
  );
  const remaining = 100 - target - lockedTotal;

  if (movable.length === 0) {
    return lines.map((l) =>
      l.channelId === changedChannelId ? { ...l, sharePct: target } : l,
    );
  }

  const movableTotal = sum(movable.map((l) => l.sharePct));
  const raw = lines.map((l) => {
    if (l.channelId === changedChannelId) return target;
    if (locked.has(l.channelId)) return l.sharePct;
    // If everything else is already at zero, split the remainder evenly.
    return movableTotal > 0
      ? (l.sharePct / movableTotal) * remaining
      : remaining / movable.length;
  });

  const rounded = roundSharesTo100(raw.map((v) => Math.max(0, v)));
  return lines.map((l, i) => ({ ...l, sharePct: rounded[i] }));
}

export function withAmounts(lines: BudgetLine[], totalBudgetINR: number): BudgetLine[] {
  return lines.map((l) => ({
    ...l,
    amountINR: Math.round((l.sharePct / 100) * totalBudgetINR),
  }));
}

/* -------------------------------------------------------------------------- */
/* Impact model                                                                */
/* -------------------------------------------------------------------------- */

function channelFor(company: CompanyProfile, id: ChannelId): ChannelPerformance | undefined {
  return company.channels.find((c) => c.id === id);
}

/** Blended AOV and margin, weighted towards the segments actually selected. */
function segmentEconomics(company: CompanyProfile, selected: SegmentRecommendation[]) {
  if (selected.length === 0) {
    return {
      aovINR: company.aovINR,
      marginPct: company.grossMarginPct,
      lifetimeMultiplier: 1 + (company.repeatPurchaseRatePct / 100) * REPEAT_VALUE_FACTOR,
    };
  }
  const weights = selected.map((_, i) => 1 / (i + 1));
  const total = sum(weights);
  const aov = sum(selected.map((s, i) => s.segment.aovINR * weights[i])) / total;
  const margin = sum(selected.map((s, i) => s.segment.grossMarginPct * weights[i])) / total;
  const repeat = sum(selected.map((s, i) => s.segment.repeatRatePct * weights[i])) / total;
  return {
    aovINR: aov,
    marginPct: margin,
    lifetimeMultiplier: 1 + (repeat / 100) * REPEAT_VALUE_FACTOR,
  };
}

export function computeImpact(
  lines: BudgetLine[],
  recommendedLines: BudgetLine[],
  company: CompanyProfile,
  objective: GrowthObjective | null,
  selectedSegments: SegmentRecommendation[],
  totalBudgetINR: number,
  baseConfidence: number,
): BudgetImpact {
  const econ = segmentEconomics(company, selectedSegments);
  const marginRate = econ.marginPct / 100;

  let acquisitionSpend = 0;
  let acquisitionCustomers = 0;
  let revenue = 0;

  for (const line of lines) {
    const channel = channelFor(company, line.channelId);
    if (!channel) continue;
    const spend = (line.sharePct / 100) * totalBudgetINR;
    if (spend <= 0) continue;
    const baseSpend = channel.monthlySpendINR > 0 ? channel.monthlySpendINR : spend;
    const cac = effectiveCac(channel.cacINR, baseSpend, spend, channel.costElasticity);
    const customers = safeDiv(spend, cac);

    if (channel.role === "repeat-conversion") {
      // Repeat conversions are revenue, not new customers, and they do not
      // belong in the blended CAC denominator.
      revenue += customers * econ.aovINR;
    } else {
      acquisitionSpend += spend;
      acquisitionCustomers += customers;
      revenue += customers * econ.aovINR * econ.lifetimeMultiplier;
    }
  }

  const blendedCac = safeDiv(acquisitionSpend, acquisitionCustomers, 0);
  const contributionMargin = revenue * marginRate - totalBudgetINR;
  const roas = safeDiv(revenue, totalBudgetINR);

  // --- deviation from the recommendation --------------------------------
  const recMap = new Map(recommendedLines.map((l) => [l.channelId, l.sharePct]));
  const deviationPts =
    sum(lines.map((l) => Math.abs(l.sharePct - (recMap.get(l.channelId) ?? 0)))) / 2;

  // --- constraints -------------------------------------------------------
  const constraintBreaches: string[] = [];
  for (const c of objective?.constraints ?? []) {
    if (c.metric === "cac" && c.operator === "<=" && blendedCac > c.value) {
      constraintBreaches.push(
        `Projected blended CAC of ₹${Math.round(blendedCac).toLocaleString("en-IN")} exceeds your ceiling of ₹${c.value.toLocaleString("en-IN")}.`,
      );
    }
    if (c.metric === "roas" && c.operator === ">=" && roas < c.value) {
      constraintBreaches.push(
        `Projected blended ROAS of ${roas.toFixed(2)}x is below your floor of ${c.value}x.`,
      );
    }
    if (c.metric === "budget" && c.operator === "<=" && totalBudgetINR > c.value) {
      constraintBreaches.push(
        `Total budget of ₹${totalBudgetINR.toLocaleString("en-IN")} exceeds the ₹${c.value.toLocaleString("en-IN")} you fixed.`,
      );
    }
  }

  // --- concentration -----------------------------------------------------
  const largest = [...lines].sort((a, b) => b.sharePct - a.sharePct)[0];
  const concentrationWarning =
    largest && largest.sharePct >= 65
      ? `${largest.sharePct}% of budget sits in ${largest.channelName}. A single-channel plan has no fallback if its auction dynamics change mid-cycle.`
      : undefined;

  // --- confidence --------------------------------------------------------
  const confidence = clamp(
    baseConfidence -
      deviationPts * 0.006 -
      (concentrationWarning ? 0.05 : 0) -
      constraintBreaches.length * 0.04,
    0.2,
    0.95,
  );

  const riskLevel: BudgetImpact["riskLevel"] =
    constraintBreaches.length > 0 || deviationPts > 15
      ? "high"
      : deviationPts > 5 || concentrationWarning
        ? "elevated"
        : "low";

  return {
    projectedBlendedCacINR: Math.round(blendedCac),
    projectedNewCustomers: Math.round(acquisitionCustomers),
    projectedRevenueINR: Math.round(revenue),
    projectedContributionMarginINR: Math.round(contributionMargin),
    projectedRoas: Number(roas.toFixed(2)),
    confidence: Number(confidence.toFixed(3)),
    confidenceBand: bandFor(confidence),
    constraintBreaches,
    deviationFromRecommendationPts: Number(deviationPts.toFixed(1)),
    riskLevel,
    concentrationWarning,
  };
}

/** Convenience wrapper used by the budget screen on every slider move. */
export function recomputeAllocation(
  lines: BudgetLine[],
  recommended: BudgetAllocation,
  company: CompanyProfile,
  objective: GrowthObjective | null,
  selectedSegments: SegmentRecommendation[],
  totalBudgetINR: number,
  baseConfidence: number,
): BudgetAllocation {
  const withMoney = withAmounts(lines, totalBudgetINR);
  return {
    totalBudgetINR,
    lines: withMoney,
    impact: computeImpact(
      withMoney,
      recommended.lines,
      company,
      objective,
      selectedSegments,
      totalBudgetINR,
      baseConfidence,
    ),
  };
}

export { accountMetrics, roleLabel };
