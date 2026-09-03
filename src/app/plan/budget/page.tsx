"use client";

import React from "react";
import type { ChannelId } from "@/lib/types";
import { formatCompactINR, formatINR, formatNumber, formatSignedPts } from "@/lib/format";
import { GatedStage, PlanStagePage, StageFooter } from "@/components/plan/PlanStage";
import {
  Badge,
  Button,
  Callout,
  Card,
  ConfidencePill,
  DecisionBanner,
  Field,
  Input,
  Meter,
  Stat,
  cx,
} from "@/components/ui";
import { stageBlockedReason } from "@/lib/engine/pipeline";
import { useWorkspace } from "@/lib/store/workspace";

function BudgetPageBody() {
  const {
    plan,
    setChannelShare,
    setBudgetTotal,
    resetBudgetToRecommendation,
    commitBudget,
    track,
  } = useWorkspace();

  const final = plan?.finalAllocation;
  const recommended = plan?.recommendedAllocation;
  const [locked, setLocked] = React.useState<Set<ChannelId>>(new Set());
  const [reason, setReason] = React.useState("");

  if (!final || !recommended || !plan?.objective) return null;

  const impact = final.impact;
  const recImpact = recommended.impact;
  const deviated = impact.deviationFromRecommendationPts > 0;

  function toggleLock(id: ChannelId) {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <PlanStagePage
      stage="budget"
      title="Budget allocation"
      description="Move any line. Everything else reflows to keep the split at 100%, and the projected economics recompute against each channel's own cost curve — because pushing more money through a channel does not buy the same customer at the same price."
      meta={
        <>
          <ConfidencePill confidence={impact.confidence} band={impact.confidenceBand} />
          <Badge
            tone={
              impact.riskLevel === "low" ? "success" : impact.riskLevel === "elevated" ? "amber" : "danger"
            }
          >
            {impact.riskLevel} risk
          </Badge>
        </>
      }
      actions={
        deviated ? (
          <Button size="sm" onClick={resetBudgetToRecommendation}>
            Reset to recommendation
          </Button>
        ) : null
      }
      footer={
        <StageFooter
          backHref="/plan/strategy"
          backLabel="Strategy"
          continueHref="/plan/creative"
          continueLabel="Generate creative"
          onContinue={() => commitBudget(reason.trim() || undefined)}
          note={
            deviated
              ? `Recorded as an override: ${impact.deviationFromRecommendationPts} pts from the model.`
              : "Checkpoint 3 — this is the split that gets approved."
          }
        />
      }
    >
      <div className="space-y-6">
        <DecisionBanner>
          Exactly how much money goes to each channel next month, and what does moving it cost?
        </DecisionBanner>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card className="px-5 py-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Monthly budget</p>
                  <p className="tnum mt-1.5 font-serif text-4xl leading-none text-navy-800">
                    {formatCompactINR(final.totalBudgetINR)}
                  </p>
                </div>
                <div className="w-44">
                  <Field label="Adjust total (₹)">
                    <Input
                      type="number"
                      step={10000}
                      value={final.totalBudgetINR}
                      onChange={(e) => setBudgetTotal(Number(e.target.value) || 0)}
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                {final.lines.map((line) => {
                  const rec = recommended.lines.find((r) => r.channelId === line.channelId);
                  const delta = line.sharePct - (rec?.sharePct ?? 0);
                  const isLocked = locked.has(line.channelId);
                  return (
                    <div key={line.channelId}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-medium text-navy-800">
                            {line.channelName}
                          </span>
                          <Badge tone="outline" className="normal-case tracking-normal">
                            {line.roleLabel}
                          </Badge>
                          {delta !== 0 ? (
                            <span
                              className={cx(
                                "tnum text-xs font-semibold",
                                delta > 0 ? "text-accent-600" : "text-amber-600",
                              )}
                            >
                              {formatSignedPts(delta, 0)} vs model
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="tnum text-sm text-navy-500">
                            {formatCompactINR(line.amountINR)}
                          </span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={line.sharePct}
                              disabled={isLocked}
                              onChange={(e) =>
                                setChannelShare(line.channelId, Number(e.target.value) || 0, locked)
                              }
                              className="h-8 w-16 py-1 text-right text-[13px]"
                            />
                            <span className="text-[13px] text-navy-400">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleLock(line.channelId)}
                            aria-pressed={isLocked}
                            title={isLocked ? "Unlock this channel" : "Lock this channel"}
                            className={cx(
                              "rounded border px-2 py-1 text-2xs font-semibold uppercase tracking-[0.08em] transition-colors",
                              isLocked
                                ? "border-navy-800 bg-navy-800 text-ivory-100"
                                : "border-line-strong text-navy-400 hover:border-navy-300",
                            )}
                          >
                            {isLocked ? "Locked" : "Lock"}
                          </button>
                        </div>
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={line.sharePct}
                        disabled={isLocked}
                        aria-label={`${line.channelName} share of budget`}
                        onChange={(e) =>
                          setChannelShare(line.channelId, Number(e.target.value), locked)
                        }
                        className="mt-3"
                      />

                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-2xs text-navy-300">Model: {rec?.sharePct ?? 0}%</span>
                        <div className="relative h-1 flex-1 rounded-pill bg-navy-100">
                          <div
                            className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-navy-400"
                            style={{ left: `${rec?.sharePct ?? 0}%` }}
                            aria-hidden
                          />
                          <div
                            className="h-full rounded-pill bg-accent-400"
                            style={{ width: `${line.sharePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="px-5 py-4">
                <h3 className="font-serif text-lg text-navy-800">
                  AI recommendation vs your final allocation
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-navy-400">
                  These are kept apart on purpose. The gap between them is the human judgement in
                  this plan, and it belongs on the proposal by name.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line-soft bg-ivory-50 text-left">
                    <th className="px-5 py-2 font-medium text-navy-400">Channel</th>
                    <th className="px-3 py-2 text-right font-medium text-navy-400">AI</th>
                    <th className="px-3 py-2 text-right font-medium text-navy-400">You</th>
                    <th className="px-3 py-2 text-right font-medium text-navy-400">Δ</th>
                    <th className="px-5 py-2 text-right font-medium text-navy-400">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {final.lines.map((line) => {
                    const rec = recommended.lines.find((r) => r.channelId === line.channelId);
                    const delta = line.sharePct - (rec?.sharePct ?? 0);
                    return (
                      <tr key={line.channelId} className="border-b border-line-soft last:border-0">
                        <td className="px-5 py-2.5 font-medium text-navy-700">{line.channelName}</td>
                        <td className="tnum px-3 py-2.5 text-right text-navy-400">
                          {rec?.sharePct ?? 0}%
                        </td>
                        <td className="tnum px-3 py-2.5 text-right font-semibold text-navy-800">
                          {line.sharePct}%
                        </td>
                        <td
                          className={cx(
                            "tnum px-3 py-2.5 text-right",
                            delta > 0 ? "text-accent-600" : delta < 0 ? "text-amber-600" : "text-navy-300",
                          )}
                        >
                          {delta === 0 ? "—" : formatSignedPts(delta, 0)}
                        </td>
                        <td className="tnum px-5 py-2.5 text-right text-navy-600">
                          {formatCompactINR(line.amountINR)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {deviated ? (
              <Card className="border-amber-200 bg-amber-50/60 px-5 py-5">
                <h3 className="font-serif text-lg text-navy-800">
                  Allocation differs materially from the AI recommendation
                </h3>
                <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-navy-600">
                  {impact.deviationFromRecommendationPts} percentage points have been moved. That is
                  fine — but write down why, because in six weeks nobody will remember, and this is
                  the sentence that turns an override into a defensible decision.
                </p>
                <div className="mt-4 max-w-xl">
                  <Field
                    label="Reason for the change"
                    hint="Example: “Upcoming Meta creator campaign expected to improve CTR.”"
                  >
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="What do you know that the model does not?"
                      className="!font-sans"
                    />
                  </Field>
                </div>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-4">
            <Card className="px-5 py-5">
              <p className="eyebrow">Projected impact</p>
              <p className="mt-1 text-xs leading-relaxed text-navy-400">
                Recomputed on every change, against each channel&rsquo;s own cost-elasticity curve.
              </p>

              <div className="mt-4 space-y-3">
                <ImpactRow
                  label="Blended CAC"
                  from={formatINR(recImpact.projectedBlendedCacINR)}
                  to={formatINR(impact.projectedBlendedCacINR)}
                  worse={impact.projectedBlendedCacINR > recImpact.projectedBlendedCacINR}
                  changed={impact.projectedBlendedCacINR !== recImpact.projectedBlendedCacINR}
                />
                <ImpactRow
                  label="New customers"
                  from={formatNumber(recImpact.projectedNewCustomers)}
                  to={formatNumber(impact.projectedNewCustomers)}
                  worse={impact.projectedNewCustomers < recImpact.projectedNewCustomers}
                  changed={impact.projectedNewCustomers !== recImpact.projectedNewCustomers}
                />
                <ImpactRow
                  label="Contribution margin"
                  from={formatCompactINR(recImpact.projectedContributionMarginINR)}
                  to={formatCompactINR(impact.projectedContributionMarginINR)}
                  worse={
                    impact.projectedContributionMarginINR < recImpact.projectedContributionMarginINR
                  }
                  changed={
                    impact.projectedContributionMarginINR !== recImpact.projectedContributionMarginINR
                  }
                />
                <ImpactRow
                  label="Modelled ROAS"
                  from={`${recImpact.projectedRoas.toFixed(2)}x`}
                  to={`${impact.projectedRoas.toFixed(2)}x`}
                  worse={impact.projectedRoas < recImpact.projectedRoas}
                  changed={impact.projectedRoas !== recImpact.projectedRoas}
                />
                <ImpactRow
                  label="Confidence"
                  from={`${Math.round(recImpact.confidence * 100)}%`}
                  to={`${Math.round(impact.confidence * 100)}%`}
                  worse={impact.confidence < recImpact.confidence}
                  changed={impact.confidence !== recImpact.confidence}
                />
              </div>

              <div className="mt-5 border-t border-line-soft pt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-navy-400">
                    Distance from model
                  </span>
                  <span className="tnum text-sm font-semibold text-navy-800">
                    {impact.deviationFromRecommendationPts} pts
                  </span>
                </div>
                <Meter
                  value={Math.min(100, impact.deviationFromRecommendationPts * 4)}
                  tone={
                    impact.deviationFromRecommendationPts > 15
                      ? "danger"
                      : impact.deviationFromRecommendationPts > 5
                        ? "amber"
                        : "success"
                  }
                />
              </div>
            </Card>

            {impact.constraintBreaches.length > 0 ? (
              <Callout tone="danger" title="This breaks a constraint you set">
                <ul className="mt-1 space-y-2">
                  {impact.constraintBreaches.map((b) => (
                    <li key={b} className="leading-relaxed">
                      {b}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 leading-relaxed">
                  GrowthOS will not stop you. It will record that the approved plan was known to
                  breach the constraint at the time it was approved.
                </p>
              </Callout>
            ) : null}

            {impact.concentrationWarning ? (
              <Callout tone="warning" title="Concentration risk">
                {impact.concentrationWarning}
              </Callout>
            ) : null}

            <Stat
              label="Modelled monthly revenue"
              value={formatCompactINR(impact.projectedRevenueINR)}
              sub="A single modelled figure. The approved plan gets a scenario range instead — see the outcome stage."
              tone="accent"
            />
          </aside>
        </div>
      </div>
    </PlanStagePage>
  );
}

function ImpactRow({
  label,
  from,
  to,
  worse,
  changed,
}: {
  label: string;
  from: string;
  to: string;
  worse: boolean;
  changed: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-navy-500">{label}</span>
      <span className="tnum flex items-baseline gap-1.5 text-sm">
        {changed ? (
          <>
            <span className="text-navy-300 line-through decoration-navy-200">{from}</span>
            <span aria-hidden className="text-navy-300">
              →
            </span>
            <span className={cx("font-semibold", worse ? "text-danger-700" : "text-success-700")}>
              {to}
            </span>
          </>
        ) : (
          <span className="font-semibold text-navy-800">{to}</span>
        )}
      </span>
    </div>
  );
}

/**
 * The gate runs first. BudgetPageBody reads directly into the plan's
 * budget data, so it is only mounted once that data is guaranteed to exist.
 */
export default function BudgetPage() {
  const { plan, ready } = useWorkspace();
  if (!ready || stageBlockedReason(plan, "budget")) return <GatedStage stage="budget" />;
  return <BudgetPageBody />;
}
