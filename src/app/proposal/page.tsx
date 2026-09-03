"use client";

import React from "react";
import { executiveSummary, pptOutline, proposalFilename } from "@/lib/engine/proposal";
import { accountMetrics } from "@/lib/engine/context";
import { GUARDRAIL_DISCLAIMER } from "@/lib/engine/guardrails";
import {
  formatCompactINR,
  formatDateTime,
  formatINR,
  formatNumber,
  formatPct,
  formatSignedPts,
} from "@/lib/format";
import { PageHeader } from "@/components/nav/AppShell";
import { Badge, Button, Callout, Card, EmptyState, LinkButton, cx } from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

export default function ProposalPage() {
  const { plan, ready, track } = useWorkspace();
  const [copied, setCopied] = React.useState<string | null>(null);

  if (!ready) return null;
  if (!plan?.company || !plan.strategy || !plan.finalAllocation || !plan.objective) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <EmptyState
          title="No plan to compose"
          description="A growth decision proposal is generated from a completed plan. Build one first."
          action={<LinkButton href="/plan/context" variant="primary">Start a growth plan</LinkButton>}
        />
      </div>
    );
  }

  const { company, objective, strategy, finalAllocation, recommendedAllocation, outcome, approval } =
    plan;
  const primary = plan.segmentRecommendations.find((s) => s.segmentId === strategy.primarySegmentId);
  const metrics = accountMetrics(company);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      track("proposal_exported", { format: label });
      window.setTimeout(() => setCopied(null), 2200);
    } catch {
      setCopied("Copy failed — select the text manually.");
    }
  }

  function download(text: string, ext: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proposalFilename(plan!)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    track("proposal_exported", { format: ext });
  }

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Growth decision proposal"
        title={`${company.name} — ${plan.cycleLabel}`}
        description="The artefact. Everything a founder needs to interrogate this decision, in the order they will ask about it."
        meta={
          <>
            <Badge tone={approval ? "success" : "amber"}>
              {approval ? "Approved" : "Draft — not approved"}
            </Badge>
            {company.isDemo ? (
              <Badge tone="amber" className="normal-case tracking-normal">
                Demo dataset — simulated for product demonstration
              </Badge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="primary"
              onClick={() => {
                track("proposal_exported", { format: "print" });
                window.print();
              }}
            >
              Download PDF / Print
            </Button>
            <Button onClick={() => copy(executiveSummary(plan), "executive summary")}>
              Copy executive summary
            </Button>
            <Button variant="ghost" onClick={() => download(pptOutline(plan), "txt")}>
              Export PPT outline
            </Button>
          </>
        }
      />

      {copied ? (
        <div className="mx-auto max-w-4xl px-5 pt-4 sm:px-8 no-print">
          <Callout tone="success">Copied the {copied} to your clipboard.</Callout>
        </div>
      ) : null}

      <article className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-8 print-full">
        {!approval ? (
          <Callout tone="warning" title="This proposal has not been approved">
            GrowthOS produces the outcome range and the approval record only after a person signs
            off. Until then this document is a working draft.
          </Callout>
        ) : null}

        <Section n={1} title="Company snapshot">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row label="Company">{company.name}</Row>
            <Row label="Category">{company.industry}</Row>
            <Row label="Annual revenue">{formatCompactINR(company.annualRevenueINR)}</Row>
            <Row label="Monthly paid spend">{formatCompactINR(company.monthlyPaidSpendINR)}</Row>
            <Row label="Average order value">{formatINR(company.aovINR)}</Row>
            <Row label="Gross margin">{formatPct(company.grossMarginPct)}</Row>
            <Row label="Repeat purchase rate">{formatPct(company.repeatPurchaseRatePct)}</Row>
            <Row label="Blended CAC today">{formatINR(metrics.blendedCacINR)}</Row>
            <Row label="Marketing team">{company.marketingTeamSize} people</Row>
            <Row label="Context completeness">
              {plan.completeness?.scorePct ?? 100}%
              {plan.completeness && plan.completeness.missing.length > 0
                ? ` — missing ${plan.completeness.missing.map((m) => m.label).join(", ")}`
                : ""}
            </Row>
          </dl>
        </Section>

        <Section n={2} title="Growth objective">
          <p className="text-sm leading-relaxed text-navy-700">{objective.rawText}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-navy-500">{objective.interpretation}</p>
          <ul className="mt-3 space-y-1">
            {objective.constraints.map((c) => (
              <li key={c.id} className="text-[13px] text-navy-600">
                • {c.label}
              </li>
            ))}
          </ul>
        </Section>

        <Section n={3} title="Customer segment recommendation">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-3 font-medium text-navy-400">Rank</th>
                <th className="px-3 py-2 font-medium text-navy-400">Segment</th>
                <th className="px-3 py-2 text-right font-medium text-navy-400">Size</th>
                <th className="px-3 py-2 text-right font-medium text-navy-400">CAC</th>
                <th className="px-3 py-2 text-right font-medium text-navy-400">Repeat</th>
                <th className="pl-3 py-2 text-right font-medium text-navy-400">Score</th>
              </tr>
            </thead>
            <tbody>
              {plan.segmentRecommendations.map((r) => (
                <tr
                  key={r.segmentId}
                  className={cx(
                    "border-b border-line-soft last:border-0",
                    plan.selectedSegmentIds.includes(r.segmentId) && "bg-accent-50/50",
                  )}
                >
                  <td className="tnum py-2 pr-3 text-navy-400">{r.rank}</td>
                  <td className="px-3 py-2 font-medium text-navy-800">
                    {r.segment.name}
                    {plan.selectedSegmentIds.includes(r.segmentId) ? (
                      <span className="ml-2 text-2xs font-semibold uppercase tracking-wide text-accent-600">
                        Selected
                      </span>
                    ) : null}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-navy-600">
                    {formatNumber(r.segment.estimatedSize)}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-navy-600">
                    {formatINR(r.segment.historicalCacINR)}
                  </td>
                  <td className="tnum px-3 py-2 text-right text-navy-600">
                    {r.segment.repeatRatePct}%
                  </td>
                  <td className="tnum py-2 pl-3 text-right font-semibold text-navy-800">
                    {(r.score * 100).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {primary ? (
            <p className="mt-3 text-[13px] leading-relaxed text-navy-600">{primary.rationale}</p>
          ) : null}
        </Section>

        <Section n={4} title="Strategic thesis">
          <p className="font-serif text-lg leading-snug text-navy-800">
            {strategy.strategicDirection}
          </p>
        </Section>

        <Section n={5} title="Channel roles">
          <ul className="space-y-2.5">
            {strategy.channelRoles.map((c) => (
              <li key={c.channelId} className="rounded-lg border border-line bg-ivory-50 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-navy-800">
                    {c.channelName} — {c.roleLabel}
                  </span>
                  <span className="tnum text-sm font-semibold text-navy-800">{c.sharePct}%</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-navy-500">{c.rationale}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section n={6} title="Budget allocation" className="print-break">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-3 font-medium text-navy-400">Channel</th>
                <th className="px-3 py-2 text-right font-medium text-navy-400">AI recommended</th>
                <th className="px-3 py-2 text-right font-medium text-navy-400">Human final</th>
                <th className="px-3 py-2 text-right font-medium text-navy-400">Δ</th>
                <th className="pl-3 py-2 text-right font-medium text-navy-400">Amount</th>
              </tr>
            </thead>
            <tbody>
              {finalAllocation.lines.map((l) => {
                const rec = recommendedAllocation?.lines.find((r) => r.channelId === l.channelId);
                const delta = l.sharePct - (rec?.sharePct ?? 0);
                return (
                  <tr key={l.channelId} className="border-b border-line-soft last:border-0">
                    <td className="py-2 pr-3 font-medium text-navy-700">{l.channelName}</td>
                    <td className="tnum px-3 py-2 text-right text-navy-400">{rec?.sharePct ?? 0}%</td>
                    <td className="tnum px-3 py-2 text-right font-semibold text-navy-800">
                      {l.sharePct}%
                    </td>
                    <td className="tnum px-3 py-2 text-right text-navy-600">
                      {delta === 0 ? "—" : formatSignedPts(delta, 0)}
                    </td>
                    <td className="tnum py-2 pl-3 text-right text-navy-700">
                      {formatCompactINR(l.amountINR)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-line">
                <td className="py-2 pr-3 font-semibold text-navy-800">Total</td>
                <td /> <td /> <td />
                <td className="tnum py-2 pl-3 text-right font-semibold text-navy-800">
                  {formatCompactINR(finalAllocation.totalBudgetINR)}
                </td>
              </tr>
            </tbody>
          </table>
          <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Row label="Projected blended CAC">
              {formatINR(finalAllocation.impact.projectedBlendedCacINR)}
            </Row>
            <Row label="Projected new customers">
              {formatNumber(finalAllocation.impact.projectedNewCustomers)}
            </Row>
            <Row label="Projected contribution margin">
              {formatCompactINR(finalAllocation.impact.projectedContributionMarginINR)}
            </Row>
            <Row label="Confidence">
              {formatPct(finalAllocation.impact.confidence * 100)} —{" "}
              {finalAllocation.impact.confidenceBand}
            </Row>
          </dl>
          {finalAllocation.impact.constraintBreaches.length > 0 ? (
            <Callout tone="danger" className="mt-4" title="Known constraint breach at approval">
              <ul className="space-y-1">
                {finalAllocation.impact.constraintBreaches.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Callout>
          ) : null}
        </Section>

        <Section n={7} title="Reasoning trace summary">
          <ol className="space-y-3">
            {strategy.reasoning.map((n) => (
              <li key={n.id} className="rounded-lg border border-line bg-ivory-50 px-4 py-3">
                <p className="text-[13px] font-medium text-navy-800">{n.input}</p>
                <p className="mt-1 text-xs text-navy-500">{n.comparison}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-navy-600">
                  {n.interpretation}
                </p>
                <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-accent-700">
                  → {n.decision}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        <Section n={8} title="Creative concepts">
          <ul className="space-y-3">
            {plan.creatives.map((c) => (
              <li key={c.id} className="rounded-lg border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-navy-400">
                    {c.channelLabel} · {c.format}
                  </span>
                  <Badge tone={c.status === "approved" ? "success" : "outline"}>{c.status}</Badge>
                </div>
                <p className="mt-2 font-serif text-base text-navy-800">{c.headline}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-navy-600">{c.body}</p>
                <p className="mt-2 text-xs text-navy-400">
                  CTA: {c.cta} · Target: {c.targetSegmentName} · {c.reasoning}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section n={9} title="Guardrail findings">
          {plan.guardrailReport && plan.guardrailReport.findings.length > 0 ? (
            <ul className="space-y-2.5">
              {plan.guardrailReport.findings.map((f) => (
                <li key={f.id} className="rounded-lg border border-line px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={f.severity === "block" ? "danger" : "amber"}>{f.severity}</Badge>
                    <span className="text-[13px] font-medium text-navy-800">{f.categoryLabel}</span>
                    <span className="font-mono text-2xs text-navy-300">{f.ruleId}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-navy-700">
                    Detected: &ldquo;{f.detectedText}&rdquo; in {f.creativeLabel} ({f.field})
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-navy-500">{f.reason}</p>
                  <p className="mt-1.5 text-[13px] text-navy-700">
                    Resolution:{" "}
                    <span className="font-medium">
                      {f.resolution === "unresolved" ? "unresolved" : f.resolution.replace("-", " ")}
                    </span>
                    {f.overrideReason ? ` — ${f.overrideReason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-navy-600">
              All {plan.guardrailReport?.checkedCreatives ?? 0} concepts passed every rule on the
              first check.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-navy-400">{GUARDRAIL_DISCLAIMER}</p>
        </Section>

        <Section n={10} title="User edits and overrides">
          {plan.overrides.length === 0 ? (
            <p className="text-sm text-navy-600">
              No overrides. The approved plan matches the modelled recommendation exactly.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {plan.overrides.map((o) => (
                <li key={o.id} className="rounded-lg border border-line px-4 py-3">
                  <p className="text-[13px] font-medium text-navy-800">{o.summary}</p>
                  <p className="tnum mt-1 text-xs text-navy-500">
                    AI: {o.aiValue} → Human: {o.userValue}
                  </p>
                  {o.reason ? (
                    <p className="mt-1 text-[13px] leading-relaxed text-navy-600">
                      Reason: {o.reason}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-navy-400">{formatDateTime(o.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section n={11} title="Outcome range" className="print-break">
          {outcome ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <BandCell label="Low scenario" value={formatCompactINR(outcome.lowINR)} />
                <BandCell
                  label="Central range"
                  value={`${formatCompactINR(outcome.baseLowINR)} – ${formatCompactINR(outcome.baseHighINR)}`}
                  emphasis
                />
                <BandCell label="Upper scenario" value={formatCompactINR(outcome.highINR)} />
              </div>
              <p className="mt-3 text-[13px] text-navy-600">
                Confidence {formatPct(outcome.confidence * 100)} —{" "}
                {outcome.confidenceBand.toUpperCase()}. {outcome.upperBoundCaveat}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-navy-500">{outcome.historicalBasis}</p>
            </>
          ) : (
            <p className="text-sm text-navy-600">
              Not generated. The outcome range is produced only after a human approves the plan.
            </p>
          )}
        </Section>

        <Section n={12} title="Assumptions">
          <ul className="space-y-1.5">
            {(outcome?.assumptions ?? ["Not generated — plan not approved."]).map((a) => (
              <li key={a} className="text-[13px] leading-relaxed text-navy-600">
                • {a}
              </li>
            ))}
          </ul>
        </Section>

        <Section n={13} title="Risks — what would make this wrong">
          <ul className="space-y-1.5">
            {[...strategy.wouldChangeIf, ...(outcome?.whatWouldMakeThisWrong ?? [])].map((r) => (
              <li key={r} className="text-[13px] leading-relaxed text-navy-600">
                • {r}
              </li>
            ))}
          </ul>
        </Section>

        <Section n={14} title="Human approval record">
          {approval ? (
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <Row label="Approved by">{approval.approvedBy}</Row>
              <Row label="Approved at">{formatDateTime(approval.approvedAt)}</Row>
              <Row label="Version">{approval.version}</Row>
              <Row label="Edits">{approval.editCount}</Row>
              <Row label="Overrides">{approval.overrideCount}</Row>
              <Row label="Responsibility">Acknowledged by the approver</Row>
              {approval.note ? <Row label="Note">{approval.note}</Row> : null}
            </dl>
          ) : (
            <p className="text-sm text-navy-600">Not approved.</p>
          )}
          <p className="mt-4 rounded-lg border border-line bg-ivory-50 px-4 py-3 text-[13px] leading-relaxed text-navy-600">
            The approver remains responsible for the final marketing decision. GrowthOS provides
            decision support, not autonomous execution: it does not launch campaigns, move budget, or
            change anything in an advertising account.
          </p>
        </Section>

        <Section n={15} title="Audit log">
          <ol className="space-y-1.5">
            {plan.auditLog.map((a) => (
              <li key={a.id} className="text-xs leading-relaxed text-navy-500">
                <span className="tnum text-navy-400">{formatDateTime(a.at)}</span> ·{" "}
                <span className="font-medium text-navy-700">{a.actor === "user" ? "User" : "GrowthOS"}</span>{" "}
                · {a.action} — {a.detail}
              </li>
            ))}
          </ol>
        </Section>

        {company.isDemo ? (
          <p className="text-xs leading-relaxed text-navy-400">
            Demo dataset — simulated for product demonstration. The figures in this proposal are
            invented for a classroom demonstration and are not real customer evidence.
          </p>
        ) : null}
      </article>
    </div>
  );
}

function Section({
  n,
  title,
  children,
  className,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cx("px-6 py-5", className)}>
      <h2 className="flex items-baseline gap-3 font-serif text-xl text-navy-800">
        <span className="tnum text-sm font-sans font-semibold text-navy-300">
          {String(n).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3">
      <dt className="text-2xs font-semibold uppercase tracking-[0.09em] text-navy-400">{label}</dt>
      <dd className="tnum text-[13px] leading-relaxed text-navy-700">{children}</dd>
    </div>
  );
}

function BandCell({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border px-4 py-3",
        emphasis ? "border-accent-200 bg-accent-50/60" : "border-line bg-ivory-50",
      )}
    >
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1 font-serif text-lg text-navy-800">{value}</p>
    </div>
  );
}
