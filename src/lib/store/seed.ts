import type { CampaignProposal } from "@/lib/types";
import { AURA_SKINCARE, cloneCompany } from "@/lib/demo/companies";
import { interpretObjective } from "@/lib/engine/objective";
import { buildOutcome } from "@/lib/engine/outcome";
import { createPlan, markStage, newId, recompute } from "./plan";

/**
 * Seeded decision history.
 *
 * These are not hand-written fixtures — they are produced by running the real
 * pipeline against the real demo data, then marked approved. That matters: the
 * history a presenter scrolls past on the home screen is the same engine output
 * they are about to demonstrate live, at a different budget.
 */

function monthsAgo(n: number): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - n, 12, 11, 30, 0);
}

function seedApprovedPlan(monthsBack: number, budgetINR: number): CampaignProposal {
  const at = monthsAgo(monthsBack);
  const company = cloneCompany(AURA_SKINCARE);
  let plan = createPlan(company, at);

  const objective = interpretObjective(
    "Grow monthly revenue by 20% over the next quarter without increasing blended CAC above ₹1,200.",
    "profitable-revenue",
    company,
    budgetINR,
  );
  plan = {
    ...plan,
    objective: { ...objective, confirmed: true },
    createdAt: at.toISOString(),
    updatedAt: at.toISOString(),
  };
  plan = recompute(plan);
  plan = {
    ...plan,
    selectedSegmentIds: plan.segmentRecommendations.slice(0, 1).map((s) => s.segmentId),
  };
  plan = recompute(plan);

  plan = {
    ...plan,
    creatives: plan.creatives.map((c) => ({ ...c, status: "approved" as const })),
    completedStages: [
      "context",
      "objective",
      "segments",
      "strategy",
      "budget",
      "creative",
      "guardrails",
      "approval",
      "outcome",
    ],
    status: "approved",
    approval: {
      approvedBy: "Demo User",
      approvedAt: at.toISOString(),
      version: "v1.0",
      editCount: 0,
      overrideCount: 0,
      acknowledgedResponsibility: true,
      note: "Approved as recommended.",
    },
    auditLog: [
      ...plan.auditLog,
      {
        id: newId("audit"),
        at: at.toISOString(),
        actor: "user",
        action: "Plan approved",
        detail: "Approved as recommended, with no changes to the modelled allocation.",
      },
    ],
  };

  if (plan.strategy && plan.finalAllocation && plan.recommendedAllocation && plan.company) {
    plan = {
      ...plan,
      outcome: buildOutcome(
        plan.company,
        plan.objective,
        plan.strategy,
        plan.segmentRecommendations.slice(0, 1),
        plan.finalAllocation,
        plan.recommendedAllocation,
      ),
    };
  }
  plan = markStage(plan, "outcome");
  return plan;
}

export function seedHistory(): CampaignProposal[] {
  // Two closed cycles at smaller budgets, so the ramp is visible on the home
  // screen and the presenter has something to compare the new plan against.
  return [seedApprovedPlan(1, 550_000), seedApprovedPlan(2, 500_000)];
}
