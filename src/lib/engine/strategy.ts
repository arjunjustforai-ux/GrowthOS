import type {
  ChannelId,
  ChannelPerformance,
  ChannelRole,
  ChannelRoleRecommendation,
  ChannelScoreBreakdown,
  CompanyProfile,
  GrowthObjective,
  ObjectivePresetId,
  ReasoningNode,
  SegmentRecommendation,
  StrategyRecommendation,
} from "@/lib/types";
import { accountMetrics, assessCompleteness } from "./context";
import { bandFor } from "./confidence";
import { clamp, normaliseToMax, roundSharesTo100, safeDiv, slugId, sum } from "./math";

/**
 * Stages 4 & 6 — Strategy Agent and Budget Allocator.
 *
 * Channel Score = 0.30 historical efficiency + 0.25 marginal scalability
 *               + 0.20 objective alignment + 0.15 audience fit
 *               + 0.10 data confidence
 *
 * Scores alone are not an allocation. Two structural rules sit on top, and both
 * are the difference between a plausible answer and a defensible one:
 *
 *  1. FUNDING FLOOR — a channel whose contribution ratio (ROAS x gross margin)
 *     is below 1.5x does not cover its own cost. It is not funded, and the
 *     reasoning trace says so explicitly rather than quietly giving it 4%.
 *
 *  2. SCALABLE CAPACITY CAP — a channel cannot absorb unlimited spend in one
 *     cycle. The cap is set by how much of the available demand it is already
 *     capturing. This is why the highest-scoring channel is often not the
 *     largest line in the budget, and it is the single most useful thing the
 *     product explains to a marketing lead.
 */

export const CHANNEL_WEIGHTS: ChannelScoreBreakdown = {
  historicalEfficiency: 0.3,
  marginalScalability: 0.25,
  objectiveAlignment: 0.2,
  audienceFit: 0.15,
  confidence: 0.1,
};

/** Below this, a rupee of spend returns less than a rupee of gross profit. */
export const MIN_CONTRIBUTION_RATIO = 1.5;

/** Retention economics are not directly comparable to acquisition CAC. */
const EFFICIENCY_CAP = 1.6;

const ROLE_LABELS: Record<ChannelRole, string> = {
  "demand-generation": "Demand generation",
  "intent-capture": "Intent capture",
  "repeat-conversion": "Repeat conversion",
  "brand-amplification": "Brand amplification",
};

export function roleLabel(role: ChannelRole): string {
  return ROLE_LABELS[role];
}

const OBJECTIVE_ROLE_ALIGNMENT: Record<ObjectivePresetId, Record<ChannelRole, number>> = {
  "profitable-revenue": {
    "demand-generation": 0.8,
    "intent-capture": 0.85,
    "repeat-conversion": 0.95,
    "brand-amplification": 0.45,
  },
  "new-customers": {
    "demand-generation": 0.95,
    "intent-capture": 0.85,
    "repeat-conversion": 0.3,
    "brand-amplification": 0.7,
  },
  "improve-roas": {
    "demand-generation": 0.7,
    "intent-capture": 0.9,
    "repeat-conversion": 0.95,
    "brand-amplification": 0.4,
  },
  "reduce-cac": {
    "demand-generation": 0.75,
    "intent-capture": 0.8,
    "repeat-conversion": 0.95,
    "brand-amplification": 0.3,
  },
  "grow-repeat": {
    "demand-generation": 0.45,
    "intent-capture": 0.35,
    "repeat-conversion": 1.0,
    "brand-amplification": 0.3,
  },
  "launch-product": {
    "demand-generation": 0.95,
    "intent-capture": 0.7,
    "repeat-conversion": 0.55,
    "brand-amplification": 0.85,
  },
  "expand-category": {
    "demand-generation": 0.9,
    "intent-capture": 0.75,
    "repeat-conversion": 0.35,
    "brand-amplification": 0.8,
  },
  custom: {
    "demand-generation": 0.8,
    "intent-capture": 0.8,
    "repeat-conversion": 0.8,
    "brand-amplification": 0.55,
  },
};

/* -------------------------------------------------------------------------- */

export interface ChannelScore {
  channel: ChannelPerformance;
  breakdown: ChannelScoreBreakdown;
  score: number;
  contributionRatio: number;
  funded: boolean;
  exclusionReason?: string;
  currentSharePct: number;
  capacityCapPct: number;
  sharePct: number;
  capBinding: boolean;
}

function audienceFitFor(
  channel: ChannelPerformance,
  selected: SegmentRecommendation[],
): number {
  if (selected.length === 0) return 0.6;
  // Weight by rank: the primary segment drives channel choice most.
  const weights = selected.map((_, i) => 1 / (i + 1));
  const total = sum(weights);
  const fit = selected.reduce((acc, rec, i) => {
    const affinity = rec.segment.channelAffinity[channel.id];
    return acc + (affinity ?? 0.5) * weights[i];
  }, 0);
  return clamp(safeDiv(fit, total, 0.5));
}

export function scoreChannels(
  company: CompanyProfile,
  objective: GrowthObjective | null,
  selectedSegments: SegmentRecommendation[],
): ChannelScore[] {
  const channels = company.channels;
  if (channels.length === 0) return [];

  const metrics = accountMetrics(company);
  const margin = company.grossMarginPct / 100;
  const totalSpend = sum(channels.map((c) => c.monthlySpendINR)) || company.monthlyPaidSpendINR;
  const alignment =
    OBJECTIVE_ROLE_ALIGNMENT[objective?.presetId ?? "custom"] ?? OBJECTIVE_ROLE_ALIGNMENT.custom;

  const efficiencyRaw = channels.map((c) =>
    Math.min(safeDiv(metrics.blendedCacINR, c.cacINR), EFFICIENCY_CAP),
  );
  const scalabilityRaw = channels.map((c) => c.headroom);
  const alignmentRaw = channels.map((c) => alignment[c.role]);
  const fitRaw = channels.map((c) => audienceFitFor(c, selectedSegments));
  const confidenceRaw = channels.map((c) => c.dataConfidence);

  const eN = normaliseToMax(efficiencyRaw);
  const sN = normaliseToMax(scalabilityRaw);
  const aN = normaliseToMax(alignmentRaw);
  const fN = normaliseToMax(fitRaw);
  const cN = normaliseToMax(confidenceRaw);

  const scores: ChannelScore[] = channels.map((channel, i) => {
    const breakdown: ChannelScoreBreakdown = {
      historicalEfficiency: Number(eN[i].toFixed(3)),
      marginalScalability: Number(sN[i].toFixed(3)),
      objectiveAlignment: Number(aN[i].toFixed(3)),
      audienceFit: Number(fN[i].toFixed(3)),
      confidence: Number(cN[i].toFixed(3)),
    };
    const score =
      breakdown.historicalEfficiency * CHANNEL_WEIGHTS.historicalEfficiency +
      breakdown.marginalScalability * CHANNEL_WEIGHTS.marginalScalability +
      breakdown.objectiveAlignment * CHANNEL_WEIGHTS.objectiveAlignment +
      breakdown.audienceFit * CHANNEL_WEIGHTS.audienceFit +
      breakdown.confidence * CHANNEL_WEIGHTS.confidence;

    const contributionRatio = channel.roas * margin;
    const currentSharePct = (channel.monthlySpendINR / totalSpend) * 100;
    // A channel already winning most of its available auctions cannot absorb a
    // large increase; one with headroom can grow faster.
    const capacityCapPct =
      currentSharePct > 0
        ? currentSharePct * (1 + 1.2 * channel.headroom)
        : 5 + 15 * channel.headroom;

    const funded = contributionRatio >= MIN_CONTRIBUTION_RATIO;
    return {
      channel,
      breakdown,
      score: Number(score.toFixed(4)),
      contributionRatio: Number(contributionRatio.toFixed(2)),
      funded,
      exclusionReason: funded
        ? undefined
        : `Contribution ratio ${contributionRatio.toFixed(2)}x is below the ${MIN_CONTRIBUTION_RATIO.toFixed(1)}x funding floor — at ${company.grossMarginPct}% gross margin this channel does not currently return more gross profit than it costs.`,
      currentSharePct: Number(currentSharePct.toFixed(2)),
      capacityCapPct: Number(capacityCapPct.toFixed(2)),
      sharePct: 0,
      capBinding: false,
    };
  });

  return allocateShares(scores);
}

/**
 * Turn scores into shares, then honour the capacity caps.
 *
 * Overflow released by a capped channel is redistributed by score AND remaining
 * headroom (60/40), not by score alone: a channel that scores well but is
 * already saturated should not soak up the freed budget.
 */
function allocateShares(scores: ChannelScore[]): ChannelScore[] {
  const funded = scores.filter((s) => s.funded);
  if (funded.length === 0) return scores;

  const maxHeadroom = Math.max(...funded.map((s) => s.channel.headroom), 0.01);
  const totalScore = sum(funded.map((s) => s.score));
  const shares = new Map<ChannelId, number>();
  funded.forEach((s) => shares.set(s.channel.id, (s.score / totalScore) * 100));

  const capped = new Set<ChannelId>();
  // Caps can cascade: capping one channel may push another over its own cap.
  for (let pass = 0; pass < funded.length + 1; pass += 1) {
    let overflow = 0;
    const newlyCapped: ChannelId[] = [];
    for (const s of funded) {
      if (capped.has(s.channel.id)) continue;
      const share = shares.get(s.channel.id) ?? 0;
      if (share > s.capacityCapPct + 1e-9) {
        overflow += share - s.capacityCapPct;
        shares.set(s.channel.id, s.capacityCapPct);
        newlyCapped.push(s.channel.id);
      }
    }
    newlyCapped.forEach((id) => capped.add(id));
    if (overflow <= 1e-9) break;

    const open = funded.filter((s) => !capped.has(s.channel.id));
    if (open.length === 0) {
      // Everything is capped; give the remainder back proportionally rather
      // than losing budget.
      const total = sum(funded.map((s) => shares.get(s.channel.id) ?? 0));
      funded.forEach((s) =>
        shares.set(s.channel.id, ((shares.get(s.channel.id) ?? 0) / total) * 100),
      );
      break;
    }
    const redistWeights = open.map(
      (s) => s.score * (0.6 + 0.4 * (s.channel.headroom / maxHeadroom)),
    );
    const totalW = sum(redistWeights);
    open.forEach((s, i) => {
      shares.set(s.channel.id, (shares.get(s.channel.id) ?? 0) + overflow * (redistWeights[i] / totalW));
    });
  }

  const ordered = [...funded].sort((a, b) => (shares.get(b.channel.id) ?? 0) - (shares.get(a.channel.id) ?? 0));
  const rounded = roundSharesTo100(ordered.map((s) => shares.get(s.channel.id) ?? 0));
  ordered.forEach((s, i) => {
    s.sharePct = rounded[i];
    s.capBinding = capped.has(s.channel.id);
  });
  scores.filter((s) => !s.funded).forEach((s) => (s.sharePct = 0));

  return [...ordered, ...scores.filter((s) => !s.funded)];
}

/* -------------------------------------------------------------------------- */
/* Strategy composition                                                        */
/* -------------------------------------------------------------------------- */

export function buildStrategy(
  company: CompanyProfile,
  objective: GrowthObjective | null,
  selectedSegments: SegmentRecommendation[],
  channelScores: ChannelScore[],
): StrategyRecommendation {
  const primary = selectedSegments[0];
  const metrics = accountMetrics(company);
  const funded = channelScores.filter((s) => s.funded && s.sharePct > 0);

  const channelRoles: ChannelRoleRecommendation[] = funded.map((s) => ({
    channelId: s.channel.id,
    channelName: s.channel.name,
    role: s.channel.role,
    roleLabel: ROLE_LABELS[s.channel.role],
    sharePct: s.sharePct,
    score: s.score,
    breakdown: s.breakdown,
    rationale: channelRationale(s, company, metrics.blendedCacINR),
  }));

  const largest = channelRoles[0];
  const retention = channelRoles.find((c) => c.role === "repeat-conversion");
  const direction = strategicDirection(objective, largest, retention, primary);

  const confidence = strategyConfidence(company, objective, selectedSegments, channelScores);

  return {
    headline: primary
      ? `Concentrate on ${primary.segment.name}, led by ${largest?.channelName ?? "the strongest channel"}`
      : "Concentrate spend on the most efficient scalable channel",
    strategicDirection: direction,
    primarySegmentId: primary?.segmentId ?? "",
    supportingSegmentIds: selectedSegments.slice(1).map((s) => s.segmentId),
    channelRoles,
    reasoning: channelReasoning(company, objective, channelScores, selectedSegments),
    wouldChangeIf: strategyWouldChangeIf(company, objective, channelScores, selectedSegments),
    confidence: Number(confidence.toFixed(3)),
    confidenceBand: bandFor(confidence),
  };
}

function strategicDirection(
  objective: GrowthObjective | null,
  largest: ChannelRoleRecommendation | undefined,
  retention: ChannelRoleRecommendation | undefined,
  primary: SegmentRecommendation | undefined,
): string {
  if (!largest) return "Insufficient channel data to form a strategic direction.";
  const preset = objective?.presetId ?? "custom";
  const retentionClause = retention
    ? ` while holding ${retention.sharePct}% for repeat conversion`
    : "";
  switch (preset) {
    case "profitable-revenue":
      return `Scale efficient acquisition through ${largest.channelName}${retentionClause}, and grow revenue from customers who already convert cheaply rather than from raw reach.`;
    case "new-customers":
      return `Push reach and frequency through ${largest.channelName} to widen the top of the funnel${retentionClause}, accepting a higher blended CAC in exchange for first-time buyer volume.`;
    case "improve-roas":
      return `Consolidate spend into the highest-return positions on ${largest.channelName}${retentionClause}, and stop funding anything that does not clear the contribution floor.`;
    case "reduce-cac":
      return `Shift budget away from expensive incremental reach and towards ${largest.channelName} and repeat conversion, where cost per outcome is structurally lower.`;
    case "grow-repeat":
      return `Lead with lifecycle and CRM activity against ${primary?.segment.name ?? "the existing base"}, using paid channels mainly to feed the repeat engine${retentionClause}.`;
    case "launch-product":
      return `Use ${largest.channelName} to build launch awareness fast, then convert the interest it creates through intent capture${retentionClause}.`;
    case "expand-category":
      return `Buy reach into the adjacent category through ${largest.channelName} and protect current economics by capping how far efficient channels are stretched${retentionClause}.`;
    default:
      return `Scale ${largest.channelName} as the primary acquisition engine${retentionClause}.`;
  }
}

function channelRationale(
  s: ChannelScore,
  company: CompanyProfile,
  blendedCac: number,
): string {
  const c = s.channel;
  if (!s.funded) return s.exclusionReason ?? "Not funded this cycle.";
  const gap = ((c.cacINR - blendedCac) / blendedCac) * 100;
  const gapPhrase =
    c.role === "repeat-conversion"
      ? `reactivates at ₹${c.cacINR.toLocaleString("en-IN")}, well below the cost of buying an equivalent new customer`
      : `acquires at ₹${c.cacINR.toLocaleString("en-IN")}, ${Math.abs(gap).toFixed(0)}% ${gap < 0 ? "below" : "above"} blended CAC`;
  const capPhrase = s.capBinding
    ? ` Capped at ${s.sharePct}% because it is already running at ${s.currentSharePct.toFixed(0)}% of budget and cannot absorb a step change in one cycle without efficiency loss.`
    : c.impressionSharePct >= 80
      ? ` Growth is limited by ${c.impressionSharePct}% impression share — the remaining demand is thin.`
      : "";
  return `${c.name} ${gapPhrase}. Contribution ratio ${s.contributionRatio.toFixed(2)}x at ${company.grossMarginPct}% margin.${capPhrase}`;
}

function channelReasoning(
  company: CompanyProfile,
  objective: GrowthObjective | null,
  scores: ChannelScore[],
  selected: SegmentRecommendation[],
): ReasoningNode[] {
  const metrics = accountMetrics(company);
  const nodes: ReasoningNode[] = [];

  for (const s of scores) {
    const c = s.channel;
    if (!s.funded) {
      nodes.push({
        id: slugId("rn-ch-excluded", c.id),
        topic: "channel",
        input: `${c.name} ROAS ${c.roas.toFixed(2)}x at ${company.grossMarginPct}% gross margin`,
        comparison: `Contribution ratio ${s.contributionRatio.toFixed(2)}x versus the ${MIN_CONTRIBUTION_RATIO.toFixed(1)}x funding floor`,
        interpretation:
          "Every rupee spent here currently returns less gross profit than the floor GrowthOS requires before recommending investment.",
        decision: `Do not fund ${c.name} this cycle. Test it with a fixed, separately-tracked budget instead of a share of the growth plan.`,
        confidence: Number(clamp(c.dataConfidence + 0.1, 0, 0.9).toFixed(2)),
        wouldChangeIf: [
          `${c.name} ROAS improves above ${(MIN_CONTRIBUTION_RATIO / (company.grossMarginPct / 100)).toFixed(2)}x`,
          "Gross margin improves materially",
          "The channel is re-scoped to brand measurement rather than performance",
        ],
      });
      continue;
    }

    const gap = ((c.cacINR - metrics.blendedCacINR) / metrics.blendedCacINR) * 100;
    if (c.role === "repeat-conversion") {
      nodes.push({
        id: slugId("rn-ch-retention", c.id),
        topic: "channel",
        input: `Repeat customers contribute ${Math.round((metrics.lifetimeMultiplier - 1) * 100)}% more margin than a first order alone`,
        comparison: `Reactivation costs ₹${c.cacINR.toLocaleString("en-IN")} against a blended acquisition cost of ₹${metrics.blendedCacINR.toLocaleString("en-IN")}`,
        interpretation:
          "Retention produces better contribution economics per rupee than any acquisition channel in this account.",
        decision: `Allocate ${s.sharePct}% to CRM and lifecycle activity — capped by the size of the addressable base, not by its efficiency.`,
        confidence: Number(clamp(c.dataConfidence + 0.08, 0, 0.92).toFixed(2)),
        wouldChangeIf: [
          `Repeat purchase rate falls below ${Math.max(8, Math.round(company.repeatPurchaseRatePct * 0.7))}%`,
          "The reachable repeat base shrinks or is already saturated by existing flows",
        ],
      });
    } else if (c.impressionSharePct >= 75) {
      nodes.push({
        id: slugId("rn-ch-ceiling", c.id),
        topic: "channel",
        input: `${c.name} ROAS ${c.roas.toFixed(2)}x but impression share ${c.impressionSharePct}%`,
        comparison: `Only ${100 - c.impressionSharePct}% of available demand is still unclaimed`,
        interpretation:
          "The channel performs strongly, but the remaining scalable demand is limited — extra budget buys progressively worse placements, not more of the same result.",
        decision: `Increase ${c.name} moderately to ${s.sharePct}%. Do not make it the dominant line.`,
        confidence: Number(clamp(c.dataConfidence, 0, 0.9).toFixed(2)),
        wouldChangeIf: [
          `Search volume in the category grows and impression share falls below ${Math.max(40, c.impressionSharePct - 25)}%`,
          "New keyword or geography expansion opens fresh demand",
        ],
      });
    } else {
      nodes.push({
        id: slugId("rn-ch-efficiency", c.id),
        topic: "channel",
        input: `${c.name} CAC = ₹${c.cacINR.toLocaleString("en-IN")}`,
        comparison: `${Math.abs(gap).toFixed(0)}% ${gap < 0 ? "below" : "above"} blended CAC of ₹${metrics.blendedCacINR.toLocaleString("en-IN")}, with ${Math.round(c.headroom * 100)}% headroom remaining`,
        interpretation:
          gap < 0
            ? "This is currently the most efficient channel that can still absorb more spend."
            : "The channel is above average cost, so it earns budget on reach rather than efficiency.",
        decision:
          gap < 0
            ? `Maintain ${c.name} as the largest acquisition line at ${s.sharePct}%.`
            : `Hold ${c.name} at ${s.sharePct}% and review after one cycle.`,
        confidence: Number(clamp(c.dataConfidence, 0, 0.92).toFixed(2)),
        wouldChangeIf: [
          `${c.name} CAC rises above ₹${Math.round(metrics.blendedCacINR * 1.05).toLocaleString("en-IN")}`,
          `Impression share climbs above ${Math.min(95, c.impressionSharePct + 30)}%`,
        ],
      });
    }
  }

  if (objective && selected[0]) {
    nodes.push({
      id: "rn-objective-shape",
      topic: "objective",
      input: `Objective reads as: ${objective.interpretation.split(".")[0]}`,
      comparison: `Constraints applied: ${objective.constraints.map((c) => c.label).join("; ") || "none"}`,
      interpretation:
        objective.goalMetric === "revenue" && objective.constraints.some((c) => c.metric === "cac")
          ? "The objective prioritises profitable revenue rather than raw reach, so efficiency outranks volume in every channel decision below."
          : "The objective sets the direction each channel decision below is optimised towards.",
      decision: `Rank ${selected[0].segment.name} first and shape the channel mix around it.`,
      confidence: Number(objective.interpretationConfidence.toFixed(2)),
      wouldChangeIf: [
        "New customer acquisition becomes the primary objective rather than profitable revenue",
        "The CAC ceiling is raised or removed",
      ],
    });
  }

  return nodes;
}

function strategyWouldChangeIf(
  company: CompanyProfile,
  objective: GrowthObjective | null,
  scores: ChannelScore[],
  selected: SegmentRecommendation[],
): string[] {
  const metrics = accountMetrics(company);
  const out: string[] = [];
  const meta = scores.find((s) => s.channel.id === "meta");
  const google = scores.find((s) => s.channel.id === "google");

  if (meta?.funded) {
    out.push(
      `${meta.channel.name} CAC rises above ₹${Math.round(metrics.blendedCacINR * 1.05).toLocaleString("en-IN")} — it would stop being the efficient scalable option.`,
    );
  }
  if (google) {
    out.push(
      `${google.channel.name} impression share falls below ${Math.max(40, google.channel.impressionSharePct - 25)}% — more scalable intent-capture demand would justify a larger share.`,
    );
  }
  out.push(
    `Repeat purchase rate drops below ${Math.max(8, Math.round(company.repeatPurchaseRatePct * 0.7))}% — retention would no longer carry the contribution advantage this plan relies on.`,
  );
  if (objective) {
    out.push(
      objective.presetId === "new-customers"
        ? "Profitable revenue replaces new-customer volume as the primary objective — the ranking would move back towards the repeat base."
        : "New customer acquisition becomes the primary objective — reach-led segments and channels would outrank the efficient repeat base.",
    );
  }
  if (selected[0]) {
    out.push(
      `${selected[0].segment.name} is materially smaller than the ${selected[0].segment.estimatedSize.toLocaleString("en-IN")} estimated here — the primary segment would not support this level of spend.`,
    );
  }
  return out;
}

function strategyConfidence(
  company: CompanyProfile,
  objective: GrowthObjective | null,
  selected: SegmentRecommendation[],
  scores: ChannelScore[],
): number {
  const funded = scores.filter((s) => s.funded);
  const channelConf = funded.length
    ? sum(funded.map((s) => s.channel.dataConfidence * s.sharePct)) / 100
    : 0.4;
  const segmentConf = selected.length ? selected[0].confidence : 0.45;
  const objectiveConf = objective?.interpretationConfidence ?? 0.5;
  // Missing context does not block the plan, but it does cost confidence — and
  // the cost is the same number the context screen showed the user.
  const completenessPenalty = assessCompleteness(company).confidencePenaltyPct / 100;
  return clamp(
    channelConf * 0.45 + segmentConf * 0.3 + objectiveConf * 0.25 - completenessPenalty,
    0.25,
    0.93,
  );
}
