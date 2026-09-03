"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AURA_SKINCARE, DEMO_COMPANIES, cloneCompany } from "@/lib/demo/companies";
import { interpretObjective } from "@/lib/engine/objective";
import { nextDecisionDate } from "@/lib/store/plan";
import { formatCompactINR, formatDate, formatDateTime, formatINR } from "@/lib/format";
import { PageHeader } from "@/components/nav/AppShell";
import {
  Badge,
  Button,
  Callout,
  Card,
  ConfidencePill,
  EmptyState,
  LinkButton,
  Skeleton,
  Stat,
} from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

export default function HomePage() {
  const {
    ready,
    plans,
    plan,
    startPlan,
    setCompany,
    setObjective,
    confirmObjective,
    selectSegments,
    openPlan,
  } = useWorkspace();
  const router = useRouter();

  if (!ready) return <HomeSkeleton />;

  const drafts = plans.filter((p) => p.status === "draft");
  const approved = plans.filter((p) => p.status === "approved");
  const current = plan ?? drafts[0] ?? null;
  const lastApproved = approved[0] ?? null;
  const account = current?.company ?? lastApproved?.company ?? null;

  /**
   * Presentation demo: loads Aura Skincare with the objective from the brief,
   * confirms the reading and accepts the top-ranked segment, so a presenter
   * arrives at a populated flow rather than an empty form. Every screen is
   * still walked through by hand — nothing is skipped, it is only pre-filled.
   */
  function runPresentationDemo() {
    const company = cloneCompany(AURA_SKINCARE);
    startPlan(company);
    setCompany(company);
    const objective = interpretObjective(
      "Grow monthly revenue by 20% over the next quarter without increasing blended CAC above ₹1,200.",
      "profitable-revenue",
      company,
      600_000,
    );
    setObjective(objective);
    confirmObjective();
    selectSegments(["aura-repeat"]);
    router.push("/plan/context");
  }

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Decision workspace"
        title={
          <>
            Welcome back.
            <br />
            <span className="text-navy-400">Decide smarter. Grow faster.</span>
          </>
        }
        description="GrowthOS turns company context, an objective and your own performance data into a budget allocation you can interrogate, edit, approve and defend. It does not run campaigns."
        meta={
          account ? (
            <>
              <Badge tone="neutral" className="normal-case tracking-normal">
                Account: {account.name}
              </Badge>
              <Badge tone="outline" className="normal-case tracking-normal">
                Cycle: {current?.cycleLabel ?? lastApproved?.cycleLabel}
              </Badge>
              {account.isDemo ? (
                <Badge tone="amber" className="normal-case tracking-normal">
                  Demo dataset — simulated
                </Badge>
              ) : null}
            </>
          ) : null
        }
        actions={
          <>
            <Button variant="primary" onClick={runPresentationDemo}>
              Presentation demo
            </Button>
            <LinkButton href="/plan/context">New growth plan</LinkButton>
          </>
        }
      />

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">
        {current ? (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-navy-800">Current planning cycle</h2>
                <p className="mt-1 text-sm text-navy-400">{current.title}</p>
              </div>
              <LinkButton
                size="sm"
                variant="primary"
                href={resumeHref(current)}
                onClick={() => openPlan(current.id)}
              >
                {current.status === "approved" ? "Open plan" : "Resume plan"}
              </LinkButton>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat
                label="Current objective"
                value={
                  current.objective ? (
                    <span className="text-base leading-snug">
                      {current.objective.targetChangePct >= 0 ? "+" : ""}
                      {current.objective.targetChangePct}%{" "}
                      {metricWord(current.objective.goalMetric)}
                    </span>
                  ) : (
                    <span className="text-base text-navy-300">Not set</span>
                  )
                }
                sub={
                  current.objective
                    ? `${current.objective.timeHorizonDays}-day horizon`
                    : "Set one to begin"
                }
              />
              <Stat
                label="Monthly budget"
                value={
                  current.finalAllocation
                    ? formatCompactINR(current.finalAllocation.totalBudgetINR)
                    : current.objective
                      ? formatCompactINR(current.objective.monthlyBudgetINR)
                      : "—"
                }
                sub={
                  current.finalAllocation
                    ? current.finalAllocation.lines
                        .map((l) => `${l.channelName.split(" ")[0]} ${l.sharePct}%`)
                        .join(" · ")
                    : "Awaiting allocation"
                }
              />
              <Stat
                label="Approval status"
                value={
                  <span className="text-base leading-snug">
                    {current.approval ? "Approved" : "Draft"}
                  </span>
                }
                sub={
                  current.approval
                    ? `${current.approval.approvedBy}, ${formatDate(current.approval.approvedAt)}`
                    : `${current.completedStages.length} of 9 stages complete`
                }
                tone={current.approval ? "neutral" : "warning"}
              />
              <Stat
                label="Last approved proposal"
                value={
                  lastApproved ? (
                    <span className="text-base leading-snug">{lastApproved.cycleLabel.split(" ")[0]}</span>
                  ) : (
                    <span className="text-base text-navy-300">None</span>
                  )
                }
                sub={
                  lastApproved
                    ? `${formatCompactINR(lastApproved.finalAllocation?.totalBudgetINR ?? 0)} managed spend`
                    : "No history yet"
                }
              />
              <Stat
                label="Next decision date"
                value={
                  <span className="text-base leading-snug">{formatDate(nextDecisionDate().toISOString())}</span>
                }
                sub="Start of the next monthly planning cycle"
              />
            </div>

            {current.strategy ? (
              <Card className="mt-4 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-prose">
                    <p className="eyebrow">Working recommendation</p>
                    <p className="mt-2 font-serif text-lg leading-snug text-navy-800">
                      {current.strategy.strategicDirection}
                    </p>
                  </div>
                  <ConfidencePill
                    confidence={current.strategy.confidence}
                    band={current.strategy.confidenceBand}
                  />
                </div>
              </Card>
            ) : null}
          </section>
        ) : (
          <EmptyState
            title="No growth plan open"
            description="Start with one of the three seeded D2C brands, or run the presentation demo to load Aura Skincare with an objective already set."
            action={
              <>
                <Button variant="primary" onClick={runPresentationDemo}>
                  Presentation demo
                </Button>
                <LinkButton href="/plan/context">New growth plan</LinkButton>
              </>
            }
          />
        )}

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-serif text-xl text-navy-800">Decision history</h2>
            <Link href="/history" className="link text-sm">
              View all
            </Link>
          </div>
          <Card className="divide-y divide-line-soft overflow-hidden">
            {plans.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={resumeHref(p)}
                onClick={() => openPlan(p.id)}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-ivory-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-800">{p.cycleLabel}</p>
                  <p className="mt-0.5 text-xs text-navy-400">
                    {p.company?.name ?? "No company"} ·{" "}
                    {p.approval
                      ? `approved ${formatDateTime(p.approval.approvedAt)}`
                      : `updated ${formatDateTime(p.updatedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tnum text-sm text-navy-500">
                    {p.finalAllocation
                      ? `${formatCompactINR(p.finalAllocation.totalBudgetINR)} managed spend`
                      : "—"}
                  </span>
                  <Badge tone={p.status === "approved" ? "success" : "amber"}>
                    {p.status === "approved" ? "Approved" : "Draft"}
                  </Badge>
                </div>
              </Link>
            ))}
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="px-5 py-5 lg:col-span-2">
            <p className="eyebrow">What GrowthOS is for</p>
            <p className="mt-3 max-w-prose font-serif text-lg leading-snug text-navy-800">
              &ldquo;I think 60% should go to Meta.&rdquo; &mdash; &ldquo;Why?&rdquo;
            </p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-navy-500">
              That second question is the whole problem. A lean marketing team has a Meta dashboard,
              a Google dashboard, a Shopify export, a spreadsheet and an instinct — and no defensible
              answer when the founder asks. GrowthOS assembles the argument from the same data,
              exposes every step of it, lets you overrule any of it, and produces a document you can
              defend line by line.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <LinkButton size="sm" href="/plan/context">
                Build a plan
              </LinkButton>
              <LinkButton size="sm" variant="ghost" href="/data">
                Inspect the demo data
              </LinkButton>
            </div>
          </Card>

          <div className="space-y-4">
            <Callout tone="quiet" title="No autonomous execution">
              GrowthOS has no connection to any ad platform, no scheduler and no auto-approve mode.
              It ends at an approved proposal, on purpose.
            </Callout>
            <Card className="px-5 py-4">
              <p className="eyebrow">Demo companies</p>
              <ul className="mt-3 space-y-2.5">
                {DEMO_COMPANIES.map((c) => (
                  <li key={c.id} className="text-[13px]">
                    <span className="font-medium text-navy-800">{c.name}</span>
                    <span className="tnum block text-xs text-navy-400">
                      {formatCompactINR(c.annualRevenueINR)} revenue ·{" "}
                      {formatCompactINR(c.monthlyPaidSpendINR)}/mo · {formatINR(c.aovINR)} AOV
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

function resumeHref(plan: { approval: unknown; completedStages: string[] }): string {
  if (plan.approval) return "/proposal";
  const order = [
    "context",
    "objective",
    "segments",
    "strategy",
    "budget",
    "creative",
    "guardrails",
    "approval",
  ];
  const next = order.find((s) => !plan.completedStages.includes(s)) ?? "approval";
  return `/plan/${next}`;
}

function metricWord(metric: string): string {
  const map: Record<string, string> = {
    revenue: "revenue",
    "new-customers": "new customers",
    roas: "ROAS",
    cac: "CAC",
    "repeat-rate": "repeat rate",
    "contribution-margin": "margin",
  };
  return map[metric] ?? metric;
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-8 h-64" />
    </div>
  );
}
