import type {
  AuditLogEntry,
  BudgetAllocation,
  CampaignProposal,
  CompanyProfile,
  GrowthObjective,
  PlanStage,
  UserOverride,
} from "@/lib/types";
import { assessCompleteness } from "@/lib/engine/context";
import { runPipeline } from "@/lib/engine/pipeline";
import { recomputeAllocation } from "@/lib/engine/budget";

/**
 * Plan construction and recomputation.
 *
 * A plan holds two allocations at all times: what the engine recommended, and
 * what the human decided. They are never merged. The distance between them is
 * the most important thing on the approval screen, and collapsing them into one
 * number would erase the record of who chose what.
 */

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function cycleLabel(date = new Date()): string {
  return `${date.toLocaleString("en-IN", { month: "long" })} ${date.getFullYear()} Growth Plan`;
}

export function nextDecisionDate(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function createPlan(company: CompanyProfile | null, at = new Date()): CampaignProposal {
  const now = at.toISOString();
  return {
    id: newId("plan"),
    title: company ? `${company.name} — ${cycleLabel(at)}` : cycleLabel(at),
    cycleLabel: cycleLabel(at),
    createdAt: now,
    updatedAt: now,
    status: "draft",
    company,
    completeness: company ? assessCompleteness(company) : null,
    objective: null,
    segmentRecommendations: [],
    selectedSegmentIds: [],
    strategy: null,
    recommendedAllocation: null,
    finalAllocation: null,
    creatives: [],
    guardrailReport: null,
    outcome: null,
    overrides: [],
    auditLog: [
      {
        id: newId("audit"),
        at: now,
        actor: "growthos",
        action: "Plan created",
        detail: company
          ? `Workspace opened for ${company.name}.`
          : "Empty workspace opened.",
      },
    ],
    approval: null,
    completedStages: company ? ["context"] : [],
  };
}

export function audit(
  plan: CampaignProposal,
  actor: AuditLogEntry["actor"],
  action: string,
  detail: string,
): CampaignProposal {
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    auditLog: [
      ...plan.auditLog,
      { id: newId("audit"), at: new Date().toISOString(), actor, action, detail },
    ],
  };
}

export function recordOverride(
  plan: CampaignProposal,
  override: Omit<UserOverride, "id" | "at">,
): CampaignProposal {
  const entry: UserOverride = { ...override, id: newId("ovr"), at: new Date().toISOString() };
  return audit(
    { ...plan, overrides: [...plan.overrides, entry] },
    "user",
    `Override — ${override.kind}`,
    `${override.summary}${override.reason ? ` Reason: ${override.reason}` : ""}`,
  );
}

/**
 * Withdraw an approval because the thing that was approved has changed.
 *
 * An approval record names a specific allocation. If the allocation moves, that
 * record no longer describes anything real, and leaving it in place would put a
 * person's name against a plan they never saw. So it is withdrawn, loudly, in
 * the audit log — and the outcome band goes with it, because the band described
 * the old plan too.
 */
export function revokeApproval(plan: CampaignProposal, why: string): CampaignProposal {
  if (!plan.approval) return plan;
  return audit(
    { ...plan, approval: null, outcome: null, status: "draft" },
    "growthos",
    "Approval withdrawn",
    `${why} The plan is a draft again and must be re-approved by a person.`,
  );
}

export function markStage(plan: CampaignProposal, stage: PlanStage): CampaignProposal {
  if (plan.completedStages.includes(stage)) return plan;
  return { ...plan, completedStages: [...plan.completedStages, stage] };
}

/**
 * Re-run the pipeline against the plan's current inputs.
 *
 * `resetDownstream` is what makes an objective change feel honest: when the
 * question changes, the segment ranking, strategy, budget and creative are all
 * regenerated rather than being quietly carried forward from an answer to a
 * different question.
 */
export function recompute(
  plan: CampaignProposal,
  options: { resetDownstream?: boolean } = {},
): CampaignProposal {
  const { company, objective } = plan;
  if (!company || !objective) return plan;

  const result = runPipeline(company, objective, plan.selectedSegmentIds);
  const reset = options.resetDownstream ?? false;
  // A rebuild changes what would be approved, so any existing approval lapses.
  const base = reset
    ? revokeApproval(plan, "The plan was rebuilt after an input changed.")
    : plan;

  // Preserve the user's own creative edits and approvals across a recompute
  // unless the objective itself moved.
  const creatives = reset
    ? result.creatives
    : result.creatives.map((fresh) => {
        const existing = plan.creatives.find((c) => c.id === fresh.id);
        if (!existing || existing.status === "draft") return fresh;
        return { ...fresh, ...existing };
      });

  // The user's allocation is kept when only downstream detail changed; a reset
  // returns them to the model's recommendation and says so in the audit log.
  const keepUserAllocation =
    !reset &&
    plan.finalAllocation &&
    plan.finalAllocation.lines.length === result.recommendedAllocation.lines.length &&
    plan.finalAllocation.lines.every((l) =>
      result.recommendedAllocation.lines.some((r) => r.channelId === l.channelId),
    );

  const finalAllocation: BudgetAllocation = keepUserAllocation
    ? recomputeAllocation(
        plan.finalAllocation!.lines,
        result.recommendedAllocation,
        result.company,
        objective,
        selectedRecommendations(result.segmentRecommendations, plan.selectedSegmentIds),
        objective.monthlyBudgetINR,
        result.strategy.confidence,
      )
    : result.recommendedAllocation;

  return {
    ...base,
    company: result.company,
    completeness: assessCompleteness(result.company),
    segmentRecommendations: result.segmentRecommendations,
    strategy: result.strategy,
    recommendedAllocation: result.recommendedAllocation,
    finalAllocation,
    creatives,
    guardrailReport: result.guardrailReport,
    // The outcome band belongs to an approved decision. If the inputs move, it
    // is no longer describing the thing that was approved.
    outcome: reset ? null : base.outcome,
    updatedAt: new Date().toISOString(),
  };
}

export function selectedRecommendations(
  recommendations: CampaignProposal["segmentRecommendations"],
  ids: string[],
) {
  if (ids.length === 0) return recommendations.slice(0, 1);
  return ids
    .map((id) => recommendations.find((r) => r.segmentId === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
}

export function planVersion(plan: CampaignProposal): string {
  const edits = plan.auditLog.filter((a) => a.actor === "user").length;
  return `v1.${edits}`;
}

export function editCount(plan: CampaignProposal): number {
  return plan.auditLog.filter((a) => a.actor === "user").length;
}
