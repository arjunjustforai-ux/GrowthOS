"use client";

import React from "react";
import { UPPER_SCENARIO_WARNING, baselineRevenue } from "@/lib/engine/outcome";
import { selectedRecommendations } from "@/lib/store/plan";
import { formatCompactINR, formatSignedPct } from "@/lib/format";
import { GatedStage, PlanStagePage, StageFooter } from "@/components/plan/PlanStage";
import {
  Badge,
  Callout,
  Card,
  ConfidencePill,
  DecisionBanner,
  cx,
} from "@/components/ui";
import { stageBlockedReason } from "@/lib/engine/pipeline";
import { useWorkspace } from "@/lib/store/workspace";

function OutcomePageBody() {
  const { plan, track } = useWorkspace();
  const [pokedUpper, setPokedUpper] = React.useState(false);

  React.useEffect(() => {
    if (plan?.outcome) track("outcome_panel_opened");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(plan?.outcome)]);

  const outcome = plan?.outcome;
  if (!outcome || !plan?.company || !plan.finalAllocation) return null;

  const baseline = baselineRevenue(
    plan.company,
    plan.objective,
    selectedRecommendations(plan.segmentRecommendations, plan.selectedSegmentIds),
    plan.finalAllocation.totalBudgetINR,
    plan.strategy?.confidence ?? 0.6,
  );
  const centre = (outcome.baseLowINR + outcome.baseHighINR) / 2;
  const vsBaseline = baseline > 0 ? ((centre - baseline) / baseline) * 100 : 0;

  return (
    <PlanStagePage
      stage="outcome"
      title="Outcome range"
      description="A band, three assumptions, three uncertainty drivers, and a list of the things that would make all of it wrong. GrowthOS does not publish a single predicted number, because a single number gets treated as a promise."
      meta={
        <>
          <ConfidencePill confidence={outcome.confidence} band={outcome.confidenceBand} />
          <Badge tone="amber" className="normal-case tracking-normal">
            This is not a forecast
          </Badge>
        </>
      }
      footer={
        <StageFooter
          backHref="/plan/approval"
          backLabel="Approval"
          continueHref="/proposal"
          continueLabel="Open growth decision proposal"
        />
      }
    >
      <div className="space-y-6">
        <DecisionBanner>
          If this plan runs, what range of outcomes is plausible — and under exactly which
          assumptions does that range hold?
        </DecisionBanner>

        <Card className="overflow-hidden">
          <div className="border-b border-line-soft px-6 py-5">
            <p className="eyebrow">Modelled monthly revenue from this plan</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-navy-500">
              At {formatCompactINR(plan.finalAllocation.totalBudgetINR)} of monthly spend, against
              the segment and channel mix you approved.
            </p>
          </div>

          <div className="px-6 py-8">
            <ScenarioBand outcome={outcome} onUpperPoke={() => setPokedUpper(true)} />

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <BandStat
                label="Low scenario"
                value={formatCompactINR(outcome.lowINR)}
                note="Assumptions break in the unfavourable direction."
              />
              <BandStat
                label="Central range"
                value={`${formatCompactINR(outcome.baseLowINR)} – ${formatCompactINR(outcome.baseHighINR)}`}
                note="Where the model puts most of its weight."
                emphasis
              />
              <BandStat
                label="Upper scenario"
                value={formatCompactINR(outcome.highINR)}
                note="Not potential revenue. Not a target."
              />
            </div>

            {pokedUpper ? (
              <Callout tone="warning" className="mt-5">
                {UPPER_SCENARIO_WARNING}
              </Callout>
            ) : null}

            <div className="mt-6 rounded-card border border-line bg-ivory-50 px-5 py-4">
              <p className="text-[13px] leading-relaxed text-navy-600">
                Against the current channel mix at the same budget, the model puts the baseline at{" "}
                <span className="tnum font-medium text-navy-800">{formatCompactINR(baseline)}</span>.
                This plan&rsquo;s central range sits{" "}
                <span
                  className={cx(
                    "tnum font-medium",
                    vsBaseline >= 0 ? "text-success-700" : "text-danger-700",
                  )}
                >
                  {formatSignedPct(vsBaseline, 1)}
                </span>{" "}
                against it. That comparison is the honest way to read this screen: it is the change
                the reallocation is expected to produce, not a prediction of the month.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="px-5 py-5">
            <h3 className="font-serif text-lg text-navy-800">This range holds only if</h3>
            <ol className="mt-4 space-y-3">
              {outcome.assumptions.map((a, i) => (
                <li key={a} className="flex gap-3 text-[13px] leading-relaxed text-navy-600">
                  <span className="tnum mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-2xs font-semibold text-navy-500">
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="px-5 py-5">
            <h3 className="font-serif text-lg text-navy-800">What the band is widened by</h3>
            <ul className="mt-4 space-y-3">
              {outcome.uncertaintyDrivers.map((d) => (
                <li key={d} className="flex gap-3 text-[13px] leading-relaxed text-navy-600">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                  {d}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="border-danger-200 bg-danger-50/40 px-5 py-5">
          <h3 className="font-serif text-xl text-navy-800">What would make this wrong?</h3>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-navy-600">
            Mandatory on every plan. If any of these happens inside the cycle, the range above stops
            describing reality and the plan should be rebuilt rather than defended.
          </p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {outcome.whatWouldMakeThisWrong.map((w) => (
              <li
                key={w}
                className="rounded-lg border border-danger-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-navy-700"
              >
                {w}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="px-5 py-5">
          <h3 className="font-serif text-lg text-navy-800">Historical basis</h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-navy-600">
            {outcome.historicalBasis}
          </p>
          <p className="mt-3 border-t border-line-soft pt-3 text-xs leading-relaxed text-navy-400">
            {outcome.upperBoundCaveat}
          </p>
        </Card>
      </div>
    </PlanStagePage>
  );
}

function ScenarioBand({
  outcome,
  onUpperPoke,
}: {
  outcome: NonNullable<ReturnType<typeof useWorkspace>["plan"]>["outcome"];
  onUpperPoke: () => void;
}) {
  if (!outcome) return null;
  const span = outcome.highINR - outcome.lowINR || 1;
  const pos = (v: number) => ((v - outcome.lowINR) / span) * 100;
  const innerLeft = pos(outcome.baseLowINR);
  const innerWidth = pos(outcome.baseHighINR) - innerLeft;

  return (
    <div>
      <div className="relative h-20">
        {/* Full band: everything the model considers plausible. */}
        <div className="absolute inset-x-0 top-8 h-4 rounded-pill bg-gradient-to-r from-amber-100 via-accent-100 to-amber-100" />
        {/* Central range: where the weight actually sits. */}
        <div
          className="absolute top-6 h-8 rounded-pill border border-accent-300 bg-accent-200/70"
          style={{ left: `${innerLeft}%`, width: `${innerWidth}%` }}
        />
        <Marker position={0} label="Low" value={formatCompactINR(outcome.lowINR)} />
        <Marker
          position={innerLeft + innerWidth / 2}
          label="Central range"
          value={`${formatCompactINR(outcome.baseLowINR)}–${formatCompactINR(outcome.baseHighINR)}`}
          strong
        />
        <Marker
          position={100}
          label="Upper scenario"
          value={formatCompactINR(outcome.highINR)}
          onHover={onUpperPoke}
        />
      </div>
      <p className="mt-3 text-center text-xs text-navy-400">
        The width of this band is the honest part. A narrower band would need data this account does
        not have.
      </p>
    </div>
  );
}

function Marker({
  position,
  label,
  value,
  strong,
  onHover,
}: {
  position: number;
  label: string;
  value: string;
  strong?: boolean;
  onHover?: () => void;
}) {
  return (
    <div
      className="absolute top-0 -translate-x-1/2 text-center"
      style={{ left: `${Math.max(6, Math.min(94, position))}%` }}
      onMouseEnter={onHover}
      onFocus={onHover}
      tabIndex={onHover ? 0 : undefined}
    >
      <p
        className={cx(
          "tnum whitespace-nowrap font-serif leading-none",
          strong ? "text-xl text-navy-800" : "text-base text-navy-600",
        )}
      >
        {value}
      </p>
      <p className="mt-1 whitespace-nowrap text-2xs font-semibold uppercase tracking-[0.09em] text-navy-400">
        {label}
      </p>
      <span
        aria-hidden
        className={cx(
          "mx-auto mt-1 block h-4 w-px",
          strong ? "bg-navy-500" : "bg-navy-300",
        )}
      />
    </div>
  );
}

function BandStat({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-card border px-4 py-4",
        emphasis ? "border-accent-200 bg-accent-50/60" : "border-line bg-white",
      )}
    >
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1.5 font-serif text-xl leading-tight text-navy-800">{value}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-navy-400">{note}</p>
    </div>
  );
}

/**
 * The gate runs first. OutcomePageBody reads directly into the plan's
 * outcome data, so it is only mounted once that data is guaranteed to exist.
 */
export default function OutcomePage() {
  const { plan, ready } = useWorkspace();
  if (!ready || stageBlockedReason(plan, "outcome")) return <GatedStage stage="outcome" />;
  return <OutcomePageBody />;
}
