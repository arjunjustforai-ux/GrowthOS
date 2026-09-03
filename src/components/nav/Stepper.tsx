"use client";

import React from "react";
import Link from "next/link";
import type { CampaignProposal, PlanStage } from "@/lib/types";
import { PLAN_STAGES, stageBlockedReason } from "@/lib/engine/pipeline";
import { cx } from "@/components/ui";

/**
 * The planning stepper. Visible on every stage of the flow, so a presenter
 * never has to explain where they are — and so the fact that approval sits
 * before the outcome screen is legible at a glance.
 */
export function Stepper({
  plan,
  current,
}: {
  plan: CampaignProposal | null;
  current: PlanStage;
}) {
  const currentIndex = PLAN_STAGES.findIndex((s) => s.id === current);

  return (
    <nav
      data-app-nav
      aria-label="Growth plan stages"
      className="border-b border-line bg-ivory-50"
    >
      <ol className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 py-2.5 sm:px-8">
        {PLAN_STAGES.map((stage, index) => {
          const complete = plan?.completedStages.includes(stage.id) ?? false;
          const blocked = stageBlockedReason(plan, stage.id) !== null;
          const active = stage.id === current;

          const inner = (
            <span
              className={cx(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-navy-800 font-semibold text-ivory-100"
                  : blocked
                    ? "text-navy-300"
                    : "text-navy-500 hover:bg-white hover:text-navy-800",
              )}
            >
              <span
                className={cx(
                  "tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                  active
                    ? "border-ivory-100/40 bg-ivory-100/15 text-ivory-100"
                    : complete
                      ? "border-success-200 bg-success-50 text-success-700"
                      : blocked
                        ? "border-line text-navy-300"
                        : "border-line-strong text-navy-400",
                )}
              >
                {complete && !active ? "✓" : index + 1}
              </span>
              {stage.short}
            </span>
          );

          return (
            <li key={stage.id} className="flex items-center">
              {blocked && !active ? (
                <span title={stageBlockedReason(plan, stage.id) ?? undefined} aria-disabled>
                  {inner}
                </span>
              ) : (
                <Link href={stage.href}>{inner}</Link>
              )}
              {index < PLAN_STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className={cx(
                    "mx-0.5 h-px w-3 shrink-0",
                    index < currentIndex ? "bg-navy-300" : "bg-line-strong",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
