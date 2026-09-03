"use client";

import React from "react";
import type { ObjectivePresetId } from "@/lib/types";
import { OBJECTIVE_PRESETS, interpretObjective, presetById } from "@/lib/engine/objective";
import { weightShiftNotes } from "@/lib/engine/segments";
import { formatCompactINR } from "@/lib/format";
import { PlanStagePage, StageFooter } from "@/components/plan/PlanStage";
import {
  Badge,
  Button,
  Callout,
  Card,
  ConfidencePill,
  DecisionBanner,
  Field,
  Input,
  Textarea,
  cx,
} from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

export default function ObjectivePage() {
  const { plan, setObjective, confirmObjective } = useWorkspace();
  const company = plan?.company ?? null;

  const [presetId, setPresetId] = React.useState<ObjectivePresetId>(
    plan?.objective?.presetId ?? "profitable-revenue",
  );
  const [text, setText] = React.useState(
    plan?.objective?.rawText ?? presetById("profitable-revenue").template,
  );
  const [budget, setBudget] = React.useState(
    plan?.objective?.monthlyBudgetINR ?? company?.monthlyPaidSpendINR ?? 600_000,
  );
  const [dirty, setDirty] = React.useState(false);

  // Manual edits to the extracted variables, applied over the parsed reading.
  const [overrideChange, setOverrideChange] = React.useState<number | null>(null);
  const [overrideHorizon, setOverrideHorizon] = React.useState<number | null>(null);

  const parsed = React.useMemo(() => {
    if (!company) return null;
    const base = interpretObjective(text, presetId, company, budget);
    return {
      ...base,
      targetChangePct: overrideChange ?? base.targetChangePct,
      timeHorizonDays: overrideHorizon ?? base.timeHorizonDays,
    };
  }, [company, text, presetId, budget, overrideChange, overrideHorizon]);

  const confirmed = plan?.objective?.confirmed ?? false;
  const changedSinceConfirm =
    confirmed &&
    plan?.objective &&
    (plan.objective.rawText !== text ||
      plan.objective.presetId !== presetId ||
      plan.objective.monthlyBudgetINR !== budget);

  function choosePreset(id: ObjectivePresetId) {
    setPresetId(id);
    const preset = presetById(id);
    if (preset.template) setText(preset.template);
    setOverrideChange(null);
    setOverrideHorizon(null);
    setDirty(true);
  }

  function apply() {
    if (!parsed) return;
    setObjective(parsed);
    setDirty(false);
  }

  const weightNotes = React.useMemo(
    () => (parsed ? weightShiftNotes(parsed) : []),
    [parsed],
  );

  return (
    <PlanStagePage
      stage="objective"
      title="Growth objective"
      description="Say it the way you would say it to the founder. GrowthOS turns it into measurable variables and shows you exactly what it understood — before anything downstream runs on that reading."
      footer={
        <StageFooter
          backHref="/plan/context"
          backLabel="Context"
          continueHref="/plan/segments"
          continueLabel="Rank customer segments"
          continueDisabled={!parsed}
          onContinue={() => {
            apply();
            confirmObjective();
          }}
          note="Checkpoint 1 — nothing downstream runs until you confirm this reading."
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <DecisionBanner>
            What is this month&rsquo;s budget actually being asked to achieve, and what is it not
            allowed to break on the way?
          </DecisionBanner>

          <Card className="px-5 py-5">
            <h3 className="font-serif text-lg text-navy-800">Start from a common objective</h3>
            <p className="mt-1 text-sm leading-relaxed text-navy-400">
              These are not labels. Each one changes how segments are scored — the weights move, and
              you can see them move.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {OBJECTIVE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePreset(p.id)}
                  className={cx(
                    "rounded-lg border px-3.5 py-3 text-left transition-colors",
                    presetId === p.id
                      ? "border-accent-400 bg-accent-50/70 ring-1 ring-accent-200"
                      : "border-line bg-white hover:border-navy-300 hover:bg-ivory-50",
                  )}
                >
                  <p className="text-sm font-medium text-navy-800">{p.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-navy-400">{p.blurb}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <Field
              label="Objective, in your own words"
              hint="Include the number, the deadline and the constraint. GrowthOS reads all three."
            >
              <Textarea
                rows={3}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setOverrideChange(null);
                  setOverrideHorizon(null);
                  setDirty(true);
                }}
                placeholder="Grow monthly revenue by 20% over the next quarter without increasing blended CAC above ₹1,200."
                className="!font-sans"
              />
            </Field>
            <div className="mt-4">
              <Field
                label="Monthly budget (₹)"
                hint={`${formatCompactINR(budget)} per month. This is the number being allocated.`}
              >
                <Input
                  type="number"
                  value={budget || ""}
                  onChange={(e) => {
                    setBudget(Number(e.target.value));
                    setDirty(true);
                  }}
                />
              </Field>
            </div>
          </Card>

          {weightNotes.length > 0 ? (
            <Card className="px-5 py-5">
              <h3 className="font-serif text-lg text-navy-800">
                How this objective changes the scoring
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-navy-400">
                Segment ranking uses a fixed five-factor score. The objective does not change the
                factors, it changes what they are worth — which is why a different objective can
                produce a genuinely different answer rather than the same answer reworded.
              </p>
              <ul className="mt-4 space-y-2">
                {weightNotes.map((n) => (
                  <li key={n} className="flex gap-2.5 text-[13px] leading-relaxed text-navy-600">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-400" />
                    {n}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="border-accent-200 px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">GrowthOS read your objective as</p>
                <h3 className="mt-2 font-serif text-lg leading-snug text-navy-800">
                  {parsed
                    ? `${labelForMetric(parsed.goalMetric)} ${parsed.targetChangePct >= 0 ? "+" : ""}${parsed.targetChangePct}%`
                    : "—"}
                </h3>
              </div>
              {parsed ? (
                <ConfidencePill
                  confidence={parsed.interpretationConfidence}
                  band={
                    parsed.interpretationConfidence >= 0.78
                      ? "high"
                      : parsed.interpretationConfidence >= 0.58
                        ? "moderate"
                        : "low"
                  }
                  label="interpretation confidence"
                />
              ) : null}
            </div>

            {parsed ? (
              <>
                <dl className="mt-5 space-y-3">
                  <ReadRow label="Goal">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="h-8 w-20 py-1 text-[13px]"
                        value={parsed.targetChangePct}
                        onChange={(e) => {
                          setOverrideChange(Number(e.target.value));
                          setDirty(true);
                        }}
                      />
                      <span className="text-[13px] text-navy-500">
                        % change in {labelForMetric(parsed.goalMetric).toLowerCase()}
                      </span>
                    </div>
                  </ReadRow>
                  <ReadRow label="Time horizon">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="h-8 w-20 py-1 text-[13px]"
                        value={parsed.timeHorizonDays}
                        onChange={(e) => {
                          setOverrideHorizon(Number(e.target.value));
                          setDirty(true);
                        }}
                      />
                      <span className="text-[13px] text-navy-500">days</span>
                    </div>
                  </ReadRow>
                  <ReadRow label="Budget">
                    <span className="tnum text-[13px] font-medium text-navy-800">
                      {formatCompactINR(parsed.monthlyBudgetINR)} / month
                    </span>
                  </ReadRow>
                  <ReadRow label="Constraints">
                    <ul className="space-y-1.5">
                      {parsed.constraints.map((c) => (
                        <li key={c.id} className="text-[13px] leading-relaxed text-navy-700">
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  </ReadRow>
                </dl>

                <p className="mt-4 border-t border-line-soft pt-3 text-xs leading-relaxed text-navy-400">
                  {parsed.interpretation}
                </p>

                {parsed.constraints.some((c) => c.id === "cac-cap-suggested") ? (
                  <Callout tone="warning" className="mt-4">
                    You did not state a constraint, so GrowthOS proposed a break-even CAC ceiling.
                    An objective with no constraint is the exact failure this product exists to
                    prevent — edit the wording above to set your own, or delete the sentence if the
                    ceiling genuinely does not apply.
                  </Callout>
                ) : null}

                {changedSinceConfirm ? (
                  <Callout tone="warning" className="mt-4">
                    This differs from the objective you confirmed. Applying it will re-rank the
                    segments and rebuild the strategy, budget and creative from scratch.
                  </Callout>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="primary" onClick={apply} disabled={!dirty}>
                    {confirmed ? "Apply changed objective" : "Apply this reading"}
                  </Button>
                  {confirmed && !dirty ? (
                    <Badge tone="success">Confirmed</Badge>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-navy-400">Add company context first.</p>
            )}
          </Card>

          <Callout tone="quiet">
            <p className="font-medium text-navy-700">Why confirm at all?</p>
            <p className="mt-1 leading-relaxed">
              Everything after this screen — which customers to buy, which channels to fund, how
              much each gets — is derived from this reading. If the reading is wrong, the whole
              argument is wrong in a way that looks confident. So it is checked by a person first.
            </p>
          </Callout>
        </aside>
      </div>
    </PlanStagePage>
  );
}

function ReadRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-start gap-3">
      <dt className="pt-1 text-2xs font-semibold uppercase tracking-[0.1em] text-navy-400">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function labelForMetric(metric: string): string {
  const map: Record<string, string> = {
    revenue: "Revenue",
    "new-customers": "New customers",
    roas: "Blended ROAS",
    cac: "Blended CAC",
    "repeat-rate": "Repeat purchase rate",
    "contribution-margin": "Contribution margin",
  };
  return map[metric] ?? metric;
}
