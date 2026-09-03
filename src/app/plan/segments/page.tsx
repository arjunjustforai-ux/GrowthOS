"use client";

import React from "react";
import type { SegmentRecommendation } from "@/lib/types";
import { BASE_WEIGHTS } from "@/lib/engine/segments";
import { formatINR, formatNumber } from "@/lib/format";
import { PlanStagePage, StageFooter } from "@/components/plan/PlanStage";
import { ReasoningTrace } from "@/components/plan/ReasoningTrace";
import {
  Badge,
  Button,
  Callout,
  Card,
  ConfidencePill,
  DecisionBanner,
  Disclosure,
  Field,
  Input,
  Meter,
  cx,
} from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

const FACTOR_LABELS: { key: keyof typeof BASE_WEIGHTS; label: string }[] = [
  { key: "profitability", label: "Profitability" },
  { key: "conversionPropensity", label: "Conversion propensity" },
  { key: "repeatBehaviour", label: "Repeat behaviour" },
  { key: "reachableAudience", label: "Reachable audience" },
  { key: "strategicFit", label: "Strategic fit" },
];

export default function SegmentsPage() {
  const { plan, selectSegments, track } = useWorkspace();
  const recommendations = plan?.segmentRecommendations ?? [];
  const recommended = recommendations.find((r) => r.recommended);

  const [selected, setSelected] = React.useState<string[]>(
    plan?.selectedSegmentIds.length ? plan.selectedSegmentIds : recommended ? [recommended.segmentId] : [],
  );
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (selected.length === 0 && recommended) setSelected([recommended.segmentId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended?.segmentId]);

  const isOverride =
    Boolean(recommended) && (selected.length !== 1 || selected[0] !== recommended!.segmentId);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  return (
    <PlanStagePage
      stage="segments"
      title="Who should this budget buy?"
      description="Three segments, scored on the same five factors, with the weights your objective set. The ranking is a recommendation — the selection is yours, and GrowthOS will not argue with it."
      meta={
        plan?.objective ? (
          <Badge tone="accent" className="normal-case tracking-normal">
            Scored for: {plan.objective.interpretation.split(".")[0]}
          </Badge>
        ) : null
      }
      footer={
        <StageFooter
          backHref="/plan/objective"
          backLabel="Objective"
          continueHref="/plan/strategy"
          continueLabel="Build strategy"
          continueDisabled={selected.length === 0}
          onContinue={() => selectSegments(selected, reason.trim() || undefined)}
          note={
            isOverride
              ? "Your override will be recorded on the proposal and the plan rebuilt around it."
              : "Checkpoint 2 — accept or override the ranking."
          }
        />
      }
    >
      <div className="space-y-6">
        <DecisionBanner>
          Which customers is next month&rsquo;s money going to be spent trying to reach, and what is
          the case for them over the alternatives?
        </DecisionBanner>

        <div className="grid gap-4 xl:grid-cols-3">
          {recommendations.map((rec) => (
            <SegmentCard
              key={rec.segmentId}
              rec={rec}
              selected={selected.includes(rec.segmentId)}
              onToggle={() => toggle(rec.segmentId)}
              onReasoningOpen={() => track("reasoning_opened", { segment: rec.segmentId })}
            />
          ))}
        </div>

        {isOverride ? (
          <Card className="border-amber-200 bg-amber-50/60 px-5 py-5">
            <h3 className="font-serif text-lg text-navy-800">
              You are overriding the recommendation
            </h3>
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-navy-600">
              GrowthOS ranked <strong>{recommended?.segment.name}</strong> first. You have selected{" "}
              <strong>
                {selected
                  .map((id) => recommendations.find((r) => r.segmentId === id)?.segment.name)
                  .filter(Boolean)
                  .join(", ") || "nothing"}
              </strong>
              . That is a legitimate call — you know things this account&rsquo;s data does not. The
              override goes on the proposal so the decision is attributable, and the channel mix,
              budget and creative are all rebuilt around your choice.
            </p>
            <div className="mt-4 max-w-xl">
              <Field
                label="Reason for the override (optional, but it is what makes the plan defensible)"
                hint="Example: “Upcoming creator campaign will lift first-time buyer conversion above historical levels.”"
              >
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is your judgement better than the data here?"
                  className="!font-sans"
                />
              </Field>
            </div>
          </Card>
        ) : null}

        <Card className="px-5 py-5">
          <h3 className="font-serif text-lg text-navy-800">How the score is built</h3>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-navy-400">
            Five factors, each normalised against the strongest segment in this account, then
            weighted. The base weights come from the scoring model; your objective adjusts them.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-2 pr-4 font-medium text-navy-400">Factor</th>
                  <th className="px-3 py-2 text-right font-medium text-navy-400">Base weight</th>
                  <th className="px-3 py-2 text-right font-medium text-navy-400">Applied weight</th>
                  {recommendations.map((r) => (
                    <th key={r.segmentId} className="px-3 py-2 text-right font-medium text-navy-400">
                      {r.segment.name.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FACTOR_LABELS.map(({ key, label }) => {
                  const applied = recommendations[0]?.weights[key] ?? BASE_WEIGHTS[key];
                  const shifted = Math.abs(applied - BASE_WEIGHTS[key]) > 0.001;
                  return (
                    <tr key={key} className="border-b border-line-soft last:border-0">
                      <td className="py-2.5 pr-4 text-navy-700">{label}</td>
                      <td className="tnum px-3 py-2.5 text-right text-navy-400">
                        {(BASE_WEIGHTS[key] * 100).toFixed(0)}%
                      </td>
                      <td
                        className={cx(
                          "tnum px-3 py-2.5 text-right font-medium",
                          shifted ? "text-accent-600" : "text-navy-600",
                        )}
                      >
                        {(applied * 100).toFixed(0)}%
                      </td>
                      {recommendations.map((r) => (
                        <td key={r.segmentId} className="tnum px-3 py-2.5 text-right text-navy-600">
                          {(r.breakdown[key] * 100).toFixed(0)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-t border-line">
                  <td className="py-2.5 pr-4 font-medium text-navy-800">Weighted score</td>
                  <td />
                  <td />
                  {recommendations.map((r) => (
                    <td
                      key={r.segmentId}
                      className="tnum px-3 py-2.5 text-right font-semibold text-navy-800"
                    >
                      {(r.score * 100).toFixed(1)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-navy-400">
            Factor columns are 0–100 after normalisation against the strongest segment in this
            account, not absolute quality scores.
          </p>
        </Card>
      </div>
    </PlanStagePage>
  );
}

function SegmentCard({
  rec,
  selected,
  onToggle,
  onReasoningOpen,
}: {
  rec: SegmentRecommendation;
  selected: boolean;
  onToggle: () => void;
  onReasoningOpen: () => void;
}) {
  const s = rec.segment;
  return (
    <Card
      className={cx(
        "flex flex-col px-5 py-5 transition-shadow",
        selected ? "border-accent-400 shadow-lift ring-1 ring-accent-200" : "",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            Segment {String.fromCharCode(64 + rec.rank)} · Rank {rec.rank}
          </p>
          <h3 className="mt-1.5 font-serif text-xl leading-snug text-navy-800">{s.name}</h3>
        </div>
        {rec.recommended ? <Badge tone="accent">Recommended</Badge> : null}
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-navy-500">{s.description}</p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="Estimated size" value={formatNumber(s.estimatedSize)} />
        <Metric
          label={s.isReactivation ? "Reactivation cost" : "Historical CAC"}
          value={formatINR(s.historicalCacINR)}
        />
        <Metric label="Repeat rate" value={`${s.repeatRatePct}%`} />
        <Metric
          label="Contribution / customer"
          value={formatINR(rec.estimatedUnitContributionINR)}
        />
      </dl>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-navy-400">
            Weighted score
          </span>
          <span className="tnum text-sm font-semibold text-navy-800">
            {(rec.score * 100).toFixed(1)}
          </span>
        </div>
        <Meter value={rec.score * 100} tone={rec.recommended ? "accent" : "navy"} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <ConfidencePill confidence={rec.confidence} band={rec.confidenceBand} />
        <span className="text-xs text-navy-400">
          {Math.round(s.dataConfidence * 100)}% data quality
        </span>
      </div>

      <p className="mt-4 border-t border-line-soft pt-4 text-[13px] leading-relaxed text-navy-600">
        {rec.rationale}
      </p>

      <Disclosure
        className="mt-4"
        summary={`Reasoning trace (${rec.reasoning.length})`}
        onToggle={(open) => {
          if (open) onReasoningOpen();
        }}
      >
        <ReasoningTrace nodes={rec.reasoning} dense />
      </Disclosure>

      <div className="mt-5 pt-1">
        <Button
          className="w-full"
          variant={selected ? "primary" : "secondary"}
          onClick={onToggle}
          aria-pressed={selected}
        >
          {selected ? "Selected" : rec.recommended ? "Accept recommendation" : "Select instead"}
        </Button>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-[0.09em] text-navy-400">{label}</dt>
      <dd className="tnum mt-0.5 text-sm font-medium text-navy-800">{value}</dd>
    </div>
  );
}
