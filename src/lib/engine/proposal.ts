import type { CampaignProposal } from "@/lib/types";
import { formatCompactINR, formatINR, formatDateTime, formatPct } from "@/lib/format";
import { accountMetrics } from "./context";

/**
 * Stage 10 — Proposal Composer.
 *
 * Produces the artefact the whole product exists to produce: a document the
 * marketing lead can put in front of a founder and defend line by line.
 * Everything here is derived from the plan — nothing is re-generated, so the
 * document and the screens can never disagree.
 */

export function executiveSummary(plan: CampaignProposal): string {
  const { company, objective, strategy, finalAllocation, outcome, approval } = plan;
  if (!company || !objective || !strategy || !finalAllocation) {
    return "This growth plan is not complete enough to summarise yet.";
  }
  const primary = plan.segmentRecommendations.find(
    (s) => s.segmentId === strategy.primarySegmentId,
  );
  const split = finalAllocation.lines
    .map((l) => `${l.channelName} ${l.sharePct}%`)
    .join(", ");
  const impact = finalAllocation.impact;

  const lines = [
    `${company.name} — ${plan.cycleLabel}`,
    ``,
    `OBJECTIVE. ${objective.rawText}`,
    `Read by GrowthOS as: ${objective.interpretation}`,
    ``,
    `PRIMARY SEGMENT. ${primary?.segment.name ?? "—"} (${primary?.segment.estimatedSize.toLocaleString("en-IN") ?? "—"} estimated, ${primary ? formatINR(primary.segment.historicalCacINR) : "—"} historical acquisition cost). ${primary?.rationale ?? ""}`,
    ``,
    `STRATEGY. ${strategy.strategicDirection}`,
    ``,
    `ALLOCATION. ${formatCompactINR(finalAllocation.totalBudgetINR)} per month — ${split}.`,
    `Modelled blended CAC ${formatINR(impact.projectedBlendedCacINR)}, contribution margin ${formatCompactINR(impact.projectedContributionMarginINR)}, ${formatPct(impact.confidence * 100)} confidence.`,
    plan.overrides.length > 0
      ? `${plan.overrides.length} human override${plan.overrides.length === 1 ? "" : "s"} recorded against the modelled recommendation.`
      : `No overrides — the approved plan matches the modelled recommendation.`,
    ``,
    outcome
      ? `OUTCOME RANGE. ${formatCompactINR(outcome.lowINR)} to ${formatCompactINR(outcome.highINR)} of modelled monthly revenue, central range ${formatCompactINR(outcome.baseLowINR)}–${formatCompactINR(outcome.baseHighINR)}, at ${formatPct(outcome.confidence * 100)} confidence. This is a scenario band, not a forecast; the upper figure is an upper scenario under stated assumptions and is not a target.`
      : `OUTCOME RANGE. Not generated — the plan has not been approved.`,
    ``,
    approval
      ? `APPROVED by ${approval.approvedBy} on ${formatDateTime(approval.approvedAt)} (${approval.version}). The approver remains responsible for the final marketing decision.`
      : `NOT YET APPROVED. GrowthOS provides decision support; it does not execute spend.`,
  ];
  return lines.join("\n");
}

/** A slide-by-slide outline a presenter can paste straight into a deck. */
export function pptOutline(plan: CampaignProposal): string {
  const { company, objective, strategy, finalAllocation, recommendedAllocation, outcome } = plan;
  if (!company || !objective || !strategy || !finalAllocation) {
    return "Plan incomplete.";
  }
  const primary = plan.segmentRecommendations.find(
    (s) => s.segmentId === strategy.primarySegmentId,
  );
  const metrics = accountMetrics(company);
  const s: string[] = [];

  s.push(`SLIDE 1 — ${company.name}: ${plan.cycleLabel}`);
  s.push(`• ${formatCompactINR(company.annualRevenueINR)} revenue · ${formatCompactINR(company.monthlyPaidSpendINR)}/month paid · ${company.marketingTeamSize}-person team`);
  s.push(`• Blended CAC today ${formatINR(metrics.blendedCacINR)} · ${company.grossMarginPct}% gross margin · ${company.repeatPurchaseRatePct}% repeat`);
  s.push(``);

  s.push(`SLIDE 2 — The decision we are making`);
  s.push(`• ${objective.rawText}`);
  objective.constraints.forEach((c) => s.push(`• Constraint: ${c.label}`));
  s.push(``);

  s.push(`SLIDE 3 — Who we are buying`);
  plan.segmentRecommendations.slice(0, 3).forEach((r) => {
    s.push(
      `• ${r.rank}. ${r.segment.name} — ${r.segment.estimatedSize.toLocaleString("en-IN")} people, ${formatINR(r.segment.historicalCacINR)} CAC, ${r.segment.repeatRatePct}% repeat${r.recommended ? " (recommended)" : ""}`,
    );
  });
  s.push(`• Selected: ${plan.selectedSegmentIds.map((id) => plan.segmentRecommendations.find((r) => r.segmentId === id)?.segment.name).filter(Boolean).join(", ")}`);
  s.push(``);

  s.push(`SLIDE 4 — Strategy`);
  s.push(`• ${strategy.strategicDirection}`);
  strategy.channelRoles.forEach((c) =>
    s.push(`• ${c.channelName} — ${c.roleLabel} — ${c.sharePct}%`),
  );
  s.push(``);

  s.push(`SLIDE 5 — Why (reasoning trace)`);
  strategy.reasoning.slice(0, 4).forEach((n) =>
    s.push(`• ${n.input} → ${n.interpretation} → ${n.decision}`),
  );
  s.push(``);

  s.push(`SLIDE 6 — Budget`);
  s.push(`• Total ${formatCompactINR(finalAllocation.totalBudgetINR)} per month`);
  finalAllocation.lines.forEach((l) => {
    const rec = recommendedAllocation?.lines.find((r) => r.channelId === l.channelId);
    const delta = rec ? l.sharePct - rec.sharePct : 0;
    s.push(
      `• ${l.channelName} ${formatCompactINR(l.amountINR)} (${l.sharePct}%)${delta !== 0 ? ` — human adjustment ${delta > 0 ? "+" : ""}${delta} pts vs model` : ""}`,
    );
  });
  s.push(``);

  s.push(`SLIDE 7 — Creative & guardrails`);
  plan.creatives.forEach((c) => s.push(`• ${c.channelLabel}: "${c.headline}" — ${c.status}`));
  if (plan.guardrailReport) {
    s.push(
      `• Guardrail: ${plan.guardrailReport.findings.length} finding(s), ${plan.guardrailReport.blockCount} block, ${plan.guardrailReport.warningCount} warning`,
    );
  }
  s.push(``);

  s.push(`SLIDE 8 — Outcome range (not a forecast)`);
  if (outcome) {
    s.push(`• Low ${formatCompactINR(outcome.lowINR)} · Central ${formatCompactINR(outcome.baseLowINR)}–${formatCompactINR(outcome.baseHighINR)} · Upper scenario ${formatCompactINR(outcome.highINR)}`);
    s.push(`• Confidence ${formatPct(outcome.confidence * 100)} — ${outcome.confidenceBand.toUpperCase()}`);
    outcome.whatWouldMakeThisWrong.slice(0, 3).forEach((w) => s.push(`• Risk: ${w}`));
  } else {
    s.push(`• Not generated — plan not approved.`);
  }
  s.push(``);

  s.push(`SLIDE 9 — Human approval`);
  if (plan.approval) {
    s.push(`• Approved by ${plan.approval.approvedBy}, ${formatDateTime(plan.approval.approvedAt)}`);
    s.push(`• ${plan.approval.editCount} edit(s), ${plan.approval.overrideCount} override(s), version ${plan.approval.version}`);
  } else {
    s.push(`• Awaiting approval.`);
  }
  s.push(`• GrowthOS provides decision support. It does not launch or optimise campaigns.`);

  if (company.isDemo) {
    s.push(``);
    s.push(`NOTE: Demo dataset — simulated for product demonstration. Not real customer data.`);
  }
  return s.join("\n");
}

export function proposalFilename(plan: CampaignProposal): string {
  const name = (plan.company?.name ?? "growth-plan").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${name}-${plan.cycleLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-proposal`;
}
