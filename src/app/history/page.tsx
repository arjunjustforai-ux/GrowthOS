"use client";

import React from "react";
import Link from "next/link";
import { formatCompactINR, formatDateTime, formatINR } from "@/lib/format";
import { PageHeader } from "@/components/nav/AppShell";
import { Badge, Card, EmptyState, LinkButton, Skeleton } from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

export default function HistoryPage() {
  const { plans, openPlan, ready } = useWorkspace();

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-6 h-72" />
      </div>
    );
  }

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Decision history"
        title="Every allocation decision, and who made it"
        description="The record exists so that next month's argument can start from what happened last month, rather than from scratch."
        actions={<LinkButton href="/plan/context" variant="primary">New growth plan</LinkButton>}
      />

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        {plans.length === 0 ? (
          <EmptyState
            title="No plans yet"
            description="Approved plans and drafts will appear here."
            action={<LinkButton href="/plan/context" variant="primary">Start a plan</LinkButton>}
          />
        ) : (
          <div className="space-y-4">
            {plans.map((p) => (
              <Card key={p.id} className="px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-serif text-lg text-navy-800">{p.cycleLabel}</h2>
                      <Badge tone={p.status === "approved" ? "success" : "amber"}>
                        {p.status === "approved" ? "Approved" : "Draft"}
                      </Badge>
                      {p.company?.isDemo ? (
                        <Badge tone="outline" className="normal-case tracking-normal">
                          Demo data
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-navy-400">
                      {p.company?.name ?? "No company"}
                      {p.objective ? ` · ${p.objective.rawText}` : ""}
                    </p>
                  </div>
                  <Link
                    href={p.approval ? "/proposal" : "/plan/context"}
                    onClick={() => openPlan(p.id)}
                    className="shrink-0"
                  >
                    <span className="inline-flex h-9 items-center rounded-lg border border-line-strong bg-white px-3.5 text-sm font-medium text-navy-700 transition-colors hover:border-navy-300 hover:bg-ivory-50">
                      {p.approval ? "Open proposal" : "Resume"}
                    </span>
                  </Link>
                </div>

                <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-line-soft pt-4 sm:grid-cols-4">
                  <Cell label="Managed spend">
                    {p.finalAllocation ? formatCompactINR(p.finalAllocation.totalBudgetINR) : "—"}
                  </Cell>
                  <Cell label="Allocation">
                    {p.finalAllocation
                      ? p.finalAllocation.lines
                          .map((l) => `${l.channelName.split(" ")[0]} ${l.sharePct}%`)
                          .join(" · ")
                      : "—"}
                  </Cell>
                  <Cell label="Projected CAC">
                    {p.finalAllocation
                      ? formatINR(p.finalAllocation.impact.projectedBlendedCacINR)
                      : "—"}
                  </Cell>
                  <Cell label="Overrides">
                    {p.overrides.length === 0 ? "None" : `${p.overrides.length} recorded`}
                  </Cell>
                </dl>

                {p.approval ? (
                  <p className="mt-3 text-xs text-navy-400">
                    Approved by {p.approval.approvedBy} on {formatDateTime(p.approval.approvedAt)} ·{" "}
                    {p.approval.version} · {p.approval.editCount} edits ·{" "}
                    {p.approval.overrideCount} overrides
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-navy-400">
                    Last updated {formatDateTime(p.updatedAt)} · {p.completedStages.length} of 9
                    stages complete
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-[0.09em] text-navy-400">{label}</dt>
      <dd className="tnum mt-1 text-[13px] text-navy-700">{children}</dd>
    </div>
  );
}
