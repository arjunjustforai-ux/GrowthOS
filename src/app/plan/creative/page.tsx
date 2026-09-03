"use client";

import React from "react";
import type { CreativeAsset } from "@/lib/types";
import { checkLLM, regenerateCopy, type LLMAvailability } from "@/lib/llm/client";
import { GatedStage, PlanStagePage, StageFooter } from "@/components/plan/PlanStage";
import {
  Badge,
  Button,
  Callout,
  Card,
  DecisionBanner,
  Field,
  Input,
  Textarea,
  cx,
} from "@/components/ui";
import { stageBlockedReason } from "@/lib/engine/pipeline";
import { useWorkspace } from "@/lib/store/workspace";

function CreativePageBody() {
  const { plan, updateCreative, setCreativeStatus, completeStage } = useWorkspace();
  const [llm, setLlm] = React.useState<LLMAvailability | null>(null);

  React.useEffect(() => {
    void checkLLM().then(setLlm);
  }, []);

  const creatives = plan?.creatives ?? [];
  const approvedCount = creatives.filter((c) => c.status === "approved" || c.status === "edited").length;

  return (
    <PlanStagePage
      stage="creative"
      title="Campaign creative"
      description="One concept per funded channel, each tied to a segment and a job. Three good ones, not thirty variants — the decision here is whether the angle is right, and that is not a decision volume helps with."
      meta={
        llm ? (
          <Badge tone={llm.available ? "accent" : "outline"} className="normal-case tracking-normal">
            {llm.available
              ? `Copy assistance: ${llm.provider}/${llm.model}`
              : "Deterministic copy — no LLM configured"}
          </Badge>
        ) : null
      }
      footer={
        <StageFooter
          backHref="/plan/budget"
          backLabel="Budget"
          continueHref="/plan/guardrails"
          continueLabel="Run guardrail review"
          onContinue={() => completeStage("creative")}
          note={`${approvedCount} of ${creatives.length} reviewed. Every concept passes through guardrails regardless.`}
        />
      }
    >
      <div className="space-y-6">
        <DecisionBanner>
          Does each concept actually serve the strategy it was written for, and is the angle one this
          brand can stand behind?
        </DecisionBanner>

        <div className="grid gap-5 xl:grid-cols-3">
          {creatives.map((c) => (
            <CreativeCard
              key={c.id}
              creative={c}
              brand={plan?.company?.name ?? "the brand"}
              llmAvailable={llm?.available ?? false}
              onChange={(patch) => updateCreative(c.id, patch)}
              onStatus={(status) => setCreativeStatus(c.id, status)}
            />
          ))}
        </div>

        <Callout tone="quiet">
          <p className="font-medium text-navy-700">Nothing here is scheduled or published</p>
          <p className="mt-1 leading-relaxed">
            GrowthOS does not connect to Meta, Google or any ad account. These are concepts for a
            proposal. Whoever builds and launches the campaign does that in the platform, after a
            human has approved the plan.
          </p>
        </Callout>
      </div>
    </PlanStagePage>
  );
}

function CreativeCard({
  creative,
  brand,
  llmAvailable,
  onChange,
  onStatus,
}: {
  creative: CreativeAsset;
  brand: string;
  llmAvailable: boolean;
  onChange: (patch: Partial<CreativeAsset>) => void;
  onStatus: (status: CreativeAsset["status"]) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setNote(null);
    try {
      const result = await regenerateCopy(creative, brand, []);
      if (result.source === "llm") {
        onChange({
          headline: result.headline,
          body: result.body,
          cta: result.cta,
          generatedBy: "llm",
          status: "edited",
        });
      }
      setNote(result.note ?? null);
    } finally {
      setBusy(false);
    }
  }

  const statusTone =
    creative.status === "approved"
      ? "success"
      : creative.status === "edited"
        ? "accent"
        : creative.status === "rejected"
          ? "danger"
          : "outline";

  return (
    <Card className={cx("flex flex-col px-5 py-5", busy && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{creative.channelLabel}</p>
          <p className="mt-1 text-xs text-navy-400">{creative.format}</p>
        </div>
        <Badge tone={statusTone}>{creative.status}</Badge>
      </div>

      <div className="mt-5 flex-1 rounded-card border border-line bg-ivory-50 px-4 py-4">
        {editing ? (
          <div className="space-y-3">
            <Field label="Headline">
              <Input
                value={creative.headline}
                onChange={(e) => onChange({ headline: e.target.value, status: "edited" })}
                className="!font-sans"
              />
            </Field>
            <Field label="Primary copy">
              <Textarea
                rows={4}
                value={creative.body}
                onChange={(e) => onChange({ body: e.target.value, status: "edited" })}
                className="!font-sans"
              />
            </Field>
            <Field label="Call to action">
              <Input
                value={creative.cta}
                onChange={(e) => onChange({ cta: e.target.value, status: "edited" })}
                className="!font-sans"
              />
            </Field>
          </div>
        ) : (
          <>
            <p className="font-serif text-lg leading-snug text-navy-800">{creative.headline}</p>
            <p className="mt-2.5 text-[13px] leading-relaxed text-navy-600">{creative.body}</p>
            <span className="mt-4 inline-flex rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-medium text-ivory-100">
              {creative.cta}
            </span>
          </>
        )}
      </div>

      <dl className="mt-4 space-y-2.5">
        <Row label="Target">{creative.targetSegmentName}</Row>
        <Row label="Purpose">{creative.strategicPurpose}</Row>
        <Row label="Why written this way">{creative.reasoning}</Row>
      </dl>

      {note ? (
        <p className="mt-3 rounded-lg border border-line bg-ivory-50 px-3 py-2 text-xs leading-relaxed text-navy-500">
          {note}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={creative.status === "approved" ? "primary" : "secondary"}
          onClick={() => onStatus("approved")}
        >
          {creative.status === "approved" ? "Approved" : "Approve"}
        </Button>
        <Button size="sm" onClick={() => setEditing((e) => !e)}>
          {editing ? "Done editing" : "Edit"}
        </Button>
        <Button size="sm" variant="ghost" onClick={regenerate} disabled={busy}>
          {busy ? "Regenerating…" : llmAvailable ? "Regenerate" : "Regenerate*"}
        </Button>
      </div>
      {!llmAvailable ? (
        <p className="mt-2 text-2xs leading-relaxed text-navy-400">
          * No LLM is configured, so regeneration returns the deterministic concept unchanged. The
          product is designed to run this way.
        </p>
      ) : null}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_1fr] gap-3">
      <dt className="text-2xs font-semibold uppercase tracking-[0.09em] text-navy-400">{label}</dt>
      <dd className="text-xs leading-relaxed text-navy-600">{children}</dd>
    </div>
  );
}

/**
 * The gate runs first. CreativePageBody reads directly into the plan's
 * creative data, so it is only mounted once that data is guaranteed to exist.
 */
export default function CreativePage() {
  const { plan, ready } = useWorkspace();
  if (!ready || stageBlockedReason(plan, "creative")) return <GatedStage stage="creative" />;
  return <CreativePageBody />;
}
