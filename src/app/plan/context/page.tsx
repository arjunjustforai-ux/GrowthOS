"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { BusinessModel, CompanyProfile, FieldSource } from "@/lib/types";
import { DEMO_COMPANIES, cloneCompany, emptyCompany } from "@/lib/demo/companies";
import { accountMetrics, applyInferredDefaults, assessCompleteness } from "@/lib/engine/context";
import { formatCompactINR, formatINR } from "@/lib/format";
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
  Meter,
  Select,
  SourceTag,
  Stat,
  cx,
} from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

const BUSINESS_MODELS: { id: BusinessModel; label: string }[] = [
  { id: "d2c-ecommerce", label: "D2C e-commerce" },
  { id: "subscription", label: "Subscription" },
  { id: "marketplace", label: "Marketplace" },
  { id: "omnichannel-retail", label: "Omnichannel retail" },
  { id: "services", label: "Services" },
];

export default function ContextPage() {
  const { plan, startPlan, setCompany, completeStage, track, ready } = useWorkspace();
  const router = useRouter();
  const [draft, setDraft] = React.useState<CompanyProfile | null>(null);
  const [csvNote, setCsvNote] = React.useState<string | null>(null);

  // Start a plan automatically so the presenter never lands on a dead screen.
  React.useEffect(() => {
    if (ready && !plan) startPlan(null);
  }, [ready, plan, startPlan]);

  React.useEffect(() => {
    if (plan?.company && !draft) {
      setDraft(plan.company);
    }
  }, [plan?.company, draft]);

  React.useEffect(() => {
    if (ready) track("context_started");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const company = draft;
  const completeness = React.useMemo(
    () => (company ? assessCompleteness(company) : null),
    [company],
  );
  const metrics = React.useMemo(
    () => (company && company.channels.length > 0 ? accountMetrics(company) : null),
    [company],
  );

  function loadDemo(id: string) {
    const found = DEMO_COMPANIES.find((c) => c.id === id);
    if (!found) return;
    const next = cloneCompany(found);
    setDraft(next);
    setCompany(next);
    setCsvNote(null);
  }

  function startBlank() {
    const next = emptyCompany();
    setDraft(next);
    setCompany(next);
  }

  function patch(field: keyof CompanyProfile, value: string | number) {
    if (!company) return;
    const next: CompanyProfile = {
      ...company,
      [field]: value,
      fieldSources: { ...company.fieldSources, [field]: "user" as FieldSource },
    };
    setDraft(next);
  }

  function commit() {
    if (!company) return;
    setCompany(company);
  }

  function continueWithDefaults() {
    if (!company) return;
    const filled = applyInferredDefaults(company);
    setDraft(filled);
    setCompany(filled);
  }

  function onCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = text
          .split(/\r?\n/)
          .map((r) => r.split(",").map((c) => c.trim()))
          .filter((r) => r.length >= 3 && r[0]);
        const header = rows[0].map((h) => h.toLowerCase());
        const idIdx = header.findIndex((h) => /channel|source/.test(h));
        const spendIdx = header.findIndex((h) => /spend|cost/.test(h));
        const cacIdx = header.findIndex((h) => /cac|cpa/.test(h));
        const roasIdx = header.findIndex((h) => /roas/.test(h));
        if (idIdx < 0 || spendIdx < 0 || cacIdx < 0 || !company) {
          setCsvNote(
            "Could not read that file. GrowthOS expects a header row containing channel, spend and CAC columns.",
          );
          return;
        }
        let applied = 0;
        const channels = company.channels.map((ch) => {
          const row = rows
            .slice(1)
            .find((r) => r[idIdx].toLowerCase().includes(ch.id) || ch.name.toLowerCase().includes(r[idIdx].toLowerCase()));
          if (!row) return ch;
          applied += 1;
          return {
            ...ch,
            monthlySpendINR: Number(row[spendIdx].replace(/[^\d.]/g, "")) || ch.monthlySpendINR,
            cacINR: Number(row[cacIdx].replace(/[^\d.]/g, "")) || ch.cacINR,
            roas: roasIdx >= 0 ? Number(row[roasIdx].replace(/[^\d.]/g, "")) || ch.roas : ch.roas,
            dataConfidence: Math.min(0.95, ch.dataConfidence + 0.06),
          };
        });
        const next: CompanyProfile = {
          ...company,
          channels,
          fieldSources: { ...company.fieldSources, channels: "user" },
        };
        setDraft(next);
        setCompany(next);
        setCsvNote(
          applied > 0
            ? `Updated ${applied} channel row${applied === 1 ? "" : "s"} from ${file.name}. Those figures are now marked as your data.`
            : `No channel in ${file.name} matched an existing channel, so nothing was changed.`,
        );
      } catch {
        setCsvNote("That file could not be parsed. The existing context is unchanged.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <PlanStagePage
      stage="context"
      title="Company context"
      description="GrowthOS needs enough about the business to argue from evidence rather than from vibes. It does not need everything — anything missing is inferred, labelled, and charged against confidence."
      actions={
        <>
          {DEMO_COMPANIES.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={company?.id === c.id ? "primary" : "secondary"}
              onClick={() => loadDemo(c.id)}
            >
              {c.name}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={startBlank}>
            Start blank
          </Button>
        </>
      }
      footer={
        <StageFooter
          backHref="/"
          backLabel="Home"
          continueHref="/plan/objective"
          continueLabel="Set growth objective"
          continueDisabled={!company}
          onContinue={() => {
            commit();
            completeStage("context");
            track("context_completed", { completeness: completeness?.scorePct ?? 0 });
          }}
          note={
            completeness && completeness.missing.length > 0
              ? `${completeness.missing.length} field${completeness.missing.length === 1 ? "" : "s"} missing — you can continue anyway.`
              : undefined
          }
        />
      }
    >
      {!company ? (
        <Card className="px-7 py-12 text-center">
          <h2 className="font-serif text-2xl text-navy-800">Load a company to begin</h2>
          <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-navy-400">
            Pick one of the three seeded D2C brands to see the full flow with realistic figures, or
            start blank and type your own. Either way, nothing here is published anywhere.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {DEMO_COMPANIES.map((c) => (
              <Button key={c.id} variant="primary" onClick={() => loadDemo(c.id)}>
                Load {c.name}
              </Button>
            ))}
            <Button onClick={startBlank}>Start blank</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <DecisionBanner>
              What do we actually know about this business, and how much of the recommendation will
              rest on assumption rather than evidence?
            </DecisionBanner>

            <Card className="px-5 py-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h3 className="font-serif text-lg text-navy-800">The business</h3>
                {company.isDemo ? (
                  <Badge tone="amber" className="normal-case tracking-normal">
                    Demo dataset — simulated
                  </Badge>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWithSource label="Company name" source={sourceOf(company, "name")}>
                  <Input
                    value={company.name}
                    placeholder="Aura Skincare"
                    onChange={(e) => patch("name", e.target.value)}
                    onBlur={commit}
                    className="!font-sans"
                  />
                </FieldWithSource>
                <FieldWithSource label="Industry / category" source={sourceOf(company, "industry")}>
                  <Input
                    value={company.industry}
                    placeholder="Beauty & Personal Care"
                    onChange={(e) => patch("industry", e.target.value)}
                    onBlur={commit}
                    className="!font-sans"
                  />
                </FieldWithSource>
                <FieldWithSource label="Business model" source={sourceOf(company, "businessModel")}>
                  <Select
                    value={company.businessModel}
                    onChange={(e) => {
                      patch("businessModel", e.target.value);
                    }}
                    onBlur={commit}
                  >
                    {BUSINESS_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </FieldWithSource>
                <FieldWithSource label="Geography" source={sourceOf(company, "geography")}>
                  <Input
                    value={company.geography}
                    placeholder="India — metro & tier-1"
                    onChange={(e) => patch("geography", e.target.value)}
                    onBlur={commit}
                    className="!font-sans"
                  />
                </FieldWithSource>
                <FieldWithSource
                  label="Primary sales channel"
                  source={sourceOf(company, "primarySalesChannel")}
                >
                  <Input
                    value={company.primarySalesChannel}
                    placeholder="Own Shopify store"
                    onChange={(e) => patch("primarySalesChannel", e.target.value)}
                    onBlur={commit}
                    className="!font-sans"
                  />
                </FieldWithSource>
                <FieldWithSource
                  label="Marketing team size"
                  source={sourceOf(company, "marketingTeamSize")}
                >
                  <Input
                    type="number"
                    min={0}
                    value={company.marketingTeamSize || ""}
                    onChange={(e) => patch("marketingTeamSize", Number(e.target.value))}
                    onBlur={commit}
                  />
                </FieldWithSource>
              </div>
            </Card>

            <Card className="px-5 py-5">
              <h3 className="mb-5 font-serif text-lg text-navy-800">Economics</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWithSource
                  label="Annual revenue (₹)"
                  source={sourceOf(company, "annualRevenueINR")}
                  hint={company.annualRevenueINR ? formatCompactINR(company.annualRevenueINR) : undefined}
                >
                  <Input
                    type="number"
                    value={company.annualRevenueINR || ""}
                    onChange={(e) => patch("annualRevenueINR", Number(e.target.value))}
                    onBlur={commit}
                  />
                </FieldWithSource>
                <FieldWithSource
                  label="Monthly paid-media spend (₹)"
                  source={sourceOf(company, "monthlyPaidSpendINR")}
                  hint={
                    company.monthlyPaidSpendINR
                      ? formatCompactINR(company.monthlyPaidSpendINR)
                      : undefined
                  }
                >
                  <Input
                    type="number"
                    value={company.monthlyPaidSpendINR || ""}
                    onChange={(e) => patch("monthlyPaidSpendINR", Number(e.target.value))}
                    onBlur={commit}
                  />
                </FieldWithSource>
                <FieldWithSource label="Average order value (₹)" source={sourceOf(company, "aovINR")}>
                  <Input
                    type="number"
                    value={company.aovINR || ""}
                    onChange={(e) => patch("aovINR", Number(e.target.value))}
                    onBlur={commit}
                  />
                </FieldWithSource>
                <FieldWithSource label="Gross margin (%)" source={sourceOf(company, "grossMarginPct")}>
                  <Input
                    type="number"
                    value={company.grossMarginPct || ""}
                    onChange={(e) => patch("grossMarginPct", Number(e.target.value))}
                    onBlur={commit}
                  />
                </FieldWithSource>
                <FieldWithSource
                  label="Repeat purchase rate (%)"
                  source={sourceOf(company, "repeatPurchaseRatePct")}
                >
                  <Input
                    type="number"
                    value={company.repeatPurchaseRatePct || ""}
                    onChange={(e) => patch("repeatPurchaseRatePct", Number(e.target.value))}
                    onBlur={commit}
                  />
                </FieldWithSource>
                <Field
                  label="Channel performance CSV (optional)"
                  hint="Header row with channel, spend and CAC columns. Imported rows are marked as your data."
                >
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onCsv(f);
                    }}
                    className="w-full rounded-lg border border-dashed border-line-strong bg-ivory-50 px-3 py-2 text-xs text-navy-500 file:mr-3 file:rounded file:border-0 file:bg-navy-800 file:px-2.5 file:py-1 file:text-xs file:text-ivory-100"
                  />
                </Field>
              </div>
              {csvNote ? (
                <Callout tone="quiet" className="mt-4">
                  {csvNote}
                </Callout>
              ) : null}
            </Card>

            {company.channels.length > 0 ? (
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <h3 className="font-serif text-lg text-navy-800">Acquisition channels</h3>
                  <SourceTag source={sourceOf(company, "channels")} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-y border-line-soft bg-ivory-50 text-left">
                        <th className="px-5 py-2 font-medium text-navy-400">Channel</th>
                        <th className="px-3 py-2 text-right font-medium text-navy-400">Spend</th>
                        <th className="px-3 py-2 text-right font-medium text-navy-400">CAC</th>
                        <th className="px-3 py-2 text-right font-medium text-navy-400">ROAS</th>
                        <th className="px-5 py-2 text-right font-medium text-navy-400">Impr. share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {company.channels.map((c) => (
                        <tr key={c.id} className="border-b border-line-soft last:border-0">
                          <td className="px-5 py-2.5">
                            <span className="font-medium text-navy-700">{c.name}</span>
                          </td>
                          <td className="tnum px-3 py-2.5 text-right text-navy-600">
                            {formatCompactINR(c.monthlySpendINR)}
                          </td>
                          <td className="tnum px-3 py-2.5 text-right text-navy-600">
                            {formatINR(c.cacINR)}
                          </td>
                          <td className="tnum px-3 py-2.5 text-right text-navy-600">
                            {c.roas.toFixed(2)}x
                          </td>
                          <td className="tnum px-5 py-2.5 text-right text-navy-600">
                            {c.impressionSharePct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-4">
            {completeness ? (
              <Card className="px-5 py-5">
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow">Context completeness</p>
                  <span className="tnum font-serif text-3xl leading-none text-navy-800">
                    {completeness.scorePct}%
                  </span>
                </div>
                <Meter
                  className="mt-3"
                  value={completeness.scorePct}
                  tone={
                    completeness.scorePct >= 85
                      ? "success"
                      : completeness.scorePct >= 60
                        ? "amber"
                        : "danger"
                  }
                />

                {completeness.missing.length > 0 ? (
                  <>
                    <p className="mt-5 text-2xs font-semibold uppercase tracking-[0.1em] text-navy-400">
                      Missing
                    </p>
                    <ul className="mt-2 space-y-2.5">
                      {completeness.missing.map((m) => (
                        <li key={m.field}>
                          <p className="text-[13px] font-medium text-navy-700">• {m.label}</p>
                          <p className="mt-0.5 pl-3 text-xs leading-relaxed text-navy-400">{m.why}</p>
                        </li>
                      ))}
                    </ul>
                    <Callout tone="warning" className="mt-4">
                      <p className="font-medium text-navy-800">
                        Recommendation confidence reduced by approximately{" "}
                        {completeness.confidencePenaltyPct}%.
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-navy-600">
                        This does not stop you. GrowthOS will use category benchmarks for the gaps,
                        label every one of them as inferred, and carry the penalty through to the
                        confidence figure on the final proposal.
                      </p>
                    </Callout>
                    <Button className="mt-3 w-full" size="sm" onClick={continueWithDefaults}>
                      Continue with inferred defaults
                    </Button>
                  </>
                ) : (
                  <Callout tone="success" className="mt-4">
                    Every field GrowthOS scores is present. Nothing in this plan will rest on a
                    benchmark guess.
                  </Callout>
                )}

                <div className="mt-5 flex items-center gap-4 border-t border-line-soft pt-4 text-xs text-navy-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-accent-400" /> {completeness.providedCount}{" "}
                    provided
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-300" /> {completeness.inferredCount}{" "}
                    inferred
                  </span>
                </div>
              </Card>
            ) : null}

            {metrics ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Stat
                  label="Blended CAC today"
                  value={formatINR(metrics.blendedCacINR)}
                  sub="Across acquisition channels. Retention is excluded — reactivating a customer is not the same as buying one."
                />
                <Stat
                  label="Contribution per customer"
                  value={formatINR(metrics.contributionPerCustomerINR)}
                  sub={`At ${company.grossMarginPct}% margin over a ${metrics.lifetimeMultiplier.toFixed(2)}x repeat multiple.`}
                />
                <Stat
                  label="New customers / month"
                  value={metrics.newCustomersPerMonth.toLocaleString("en-IN")}
                  sub={`Implied by ${formatCompactINR(metrics.acquisitionSpendINR)} of acquisition spend.`}
                />
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </PlanStagePage>
  );
}

function sourceOf(company: CompanyProfile, key: string): FieldSource {
  return company.fieldSources[key] ?? "inferred";
}

function FieldWithSource({
  label,
  source,
  hint,
  children,
}: {
  label: string;
  source: FieldSource;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx(source === "inferred" && "rounded-lg bg-amber-50/50 -mx-2 px-2 py-1.5")}>
      <Field label={label} suffix={<SourceTag source={source} />} hint={hint}>
        {children}
      </Field>
    </div>
  );
}
