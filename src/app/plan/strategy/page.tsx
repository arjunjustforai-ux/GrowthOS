"use client";

import React from "react";
import { formatCompactINR, formatINR } from "@/lib/format";
import { CHANNEL_WEIGHTS, MIN_CONTRIBUTION_RATIO } from "@/lib/engine/strategy";
import { CONFIDENCE_CAVEAT } from "@/lib/engine/confidence";
import { GatedStage, PlanStagePage, StageFooter } from "@/components/plan/PlanStage";
import { ReasoningTrace, WouldChangeThis } from "@/components/plan/ReasoningTrace";
import {
  Badge,
  Callout,
  Card,
  ConfidencePill,
  DecisionBanner,
  Disclosure,
  Meter,
  cx,
} from "@/components/ui";
import { stageBlockedReason } from "@/lib/engine/pipeline";
import { useWorkspace } from "@/lib/store/workspace";

function StrategyPageBody() {
  const { plan, completeStage, track } = useWorkspace();
  const strategy = plan?.strategy;
  const objective = plan?.objective;
  const company = plan?.company;
  const primary = plan?.segmentRecommendations.find(
    (s) => s.segmentId === strategy?.primarySegmentId,
  );

  if (!strategy || !objective || !company) return null;

  const excluded = company.channels.filter(
    (c) => !strategy.channelRoles.some((r) => r.channelId === c.id),
  );

  return (
    <PlanStagePage
      stage="strategy"
      title={strategy.headline}
      description="This is the argument. Every recommendation below is traced from a number in your account, through what GrowthOS took that number to mean, to the decision it produced."
      meta={
        <>
          <ConfidencePill confidence={strategy.confidence} band={strategy.confidenceBand} />
          <Badge tone="outline" className="normal-case tracking-normal">
            {plan.completeness?.scorePct ?? 100}% context completeness
          </Badge>
        </>
      }
      footer={
        <StageFooter
          backHref="/plan/segments"
          backLabel="Segments"
          continueHref="/plan/budget"
          continueLabel="Edit the budget"
          onContinue={() => completeStage("strategy")}
          note="Nothing here is committed. The budget screen is where you change it."
        />
      }
    >
      <div className="space-y-6">
        <DecisionBanner>
          Given who we are buying and what we are optimising for, what role should each channel play
          — and which channels should get nothing at all?
        </DecisionBanner>

        <Card className="overflow-hidden">
          <div className="border-b border-line-soft bg-ivory-50 px-6 py-5">
            <p className="eyebrow">Strategy recommendation</p>
            <p className="mt-3 max-w-prose font-serif text-[22px] leading-snug text-navy-800">
              {strategy.strategicDirection}
            </p>
          </div>

          <dl className="grid gap-px bg-line-soft sm:grid-cols-3">
            <SummaryCell label="Objective" value={objective.interpretation.split(".")[0]} />
            <SummaryCell
              label="Primary segment"
              value={primary?.segment.name ?? "—"}
              sub={
                primary
                  ? `${primary.segment.estimatedSize.toLocaleString("en-IN")} people · ${formatINR(primary.segment.historicalCacINR)} historical CAC`
                  : undefined
              }
            />
            <SummaryCell
              label="Monthly budget"
              value={formatCompactINR(objective.monthlyBudgetINR)}
              sub={`Across ${strategy.channelRoles.length} funded channel${strategy.channelRoles.length === 1 ? "" : "s"}`}
            />
          </dl>
        </Card>

        <section>
          <h2 className="font-serif text-xl text-navy-800">Recommended channel roles</h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-navy-400">
            A channel is not a budget line, it is a job. Each of these has one.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {strategy.channelRoles.map((role) => (
              <Card key={role.channelId} className="px-5 py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-lg text-navy-800">{role.channelName}</h3>
                  <span className="tnum font-serif text-3xl leading-none text-navy-800">
                    {role.sharePct}%
                  </span>
                </div>
                <Badge tone="accent" className="mt-2.5 normal-case tracking-normal">
                  {role.roleLabel}
                </Badge>
                <Meter className="mt-4" value={role.sharePct} tone="accent" />
                <p className="mt-4 text-[13px] leading-relaxed text-navy-600">{role.rationale}</p>

                <Disclosure className="mt-4" summary="Channel score breakdown">
                  <ul className="space-y-2">
                    {(
                      [
                        ["historicalEfficiency", "Historical efficiency"],
                        ["marginalScalability", "Marginal scalability"],
                        ["objectiveAlignment", "Objective alignment"],
                        ["audienceFit", "Audience fit"],
                        ["confidence", "Data confidence"],
                      ] as const
                    ).map(([key, label]) => (
                      <li key={key}>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-navy-500">
                            {label}{" "}
                            <span className="text-navy-300">
                              ×{(CHANNEL_WEIGHTS[key] * 100).toFixed(0)}%
                            </span>
                          </span>
                          <span className="tnum font-medium text-navy-700">
                            {(role.breakdown[key] * 100).toFixed(0)}
                          </span>
                        </div>
                        <Meter className="mt-1" value={role.breakdown[key] * 100} tone="navy" />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-navy-400">
                    Weighted score {(role.score * 100).toFixed(1)} / 100.
                  </p>
                </Disclosure>
              </Card>
            ))}
          </div>
        </section>

        {excluded.length > 0 ? (
          <Card className="border-danger-200 px-5 py-5">
            <h3 className="font-serif text-lg text-navy-800">
              Not funded this cycle: {excluded.map((c) => c.name).join(", ")}
            </h3>
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-navy-600">
              A channel that cannot clear the {MIN_CONTRIBUTION_RATIO.toFixed(1)}x contribution floor
              gets zero, not a token 4%. Giving it a small share would spread the budget without
              improving the outcome and would make the plan harder to defend, not easier.
            </p>
            <ul className="mt-4 space-y-2.5">
              {excluded.map((c) => (
                <li key={c.id} className="rounded-lg border border-line bg-ivory-50 px-4 py-3">
                  <p className="text-sm font-medium text-navy-800">{c.name}</p>
                  <p className="tnum mt-1 text-xs text-navy-500">
                    ROAS {c.roas.toFixed(2)}x × {company.grossMarginPct}% margin ={" "}
                    {(c.roas * (company.grossMarginPct / 100)).toFixed(2)}x contribution ratio ·
                    currently {formatCompactINR(c.monthlySpendINR)}/month
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-navy-800">Reasoning trace</h2>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-navy-400">
                Input → interpretation → decision, for every material call in this plan. Open by
                default, because &ldquo;why?&rdquo; is the question this product exists to answer.
              </p>
            </div>
            <Badge tone="outline" className="normal-case tracking-normal">
              {strategy.reasoning.length} nodes
            </Badge>
          </div>
          <ReasoningTrace
            className="mt-4"
            nodes={strategy.reasoning}
            onOpen={() => track("reasoning_opened", { stage: "strategy" })}
          />
        </section>

        <WouldChangeThis items={strategy.wouldChangeIf} />

        <Callout tone="quiet">
          <p className="font-medium text-navy-700">On the confidence figure</p>
          <p className="mt-1 leading-relaxed">{CONFIDENCE_CAVEAT}</p>
        </Callout>
      </div>
    </PlanStagePage>
  );
}

function SummaryCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white px-6 py-4">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium leading-snug text-navy-800">{value}</dd>
      {sub ? <p className="tnum mt-1 text-xs text-navy-400">{sub}</p> : null}
    </div>
  );
}

/**
 * The gate runs first. StrategyPageBody reads directly into the plan's
 * strategy data, so it is only mounted once that data is guaranteed to exist.
 */
export default function StrategyPage() {
  const { plan, ready } = useWorkspace();
  if (!ready || stageBlockedReason(plan, "strategy")) return <GatedStage stage="strategy" />;
  return <StrategyPageBody />;
}
