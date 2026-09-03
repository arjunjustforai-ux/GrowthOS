"use client";

import React from "react";
import type { AnalyticsEventName } from "@/lib/types";
import { formatDateTime, formatPct } from "@/lib/format";
import { PageHeader } from "@/components/nav/AppShell";
import { Badge, Callout, Card, EmptyState, LinkButton, Stat, cx } from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

/**
 * Internal demo analytics.
 *
 * These are product metrics for the team building GrowthOS, not a customer
 * dashboard. Keeping them on a separate internal screen is deliberate: the
 * marketing lead using the product should never be shown "approval without
 * major edit rate" — it is a question about the product, not about their
 * business.
 */
const EVENT_LABELS: Record<AnalyticsEventName, string> = {
  context_started: "Context started",
  context_completed: "Context completed",
  objective_confirmed: "Objective confirmed",
  segment_accepted: "Segment accepted",
  segment_overridden: "Segment overridden",
  reasoning_opened: "Reasoning opened",
  budget_changed: "Budget changed",
  creative_approved: "Creative approved",
  guardrail_triggered: "Guardrail triggered",
  guardrail_overridden: "Guardrail overridden",
  proposal_approved: "Proposal approved",
  proposal_exported: "Proposal exported",
  outcome_panel_opened: "Outcome panel opened",
};

export default function AdminPage() {
  const { analytics, plans, ready } = useWorkspace();
  if (!ready) return null;

  const count = (name: AnalyticsEventName) => analytics.filter((e) => e.name === name).length;

  const approvedPlans = plans.filter((p) => p.approval);
  const withMajorEdit = approvedPlans.filter(
    (p) => (p.finalAllocation?.impact.deviationFromRecommendationPts ?? 0) > 5,
  );
  const segmentDecisions = count("segment_accepted") + count("segment_overridden");
  const guardrailPlans = plans.filter((p) => p.guardrailReport);
  const firstPass =
    guardrailPlans.length > 0
      ? guardrailPlans.reduce((a, p) => a + (p.guardrailReport?.firstPassRate ?? 0), 0) /
        guardrailPlans.length
      : 1;

  // Time to first proposal: context_started → the first proposal_approved.
  const firstStart = analytics.find((e) => e.name === "context_started");
  const firstApproval = analytics.find((e) => e.name === "proposal_approved");
  const ttfp =
    firstStart && firstApproval
      ? (new Date(firstApproval.at).getTime() - new Date(firstStart.at).getTime()) / 60000
      : null;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Internal · demo analytics"
        title="Product metrics"
        description="Instrumentation for the team building GrowthOS. These numbers describe how the product is being used, not how the user's business is performing — which is why they are not on any customer-facing screen."
        meta={<Badge tone="outline" className="normal-case tracking-normal">Local to this browser</Badge>}
        actions={<LinkButton href="/settings">Settings</LinkButton>}
      />

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Time to first proposal"
            value={ttfp !== null ? `${ttfp.toFixed(1)} min` : "—"}
            sub="From first context screen to first approval in this browser session."
          />
          <Stat
            label="Approval without major edit"
            value={
              approvedPlans.length > 0
                ? formatPct(
                    ((approvedPlans.length - withMajorEdit.length) / approvedPlans.length) * 100,
                  )
                : "—"
            }
            sub="Approved with the allocation within 5 pts of the model."
          />
          <Stat
            label="Segment override rate"
            value={
              segmentDecisions > 0
                ? formatPct((count("segment_overridden") / segmentDecisions) * 100)
                : "—"
            }
            sub="How often a user disagrees with the top-ranked segment."
          />
          <Stat
            label="Budget override rate"
            value={
              approvedPlans.length > 0
                ? formatPct((withMajorEdit.length / approvedPlans.length) * 100)
                : "—"
            }
            sub="Approved plans that moved more than 5 pts from the recommendation."
          />
          <Stat
            label="Guardrail first-pass rate"
            value={formatPct(firstPass * 100)}
            sub="Share of generated concepts that tripped no rule."
          />
          <Stat
            label="Proposal approval rate"
            value={plans.length > 0 ? formatPct((approvedPlans.length / plans.length) * 100) : "—"}
            sub="Plans that reached an approval record."
          />
        </div>

        <Card className="px-5 py-5">
          <h2 className="font-serif text-lg text-navy-800">Event counts</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {(Object.keys(EVENT_LABELS) as AnalyticsEventName[]).map((name) => (
              <li
                key={name}
                className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-1.5"
              >
                <span className="text-[13px] text-navy-600">{EVENT_LABELS[name]}</span>
                <span
                  className={cx(
                    "tnum text-sm font-semibold",
                    count(name) > 0 ? "text-navy-800" : "text-navy-300",
                  )}
                >
                  {count(name)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="px-5 py-5">
          <h2 className="font-serif text-lg text-navy-800">Recent events</h2>
          {analytics.length === 0 ? (
            <p className="mt-3 text-sm text-navy-400">
              Nothing recorded yet. Walk through a plan and come back.
            </p>
          ) : (
            <ol className="mt-4 space-y-1.5">
              {[...analytics]
                .reverse()
                .slice(0, 30)
                .map((e) => (
                  <li key={e.id} className="text-xs leading-relaxed text-navy-500">
                    <span className="tnum text-navy-400">{formatDateTime(e.at)}</span> ·{" "}
                    <span className="font-medium text-navy-700">{EVENT_LABELS[e.name]}</span>
                    {e.props
                      ? ` · ${Object.entries(e.props)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")}`
                      : ""}
                  </li>
                ))}
            </ol>
          )}
        </Card>

        <Callout tone="quiet">
          Events are stored in this browser only, capped at the most recent 500, and never sent to a
          server. Resetting the demo clears them.
        </Callout>
      </div>
    </div>
  );
}
