import type {
  BudgetAllocation,
  CampaignProposal,
  CompanyProfile,
  CreativeAsset,
  GrowthObjective,
  GuardrailReport,
  PlanStage,
  SegmentRecommendation,
  StrategyRecommendation,
} from "@/lib/types";
import { applyInferredDefaults, assessCompleteness } from "./context";
import { scoreSegments } from "./segments";
import { buildStrategy, scoreChannels, type ChannelScore } from "./strategy";
import { allocationFromStrategy } from "./budget";
import { generateCreatives } from "./creative";
import { reviewCreatives } from "./guardrails";

/**
 * The orchestrator.
 *
 * COMPANY CONTEXT → NORMALISE → OBJECTIVE → SEGMENT SCORING → STRATEGY →
 * BUDGET → REASONING → CREATIVE → GUARDRAIL → HUMAN REVIEW → OUTCOME → PROPOSAL
 *
 * These are pipeline stages, not agents holding conversations. Each one takes
 * typed input and returns typed output, which is what makes the whole run
 * reproducible and the reasoning trace worth trusting.
 *
 * The two stages that are NOT in here are human review and approval. They
 * cannot be: the orchestrator has no code path that produces an approved plan.
 * Approval is only ever written by the approval screen, in response to a person
 * pressing the button.
 */

export interface PipelineResult {
  company: CompanyProfile;
  segmentRecommendations: SegmentRecommendation[];
  channelScores: ChannelScore[];
  strategy: StrategyRecommendation;
  recommendedAllocation: BudgetAllocation;
  creatives: CreativeAsset[];
  guardrailReport: GuardrailReport;
}

export function runPipeline(
  rawCompany: CompanyProfile,
  objective: GrowthObjective,
  selectedSegmentIds: string[],
): PipelineResult {
  // 1 & 2 — context, normalised with clearly-labelled inferred defaults.
  const company = applyInferredDefaults(rawCompany);

  // 3 — segment scoring under the confirmed objective.
  const segmentRecommendations = scoreSegments(company, objective);

  // The user's selection wins. If they have not chosen yet, the top-ranked
  // segment is the working assumption — never a locked-in decision.
  const selected =
    selectedSegmentIds.length > 0
      ? selectedSegmentIds
          .map((id) => segmentRecommendations.find((s) => s.segmentId === id))
          .filter((s): s is SegmentRecommendation => Boolean(s))
      : segmentRecommendations.slice(0, 1);

  // 4 & 5 — channel scoring and strategy.
  const channelScores = scoreChannels(company, objective, selected);
  const strategy = buildStrategy(company, objective, selected, channelScores);

  // 6 — budget from normalised channel scores.
  const recommendedAllocation = allocationFromStrategy(
    strategy,
    company,
    objective,
    selected,
    objective.monthlyBudgetINR,
  );

  // 7 & 8 — creative, then the guardrail pass over it.
  const creatives = generateCreatives(
    company,
    objective,
    strategy,
    selected,
    segmentRecommendations,
  );
  const guardrailReport = reviewCreatives(creatives);

  return {
    company,
    segmentRecommendations,
    channelScores,
    strategy,
    recommendedAllocation,
    creatives,
    guardrailReport,
  };
}

/* -------------------------------------------------------------------------- */
/* Stage gating                                                                */
/* -------------------------------------------------------------------------- */

export const PLAN_STAGES: { id: PlanStage; label: string; short: string; href: string }[] = [
  { id: "context", label: "Company context", short: "Context", href: "/plan/context" },
  { id: "objective", label: "Growth objective", short: "Objective", href: "/plan/objective" },
  { id: "segments", label: "Segment recommendation", short: "Segment", href: "/plan/segments" },
  { id: "strategy", label: "Strategy & reasoning", short: "Strategy", href: "/plan/strategy" },
  { id: "budget", label: "Budget allocation", short: "Budget", href: "/plan/budget" },
  { id: "creative", label: "Creative", short: "Creative", href: "/plan/creative" },
  { id: "guardrails", label: "Guardrail review", short: "Guardrails", href: "/plan/guardrails" },
  { id: "approval", label: "Human approval", short: "Approval", href: "/plan/approval" },
  { id: "outcome", label: "Outcome range", short: "Outcome", href: "/plan/outcome" },
];

export function stageIndex(stage: PlanStage): number {
  return PLAN_STAGES.findIndex((s) => s.id === stage);
}

/**
 * What a stage needs before it can be opened.
 *
 * The gate that matters is `outcome`: it requires an approval record, and no
 * amount of clicking around gets past it. The scenario band is a consequence of
 * a decision a human made, not a preview offered before the decision.
 */
export function stageBlockedReason(
  plan: CampaignProposal | null,
  stage: PlanStage,
): string | null {
  if (!plan) return "Start a growth plan first.";
  switch (stage) {
    case "context":
      return null;
    case "objective":
      return plan.company ? null : "Add your company context first.";
    case "segments":
      return plan.objective?.confirmed
        ? null
        : "Confirm how GrowthOS read your objective before segments are ranked.";
    case "strategy":
      return plan.selectedSegmentIds.length > 0 ? null : "Select at least one segment.";
    case "budget":
      return plan.strategy ? null : "Generate the strategy first.";
    case "creative":
      return plan.finalAllocation ? null : "Set the budget allocation first.";
    case "guardrails":
      return plan.creatives.length > 0 ? null : "Generate campaign creative first.";
    case "approval":
      return plan.guardrailReport ? null : "Run the guardrail review first.";
    case "outcome":
      return plan.approval
        ? null
        : "The outcome range is only available after a human has approved the plan. GrowthOS does not show projected results for a decision nobody has taken.";
    default:
      return null;
  }
}

export function isStageComplete(plan: CampaignProposal | null, stage: PlanStage): boolean {
  return Boolean(plan?.completedStages.includes(stage));
}

export { assessCompleteness, applyInferredDefaults };
