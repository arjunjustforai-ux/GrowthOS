"use client";

import React from "react";
import { DEMO_COMPANIES } from "@/lib/demo/companies";
import { accountMetrics, assessCompleteness } from "@/lib/engine/context";
import { formatCompactINR, formatINR, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/nav/AppShell";
import { Badge, Callout, Card, cx } from "@/components/ui";

/**
 * The demo data engine, made inspectable.
 *
 * A faculty member watching a demo should be able to ask "where did that number
 * come from?" and be shown the actual seed data in ten seconds. Every figure the
 * engine uses for the three demo brands is on this page.
 */
export default function DataPage() {
  const [selected, setSelected] = React.useState(DEMO_COMPANIES[0].id);
  const company = DEMO_COMPANIES.find((c) => c.id === selected) ?? DEMO_COMPANIES[0];
  const metrics = accountMetrics(company);
  const completeness = assessCompleteness(company);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Demo data engine"
        title="Every number the engine runs on"
        description="GrowthOS works with no APIs connected. These three fictional D2C brands are seeded locally, and they are the only data the recommendation engine ever sees during a demo."
        meta={
          <Badge tone="amber" className="normal-case tracking-normal">
            Demo dataset — simulated for product demonstration
          </Badge>
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8 sm:px-8">
        <Callout tone="warning" title="These figures are invented">
          They are shaped to be plausible for an Indian D2C brand in the ₹2–20 crore band, and they
          are not derived from any real company. Nothing here may be presented as market evidence or
          as real-world customer performance.
        </Callout>

        <div className="flex flex-wrap gap-2">
          {DEMO_COMPANIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c.id)}
              className={cx(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                c.id === selected
                  ? "border-navy-800 bg-navy-800 text-ivory-100"
                  : "border-line-strong bg-white text-navy-600 hover:border-navy-300",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        <Card className="px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl text-navy-800">{company.name}</h2>
              <p className="mt-1 text-sm text-navy-400">
                {company.industry} · {company.geography} · {company.marketingTeamSize}-person team
              </p>
            </div>
            <Badge tone="outline" className="normal-case tracking-normal">
              {completeness.scorePct}% context completeness
            </Badge>
          </div>
          {company.notes ? (
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-navy-600">{company.notes}</p>
          ) : null}

          <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-line-soft pt-4 sm:grid-cols-3 lg:grid-cols-4">
            <Cell label="Annual revenue">{formatCompactINR(company.annualRevenueINR)}</Cell>
            <Cell label="Monthly paid spend">{formatCompactINR(company.monthlyPaidSpendINR)}</Cell>
            <Cell label="AOV">{formatINR(company.aovINR)}</Cell>
            <Cell label="Gross margin">{company.grossMarginPct}%</Cell>
            <Cell label="Repeat purchase rate">{company.repeatPurchaseRatePct}%</Cell>
            <Cell label="Blended CAC">{formatINR(metrics.blendedCacINR)}</Cell>
            <Cell label="New customers / month">{formatNumber(metrics.newCustomersPerMonth)}</Cell>
            <Cell label="Contribution / customer">
              {formatINR(metrics.contributionPerCustomerINR)}
            </Cell>
          </dl>
        </Card>

        <Card className="overflow-hidden">
          <h3 className="px-5 py-4 font-serif text-lg text-navy-800">Channel performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-y border-line-soft bg-ivory-50 text-left">
                  <Th>Channel</Th>
                  <Th>Role</Th>
                  <Th right>Spend</Th>
                  <Th right>CAC</Th>
                  <Th right>ROAS</Th>
                  <Th right>Conv %</Th>
                  <Th right>Impr. share</Th>
                  <Th right>Headroom</Th>
                  <Th right>Elasticity</Th>
                  <Th right>Data conf.</Th>
                </tr>
              </thead>
              <tbody>
                {company.channels.map((c) => (
                  <tr key={c.id} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-2.5 font-medium text-navy-700">{c.name}</td>
                    <td className="px-3 py-2.5 text-navy-500">{c.role.replace("-", " ")}</td>
                    <Td>{formatCompactINR(c.monthlySpendINR)}</Td>
                    <Td>{formatINR(c.cacINR)}</Td>
                    <Td>{c.roas.toFixed(2)}x</Td>
                    <Td>{c.conversionRatePct}%</Td>
                    <Td>{c.impressionSharePct}%</Td>
                    <Td>{Math.round(c.headroom * 100)}%</Td>
                    <Td>{c.costElasticity.toFixed(2)}</Td>
                    <Td>{Math.round(c.dataConfidence * 100)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs leading-relaxed text-navy-400">
            Headroom is how much extra spend the channel can absorb before efficiency degrades, and
            it sets the cap the budget allocator applies. Elasticity is how steeply CAC rises as
            spend grows; the curve is asymmetric, so scaling a channel costs full elasticity while
            cutting one returns only a third of it. That is what makes the budget sliders produce a
            worse blended CAC when you concentrate, rather than a proportionally better one.
          </p>
        </Card>

        <Card className="overflow-hidden">
          <h3 className="px-5 py-4 font-serif text-lg text-navy-800">Customer segments</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-y border-line-soft bg-ivory-50 text-left">
                  <Th>Segment</Th>
                  <Th right>Size</Th>
                  <Th right>CAC</Th>
                  <Th right>Repeat</Th>
                  <Th right>AOV</Th>
                  <Th right>Margin</Th>
                  <Th right>Conv. propensity</Th>
                  <Th right>Reachability</Th>
                  <Th right>Data conf.</Th>
                </tr>
              </thead>
              <tbody>
                {company.segments.map((s) => (
                  <tr key={s.id} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-navy-700">{s.name}</span>
                      <span className="mt-0.5 block max-w-md text-xs leading-relaxed text-navy-400">
                        {s.description}
                      </span>
                    </td>
                    <Td>{formatNumber(s.estimatedSize)}</Td>
                    <Td>{formatINR(s.historicalCacINR)}</Td>
                    <Td>{s.repeatRatePct}%</Td>
                    <Td>{formatINR(s.aovINR)}</Td>
                    <Td>{s.grossMarginPct}%</Td>
                    <Td>{s.conversionPropensity.toFixed(2)}</Td>
                    <Td>{s.reachability.toFixed(2)}</Td>
                    <Td>{Math.round(s.dataConfidence * 100)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <h3 className="px-5 py-4 font-serif text-lg text-navy-800">Campaign history</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-line-soft bg-ivory-50 text-left">
                  <Th>Month</Th>
                  <Th right>Spend</Th>
                  <Th right>Revenue</Th>
                  <Th right>Blended CAC</Th>
                  <Th right>ROAS</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {company.campaignHistory.map((h) => (
                  <tr key={h.month} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-2.5 font-medium text-navy-700">{h.month}</td>
                    <Td>{formatCompactINR(h.spendINR)}</Td>
                    <Td>{formatCompactINR(h.revenueINR)}</Td>
                    <Td>{formatINR(h.blendedCacINR)}</Td>
                    <Td>{h.roas.toFixed(2)}x</Td>
                    <td className="px-5 py-2.5 text-xs text-navy-400">{h.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {completeness.missing.length > 0 ? (
          <Card className="px-5 py-5">
            <h3 className="font-serif text-lg text-navy-800">Deliberate gaps in this dataset</h3>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-navy-400">
              Real accounts are incomplete. These gaps are left in on purpose so the confidence
              penalty is visible in a demo rather than theoretical.
            </p>
            <ul className="mt-3 space-y-2">
              {completeness.missing.map((m) => (
                <li key={m.field} className="text-[13px] leading-relaxed text-navy-600">
                  <span className="font-medium text-navy-800">{m.label}</span> — {m.why} (
                  {m.confidenceCostPct} pts of completeness)
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cx(
        "px-3 py-2 font-medium text-navy-400 first:pl-5 last:pr-5",
        right && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="tnum px-3 py-2.5 text-right text-navy-600 last:pr-5">{children}</td>;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-[0.09em] text-navy-400">{label}</dt>
      <dd className="tnum mt-1 text-sm font-medium text-navy-800">{children}</dd>
    </div>
  );
}
