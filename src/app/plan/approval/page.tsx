"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { formatCompactINR, formatDateTime, formatINR, formatSignedPts } from "@/lib/format";
import { GatedStage, PlanStagePage } from "@/components/plan/PlanStage";
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
  LinkButton,
  Textarea,
  cx,
} from "@/components/ui";
import { stageBlockedReason } from "@/lib/engine/pipeline";
import { useWorkspace } from "@/lib/store/workspace";

type BlockStatus = "pending" | "approved" | "rejected";

function ApprovalPageBody() {
  const { plan, settings, approvePlan } = useWorkspace();
  const router = useRouter();
  const [approver, setApprover] = React.useState(settings.approverName);
  const [note, setNote] = React.useState("");
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [blocks, setBlocks] = React.useState<Record<string, BlockStatus>>({});

  if (!plan?.strategy || !plan.finalAllocation || !plan.objective || !plan.company) return null;

  const { strategy, finalAllocation, recommendedAllocation, objective, company, outcome } = plan;
  const primary = plan.segmentRecommendations.find((s) => s.segmentId === strategy.primarySegmentId);
  const rejected = Object.values(blocks).filter((s) => s === "rejected");
  const alreadyApproved = Boolean(plan.approval);

  function setBlock(id: string, status: BlockStatus) {
    setBlocks((b) => ({ ...b, [id]: b[id] === status ? "pending" : status }));
  }

  return (
    <PlanStagePage
      stage="approval"
      title="Human approval"
      description="Everything in one place, block by block. Approve it, change it, or reject it — but a person has to do it. GrowthOS has no auto-publish mode and no autonomous execution path, by design and not by configuration."
      meta={
        alreadyApproved ? (
          <Badge tone="success">Approved {formatDateTime(plan.approval!.approvedAt)}</Badge>
        ) : (
          <Badge tone="amber">Awaiting approval</Badge>
        )
      }
    >
      <div className="space-y-6 pb-4">
        <DecisionBanner>
          Are you willing to put your name on this allocation and defend it line by line?
        </DecisionBanner>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <ReviewBlock
              id="objective"
              title="Objective"
              status={blocks.objective ?? "pending"}
              onStatus={setBlock}
              editHref="/plan/objective"
            >
              <p className="text-sm leading-relaxed text-navy-700">{objective.rawText}</p>
              <p className="mt-2 text-xs leading-relaxed text-navy-400">{objective.interpretation}</p>
              <ul className="mt-3 space-y-1">
                {objective.constraints.map((c) => (
                  <li key={c.id} className="text-[13px] text-navy-600">
                    • {c.label}
                  </li>
                ))}
              </ul>
            </ReviewBlock>

            <ReviewBlock
              id="segment"
              title="Selected segment"
              status={blocks.segment ?? "pending"}
              onStatus={setBlock}
              editHref="/plan/segments"
            >
              <p className="text-sm font-medium text-navy-800">{primary?.segment.name ?? "—"}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-navy-600">
                {primary?.rationale}
              </p>
            </ReviewBlock>

            <ReviewBlock
              id="strategy"
              title="Strategy"
              status={blocks.strategy ?? "pending"}
              onStatus={setBlock}
              editHref="/plan/strategy"
            >
              <p className="text-sm leading-relaxed text-navy-700">{strategy.strategicDirection}</p>
              <Disclosure className="mt-3" summary={`Reasoning trace (${strategy.reasoning.length} nodes)`}>
                <ul className="space-y-2.5">
                  {strategy.reasoning.map((n) => (
                    <li key={n.id} className="text-[13px] leading-relaxed text-navy-600">
                      <span className="font-medium text-navy-800">{n.input}</span> →{" "}
                      {n.interpretation} → <span className="text-accent-700">{n.decision}</span>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </ReviewBlock>

            <ReviewBlock
              id="budget"
              title="Budget"
              status={blocks.budget ?? "pending"}
              onStatus={setBlock}
              editHref="/plan/budget"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-soft text-left">
                      <th className="py-1.5 pr-3 font-medium text-navy-400">Channel</th>
                      <th className="px-3 py-1.5 text-right font-medium text-navy-400">AI</th>
                      <th className="px-3 py-1.5 text-right font-medium text-navy-400">Human</th>
                      <th className="pl-3 py-1.5 text-right font-medium text-navy-400">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalAllocation.lines.map((l) => {
                      const rec = recommendedAllocation?.lines.find((r) => r.channelId === l.channelId);
                      const delta = l.sharePct - (rec?.sharePct ?? 0);
                      return (
                        <tr key={l.channelId} className="border-b border-line-soft last:border-0">
                          <td className="py-2 pr-3 text-navy-700">{l.channelName}</td>
                          <td className="tnum px-3 py-2 text-right text-navy-400">
                            {rec?.sharePct ?? 0}%
                          </td>
                          <td
                            className={cx(
                              "tnum px-3 py-2 text-right font-semibold",
                              delta !== 0 ? "text-accent-700" : "text-navy-800",
                            )}
                          >
                            {l.sharePct}%
                            {delta !== 0 ? (
                              <span className="ml-1 text-2xs font-normal text-navy-400">
                                {formatSignedPts(delta, 0)}
                              </span>
                            ) : null}
                          </td>
                          <td className="tnum py-2 pl-3 text-right text-navy-600">
                            {formatCompactINR(l.amountINR)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="tnum mt-3 text-xs text-navy-400">
                Modelled blended CAC {formatINR(finalAllocation.impact.projectedBlendedCacINR)} ·
                contribution margin {formatCompactINR(finalAllocation.impact.projectedContributionMarginINR)}{" "}
                · {finalAllocation.impact.deviationFromRecommendationPts} pts from the model
              </p>
            </ReviewBlock>

            <ReviewBlock
              id="creative"
              title="Creative"
              status={blocks.creative ?? "pending"}
              onStatus={setBlock}
              editHref="/plan/creative"
            >
              <ul className="space-y-3">
                {plan.creatives.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line bg-ivory-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-navy-500">{c.channelLabel}</span>
                      <Badge tone={c.status === "approved" ? "success" : "outline"}>{c.status}</Badge>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-navy-800">{c.headline}</p>
                    <p className="mt-1 text-xs leading-relaxed text-navy-500">{c.body}</p>
                  </li>
                ))}
              </ul>
            </ReviewBlock>

            <ReviewBlock
              id="guardrails"
              title="Guardrails"
              status={blocks.guardrails ?? "pending"}
              onStatus={setBlock}
              editHref="/plan/guardrails"
            >
              {plan.guardrailReport && plan.guardrailReport.findings.length > 0 ? (
                <ul className="space-y-2">
                  {plan.guardrailReport.findings.map((f) => (
                    <li key={f.id} className="text-[13px] leading-relaxed text-navy-600">
                      <Badge tone={f.severity === "block" ? "danger" : "amber"} className="mr-2">
                        {f.ruleId}
                      </Badge>
                      {f.categoryLabel} — &ldquo;{f.detectedText}&rdquo; ·{" "}
                      <span className="font-medium text-navy-800">
                        {f.resolution === "unresolved" ? "unresolved" : f.resolution.replace("-", " ")}
                      </span>
                      {f.overrideReason ? (
                        <span className="text-navy-400"> · {f.overrideReason}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-navy-500">
                  All {plan.guardrailReport?.checkedCreatives ?? 0} concepts passed on the first check.
                </p>
              )}
            </ReviewBlock>

            <ReviewBlock
              id="risks"
              title="Risks and what would change this"
              status={blocks.risks ?? "pending"}
              onStatus={setBlock}
              editHref="/plan/strategy"
            >
              <ul className="space-y-2">
                {strategy.wouldChangeIf.map((w) => (
                  <li key={w} className="text-[13px] leading-relaxed text-navy-600">
                    • {w}
                  </li>
                ))}
              </ul>
            </ReviewBlock>

            {plan.overrides.length > 0 ? (
              <Card className="border-accent-200 px-5 py-5">
                <h3 className="font-serif text-lg text-navy-800">
                  Human judgement recorded on this plan
                </h3>
                <ul className="mt-3 space-y-3">
                  {plan.overrides.map((o) => (
                    <li key={o.id} className="rounded-lg border border-line bg-ivory-50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">{o.kind}</Badge>
                        <span className="text-[13px] font-medium text-navy-800">{o.summary}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-navy-500">{o.detail}</p>
                      <p className="tnum mt-1.5 text-xs text-navy-400">
                        AI: {o.aiValue} → Human: {o.userValue}
                      </p>
                      {o.reason ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-navy-600">
                          Reason: {o.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card className="px-5 py-5">
              <p className="eyebrow">Approve growth plan</p>
              <p className="tnum mt-2 font-serif text-3xl leading-none text-navy-800">
                {formatCompactINR(finalAllocation.totalBudgetINR)}
              </p>
              <p className="mt-1 text-xs text-navy-400">
                {finalAllocation.lines.map((l) => `${l.channelName} ${l.sharePct}%`).join(" · ")}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <ConfidencePill
                  confidence={finalAllocation.impact.confidence}
                  band={finalAllocation.impact.confidenceBand}
                />
                <span className="text-xs text-navy-400">
                  {plan.overrides.length} override{plan.overrides.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <Field label="Approved by">
                  <Input
                    value={approver}
                    onChange={(e) => setApprover(e.target.value)}
                    className="!font-sans"
                  />
                </Field>
                <Field label="Approval note (optional)">
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything the founder should read alongside this."
                    className="!font-sans"
                  />
                </Field>
              </div>

              <Callout tone="warning" className="mt-4">
                You remain responsible for the final marketing decision. GrowthOS provides decision
                support, not autonomous execution — it does not launch campaigns, move budget, or
                change anything in an ad account.
              </Callout>

              <label className="mt-4 flex items-start gap-2.5 text-[13px] leading-relaxed text-navy-600">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-accent-600"
                />
                I have read the reasoning and I am accountable for this allocation.
              </label>

              {rejected.length > 0 ? (
                <Callout tone="danger" className="mt-4">
                  {rejected.length} block{rejected.length === 1 ? " is" : "s are"} marked rejected. Go
                  back and change {rejected.length === 1 ? "it" : "them"} before approving.
                </Callout>
              ) : null}

              {alreadyApproved ? (
                <div className="mt-5 space-y-2">
                  <Callout tone="success">
                    Approved by {plan.approval!.approvedBy} on{" "}
                    {formatDateTime(plan.approval!.approvedAt)} · {plan.approval!.version} ·{" "}
                    {plan.approval!.editCount} edits · {plan.approval!.overrideCount} overrides
                  </Callout>
                  <LinkButton href="/plan/outcome" variant="primary" className="w-full">
                    View outcome range →
                  </LinkButton>
                  <LinkButton href="/proposal" className="w-full">
                    Open growth decision proposal
                  </LinkButton>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-5 w-full"
                  disabled={!acknowledged || rejected.length > 0}
                  onClick={() => {
                    approvePlan(approver, note);
                    router.push("/plan/outcome");
                  }}
                >
                  Approve growth plan
                </Button>
              )}
            </Card>

            <Callout tone="quiet">
              <p className="font-medium text-navy-700">Why there is no auto-approve</p>
              <p className="mt-1 leading-relaxed">
                The product&rsquo;s output is an argument, and an argument needs someone who holds
                it. An automated approval would produce a document with nobody&rsquo;s name on it,
                which is exactly the situation a marketing lead is trying to get out of.
              </p>
            </Callout>
          </aside>
        </div>
      </div>
    </PlanStagePage>
  );
}

function ReviewBlock({
  id,
  title,
  status,
  onStatus,
  editHref,
  children,
}: {
  id: string;
  title: string;
  status: BlockStatus;
  onStatus: (id: string, status: BlockStatus) => void;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cx(
        "px-5 py-5",
        status === "approved"
          ? "border-success-200"
          : status === "rejected"
            ? "border-danger-200"
            : "",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-serif text-lg text-navy-800">{title}</h3>
        <div className="flex items-center gap-1.5 no-print">
          <Button
            size="sm"
            variant={status === "approved" ? "primary" : "ghost"}
            onClick={() => onStatus(id, "approved")}
          >
            Approve
          </Button>
          <LinkButton size="sm" variant="ghost" href={editHref}>
            Edit
          </LinkButton>
          <Button
            size="sm"
            variant={status === "rejected" ? "danger" : "ghost"}
            onClick={() => onStatus(id, "rejected")}
          >
            Reject
          </Button>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/**
 * The gate runs first. ApprovalPageBody reads directly into the plan's
 * approval data, so it is only mounted once that data is guaranteed to exist.
 */
export default function ApprovalPage() {
  const { plan, ready } = useWorkspace();
  if (!ready || stageBlockedReason(plan, "approval")) return <GatedStage stage="approval" />;
  return <ApprovalPageBody />;
}
