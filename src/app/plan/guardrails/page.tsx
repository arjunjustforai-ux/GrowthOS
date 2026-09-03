"use client";

import React from "react";
import type { GuardrailFinding } from "@/lib/types";
import { GUARDRAIL_CATEGORIES, GUARDRAIL_DISCLAIMER, applyFix } from "@/lib/engine/guardrails";
import { GatedStage, PlanStagePage, StageFooter } from "@/components/plan/PlanStage";
import {
  Badge,
  Button,
  Callout,
  Card,
  DecisionBanner,
  Field,
  Modal,
  Textarea,
  cx,
} from "@/components/ui";
import { stageBlockedReason } from "@/lib/engine/pipeline";
import { useWorkspace } from "@/lib/store/workspace";

function GuardrailsPageBody() {
  const { plan, resolveFinding, completeStage, track } = useWorkspace();
  const report = plan?.guardrailReport;
  const [overriding, setOverriding] = React.useState<GuardrailFinding | null>(null);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [editing, setEditing] = React.useState<GuardrailFinding | null>(null);
  const [editText, setEditText] = React.useState("");

  React.useEffect(() => {
    if (report && report.findings.length > 0) {
      track("guardrail_triggered", { count: report.findings.length });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.findings.length]);

  if (!report || !plan) return null;

  const unresolvedBlocks = report.findings.filter(
    (f) => f.severity === "block" && f.resolution === "unresolved",
  );
  const findingsByCategory = new Set(report.findings.map((f) => f.category));

  return (
    <PlanStagePage
      stage="guardrails"
      title="Guardrail review"
      description="Every concept is checked against eleven categories of advertising, platform and compliance risk before a human is asked to approve it. Nothing is rewritten silently — a finding tells you what was detected, which rule fired, and what it suggests instead."
      meta={
        <>
          <Badge tone={report.blockCount > 0 ? "danger" : report.warningCount > 0 ? "amber" : "success"}>
            {report.findings.length} finding{report.findings.length === 1 ? "" : "s"}
          </Badge>
          <Badge tone="outline" className="normal-case tracking-normal">
            First-pass rate {Math.round(report.firstPassRate * 100)}%
          </Badge>
        </>
      }
      footer={
        <StageFooter
          backHref="/plan/creative"
          backLabel="Creative"
          continueHref="/plan/approval"
          continueLabel="Review & approve"
          continueDisabled={unresolvedBlocks.length > 0}
          onContinue={() => completeStage("guardrails")}
          note={
            unresolvedBlocks.length > 0
              ? `${unresolvedBlocks.length} blocking finding must be resolved before approval.`
              : "Checkpoint 4 — every finding is on the record either way."
          }
        />
      }
    >
      <div className="space-y-6">
        <DecisionBanner>
          Is there anything in this creative that the brand cannot substantiate, or that a platform
          reviewer, a regulator or a founder would object to?
        </DecisionBanner>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {report.findings.length === 0 ? (
              <Card className="px-6 py-10 text-center">
                <p className="font-serif text-xl text-navy-800">All concepts passed</p>
                <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-navy-400">
                  No rule fired against any of the {report.checkedCreatives} concepts. The review
                  still appears on the proposal, so the founder can see that the check ran.
                </p>
              </Card>
            ) : (
              report.findings.map((f) => {
                const creative = plan.creatives.find((c) => c.id === f.creativeId);
                const preview = creative ? applyFix(creative, f) : "";
                return (
                  <Card
                    key={f.id}
                    className={cx(
                      "px-5 py-5",
                      f.severity === "block"
                        ? "border-danger-200"
                        : f.resolution === "unresolved"
                          ? "border-amber-200"
                          : "border-success-200",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Badge tone={f.severity === "block" ? "danger" : "amber"}>{f.severity}</Badge>
                        <span className="text-sm font-medium text-navy-800">{f.categoryLabel}</span>
                        <span className="text-2xs font-mono text-navy-300">{f.ruleId}</span>
                      </div>
                      <span className="text-xs text-navy-400">{f.creativeLabel}</span>
                    </div>

                    <div className="mt-4 space-y-3">
                      <Panel label="Claim detected" tone="danger">
                        &ldquo;{f.detectedText}&rdquo;
                        <span className="ml-1 text-xs text-navy-400">(in {f.field})</span>
                      </Panel>
                      <Panel label="Reason" tone="neutral">
                        {f.reason}
                      </Panel>
                      <Panel label="Suggested correction" tone="success">
                        &ldquo;{f.suggestedCorrection}&rdquo;
                        {preview && creative ? (
                          <p className="mt-2 text-xs leading-relaxed text-navy-500">
                            Result: &ldquo;{preview}&rdquo;
                          </p>
                        ) : null}
                      </Panel>
                    </div>

                    {f.resolution === "unresolved" ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => resolveFinding(f.id, "fix-accepted")}
                        >
                          Accept fix
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const c = plan.creatives.find((x) => x.id === f.creativeId);
                            setEditText(
                              c
                                ? f.field === "headline"
                                  ? c.headline
                                  : f.field === "body"
                                    ? c.body
                                    : c.cta
                                : "",
                            );
                            setEditing(f);
                          }}
                        >
                          Edit manually
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={f.severity === "block"}
                          title={
                            f.severity === "block"
                              ? "Blocking findings cannot be overridden. Edit the copy instead."
                              : undefined
                          }
                          onClick={() => {
                            setOverrideReason("");
                            setOverriding(f);
                          }}
                        >
                          Override
                        </Button>
                        {f.severity === "block" ? (
                          <span className="self-center text-xs leading-relaxed text-danger-700">
                            Blocking findings cannot be overridden with a reason. Fix or rewrite.
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-5 rounded-lg border border-line bg-ivory-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-navy-400">
                          {f.resolution === "overridden"
                            ? "Overridden by user"
                            : f.resolution === "fix-accepted"
                              ? "Fix accepted"
                              : "Manually edited"}
                        </p>
                        {f.overrideReason ? (
                          <p className="mt-1.5 text-[13px] leading-relaxed text-navy-600">
                            Reason: {f.overrideReason}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-navy-400">
                          Recorded in the audit log and shown on the final proposal.
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>

          <aside className="space-y-4">
            <Card className="px-5 py-5">
              <p className="eyebrow">Categories checked</p>
              <ul className="mt-3 space-y-1.5">
                {GUARDRAIL_CATEGORIES.map((c) => {
                  const hit = findingsByCategory.has(c.id);
                  return (
                    <li
                      key={c.id}
                      className={cx(
                        "flex items-center gap-2 text-[13px]",
                        hit ? "font-medium text-navy-800" : "text-navy-400",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cx(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]",
                          hit ? "bg-amber-100 text-amber-600" : "bg-success-50 text-success-500",
                        )}
                      >
                        {hit ? "!" : "✓"}
                      </span>
                      {c.label}
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Callout tone="quiet">{GUARDRAIL_DISCLAIMER}</Callout>
          </aside>
        </div>
      </div>

      <Modal
        open={Boolean(overriding)}
        onClose={() => setOverriding(null)}
        title="Override this finding"
        description="An override is allowed, and it is recorded. The reason is what makes it defensible when someone asks in three months why the claim was published."
        footer={
          <>
            <Button onClick={() => setOverriding(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={overrideReason.trim().length < 8}
              onClick={() => {
                if (overriding) {
                  resolveFinding(overriding.id, "overridden", {
                    overrideReason: overrideReason.trim(),
                  });
                }
                setOverriding(null);
              }}
            >
              Record override
            </Button>
          </>
        }
      >
        <Field
          label="Reason for override (required)"
          hint="Example: “Claim supported by internal clinical study dated March 2026, on file with the brand team.”"
        >
          <Textarea
            rows={3}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="What substantiates this claim?"
            className="!font-sans"
          />
        </Field>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit the copy yourself"
        description={
          editing
            ? `Rewriting the ${editing.field} of ${editing.creativeLabel}. The finding is marked resolved once you save.`
            : undefined
        }
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={editText.trim().length === 0}
              onClick={() => {
                if (editing) {
                  resolveFinding(editing.id, "manually-edited", { newText: editText.trim() });
                }
                setEditing(null);
              }}
            >
              Save copy
            </Button>
          </>
        }
      >
        <Field label="Replacement text">
          <Textarea
            rows={4}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="!font-sans"
          />
        </Field>
      </Modal>
    </PlanStagePage>
  );
}

function Panel({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "danger" | "success" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border px-4 py-3",
        tone === "danger"
          ? "border-danger-200 bg-danger-50"
          : tone === "success"
            ? "border-success-200 bg-success-50"
            : "border-line bg-ivory-50",
      )}
    >
      <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-navy-400">{label}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-navy-700">{children}</p>
    </div>
  );
}

/**
 * The gate runs first. GuardrailsPageBody reads directly into the plan's
 * guardrails data, so it is only mounted once that data is guaranteed to exist.
 */
export default function GuardrailsPage() {
  const { plan, ready } = useWorkspace();
  if (!ready || stageBlockedReason(plan, "guardrails")) return <GatedStage stage="guardrails" />;
  return <GuardrailsPageBody />;
}
