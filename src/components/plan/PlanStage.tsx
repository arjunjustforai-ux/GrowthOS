"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { PlanStage as StageId } from "@/lib/types";
import { PLAN_STAGES, stageBlockedReason } from "@/lib/engine/pipeline";
import { Stepper } from "@/components/nav/Stepper";
import { PageHeader } from "@/components/nav/AppShell";
import { Button, Card, LinkButton, Skeleton } from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";


/**
 * Shell for every stage of the planning flow.
 *
 * It owns the two things every stage shares: the stepper, and the gate. The
 * gate is not decoration — `stageBlockedReason` is the only way into a stage,
 * and the outcome stage's gate is what makes human approval structural rather
 * than customary.
 */
export function PlanStagePage({
  stage,
  eyebrow,
  title,
  description,
  decision,
  actions,
  meta,
  children,
  footer,
}: {
  stage: StageId;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  decision?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { plan, ready } = useWorkspace();

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-4 w-96" />
        <Skeleton className="mt-8 h-64 w-full" />
      </div>
    );
  }

  const blocked = stageBlockedReason(plan, stage);
  const index = PLAN_STAGES.findIndex((s) => s.id === stage);
  const definition = PLAN_STAGES[index];

  return (
    <div className="pb-20">
      <Stepper plan={plan} current={stage} />
      <PageHeader
        eyebrow={eyebrow ?? `Stage ${index + 1} of ${PLAN_STAGES.length}`}
        title={blocked ? definition.label : title}
        description={blocked ? undefined : description}
        actions={blocked ? undefined : actions}
        meta={blocked ? undefined : meta}
      />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {blocked ? <StageGate reason={blocked} stage={stage} /> : children}
      </div>
      {!blocked && footer ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ivory-50/95 backdrop-blur no-print">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Renders only the stepper, header and gate.
 *
 * Stage pages read straight into `plan.strategy.headline` and similar, so their
 * bodies cannot be evaluated on a plan that has not reached that stage. Each
 * page returns this first and mounts its real body only once the gate passes —
 * which is also what stops a stage being reached by typing its URL.
 */
export function GatedStage({ stage }: { stage: StageId }) {
  return (
    <PlanStagePage stage={stage} title="">
      {null}
    </PlanStagePage>
  );
}

function StageGate({ reason, stage }: { reason: string; stage: StageId }) {
  const { plan } = useWorkspace();
  // Send the user to the earliest stage that is actually open to them.
  const target =
    PLAN_STAGES.find((s) => stageBlockedReason(plan, s.id) !== null && s.id !== stage) ??
    PLAN_STAGES[0];
  const openTarget =
    PLAN_STAGES.slice()
      .reverse()
      .find((s) => stageBlockedReason(plan, s.id) === null) ?? PLAN_STAGES[0];

  return (
    <Card className="mx-auto max-w-2xl px-7 py-10 text-center">
      <p className="eyebrow">Not yet available</p>
      <h2 className="mt-3 font-serif text-2xl leading-snug text-navy-800">{reason}</h2>
      {stage === "outcome" ? (
        <p className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-navy-400">
          This is deliberate. A projected outcome shown before anyone has committed to a plan
          invites the number to be treated as a promise. GrowthOS produces the scenario band as a
          consequence of an approved decision, not as an inducement to make one.
        </p>
      ) : null}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <LinkButton href={openTarget.href} variant="primary">
          Go to {openTarget.short.toLowerCase()}
        </LinkButton>
        {target.id !== openTarget.id ? (
          <LinkButton href="/">Back to home</LinkButton>
        ) : null}
      </div>
    </Card>
  );
}

/** Standard footer: where you came from, where you are going, and why. */
export function StageFooter({
  backHref,
  backLabel,
  onContinue,
  continueHref,
  continueLabel,
  continueDisabled,
  note,
}: {
  backHref?: string;
  backLabel?: string;
  onContinue?: () => void;
  continueHref?: string;
  continueLabel: string;
  continueDisabled?: boolean;
  note?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <>
      <div className="flex items-center gap-3">
        {backHref ? (
          <LinkButton href={backHref} variant="ghost" size="sm">
            ← {backLabel ?? "Back"}
          </LinkButton>
        ) : (
          <span />
        )}
        {note ? <p className="text-xs leading-relaxed text-navy-400">{note}</p> : null}
      </div>
      <Button
        variant="primary"
        size="md"
        disabled={continueDisabled}
        onClick={() => {
          onContinue?.();
          if (continueHref) router.push(continueHref);
        }}
      >
        {continueLabel} →
      </Button>
    </>
  );
}
