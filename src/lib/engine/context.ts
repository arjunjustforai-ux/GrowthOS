import type {
  ChannelPerformance,
  CompanyProfile,
  ContextCompleteness,
  CustomerSegment,
  MissingDataItem,
} from "@/lib/types";
import { clamp, safeDiv } from "./math";

/**
 * Stage 1 — Context Interpreter.
 *
 * Turns whatever the user gave us into a usable structured profile, scores how
 * complete it is, and fills the gaps with clearly-labelled inferred defaults.
 * Missing data reduces confidence. It never blocks the workflow.
 */

interface RequiredField {
  key: keyof CompanyProfile | string;
  label: string;
  /** Percentage points of confidence lost when this field is absent. */
  cost: number;
  why: string;
  present: (c: CompanyProfile) => boolean;
}

const REQUIRED_FIELDS: RequiredField[] = [
  {
    key: "name",
    label: "Company name",
    cost: 1,
    why: "Used only for labelling the proposal.",
    present: (c) => c.name.trim().length > 0,
  },
  {
    key: "industry",
    label: "Industry / category",
    cost: 3,
    why: "Sets the benchmark band used when a metric has to be inferred.",
    present: (c) => c.industry.trim().length > 0,
  },
  {
    key: "annualRevenueINR",
    label: "Annual revenue",
    cost: 4,
    why: "Anchors what a realistic monthly revenue movement looks like.",
    present: (c) => c.annualRevenueINR > 0,
  },
  {
    key: "monthlyPaidSpendINR",
    label: "Monthly paid-media spend",
    cost: 8,
    why: "Without it there is no budget to allocate and no baseline efficiency.",
    present: (c) => c.monthlyPaidSpendINR > 0,
  },
  {
    key: "aovINR",
    label: "Average order value",
    cost: 7,
    why: "Every revenue and contribution figure is derived from AOV.",
    present: (c) => c.aovINR > 0,
  },
  {
    key: "grossMarginPct",
    label: "Gross margin",
    cost: 8,
    why: "Separates revenue growth from profitable revenue growth.",
    present: (c) => c.grossMarginPct > 0,
  },
  {
    key: "repeatPurchaseRatePct",
    label: "Repeat purchase rate",
    cost: 7,
    why: "Decides how much of a customer's value arrives after the first order.",
    present: (c) => c.repeatPurchaseRatePct > 0,
  },
  {
    key: "channels",
    label: "Channel performance (CAC / ROAS)",
    cost: 14,
    why: "The channel argument cannot be evidenced without per-channel efficiency.",
    present: (c) => c.channels.length > 0,
  },
  {
    key: "segments",
    label: "Customer segments",
    cost: 10,
    why: "Segment ranking falls back to generic archetypes without it.",
    present: (c) => c.segments.length > 0,
  },
  {
    key: "repeatCustomerCacINR",
    label: "Repeat customer CAC",
    cost: 7,
    why: "Retention investment is priced from an assumed reactivation cost instead of a measured one.",
    present: (c) => c.fieldSources["repeatCustomerCacINR"] === "user" || c.fieldSources["repeatCustomerCacINR"] === "demo",
  },
  {
    key: "googleConversionData",
    label: "Google conversion data",
    cost: 8,
    why: "Intent-capture scalability is estimated from impression share alone.",
    present: (c) =>
      c.fieldSources["googleConversionData"] === "user" ||
      c.fieldSources["googleConversionData"] === "demo",
  },
  {
    key: "marketingTeamSize",
    label: "Marketing team size",
    cost: 2,
    why: "Caps how many channels can realistically be run well in one cycle.",
    present: (c) => c.marketingTeamSize > 0,
  },
  {
    key: "geography",
    label: "Geography",
    cost: 2,
    why: "Affects reachable audience size.",
    present: (c) => c.geography.trim().length > 0,
  },
  {
    key: "primarySalesChannel",
    label: "Primary sales channel",
    cost: 2,
    why: "Determines whether owned-store retention levers are available at all.",
    present: (c) => c.primarySalesChannel.trim().length > 0,
  },
];

export function assessCompleteness(company: CompanyProfile): ContextCompleteness {
  const missing: MissingDataItem[] = [];
  let earned = 0;
  let total = 0;

  for (const field of REQUIRED_FIELDS) {
    total += field.cost;
    if (field.present(company)) {
      earned += field.cost;
    } else {
      missing.push({
        field: String(field.key),
        label: field.label,
        confidenceCostPct: field.cost,
        why: field.why,
      });
    }
  }

  const scorePct = Math.round(safeDiv(earned, total) * 100);
  // A missing field costs less confidence than it costs completeness: the
  // inferred default is a real, if weaker, substitute.
  const confidencePenaltyPct = Math.round(
    missing.reduce((acc, m) => acc + m.confidenceCostPct * 0.55, 0),
  );

  const sources = Object.values(company.fieldSources);
  return {
    scorePct,
    missing,
    confidencePenaltyPct,
    providedCount: sources.filter((s) => s === "user" || s === "demo").length,
    inferredCount: sources.filter((s) => s === "inferred").length,
    totalFields: REQUIRED_FIELDS.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Inferred defaults                                                           */
/* -------------------------------------------------------------------------- */

/** Category benchmark bands used when the user leaves a field blank. */
const BENCHMARKS = {
  aovINR: 1_400,
  grossMarginPct: 58,
  repeatPurchaseRatePct: 21,
  annualRevenueMultipleOfSpend: 11,
};

function inferredChannels(company: CompanyProfile): ChannelPerformance[] {
  const spend = company.monthlyPaidSpendINR || 300_000;
  const aov = company.aovINR || BENCHMARKS.aovINR;
  const margin = (company.grossMarginPct || BENCHMARKS.grossMarginPct) / 100;
  // Benchmark CAC for an Indian D2C brand: roughly 60% of AOV at break-even
  // margin, adjusted so the implied ROAS lands in a plausible 2–5x band.
  const baseCac = Math.round(aov * 0.6);
  return [
    {
      id: "meta",
      name: "Meta Ads",
      role: "demand-generation",
      monthlySpendINR: Math.round(spend * 0.5),
      cacINR: baseCac,
      roas: Number((safeDiv(aov, baseCac) * (1 + margin)).toFixed(2)),
      conversionRatePct: 1.8,
      impressionSharePct: 45,
      headroom: 0.65,
      costElasticity: 0.42,
      dataConfidence: 0.5,
    },
    {
      id: "google",
      name: "Google Ads",
      role: "intent-capture",
      monthlySpendINR: Math.round(spend * 0.3),
      cacINR: Math.round(baseCac * 1.35),
      roas: Number((safeDiv(aov, baseCac * 1.35) * (1 + margin) * 1.25).toFixed(2)),
      conversionRatePct: 3.1,
      impressionSharePct: 70,
      headroom: 0.32,
      costElasticity: 0.5,
      dataConfidence: 0.45,
    },
    {
      id: "retention",
      name: "Retention / CRM",
      role: "repeat-conversion",
      monthlySpendINR: Math.round(spend * 0.2),
      cacINR: Math.round(baseCac * 0.5),
      roas: Number((safeDiv(aov, baseCac * 0.5) * (1 + margin)).toFixed(2)),
      conversionRatePct: 4.6,
      impressionSharePct: 15,
      headroom: 0.7,
      costElasticity: 0.3,
      dataConfidence: 0.42,
    },
  ];
}

function inferredSegments(company: CompanyProfile): CustomerSegment[] {
  const aov = company.aovINR || BENCHMARKS.aovINR;
  const margin = company.grossMarginPct || BENCHMARKS.grossMarginPct;
  const repeat = company.repeatPurchaseRatePct || BENCHMARKS.repeatPurchaseRatePct;
  const baseCac = Math.round(aov * 0.6);
  const monthlyOrders = Math.max(
    600,
    Math.round(safeDiv(company.annualRevenueINR / 12, aov) || 1_200),
  );
  return [
    {
      id: "inferred-repeat",
      name: "Repeat Buyers",
      description: "Archetype inferred from category benchmarks — no first-party segment supplied.",
      estimatedSize: Math.round(monthlyOrders * 12 * (repeat / 100)),
      historicalCacINR: Math.round(baseCac * 0.78),
      repeatRatePct: Math.round(repeat * 1.7),
      aovINR: Math.round(aov * 1.08),
      grossMarginPct: margin + 2,
      conversionPropensity: 0.72,
      reachability: 0.8,
      channelAffinity: { meta: 0.85, google: 0.5, retention: 0.94, influencer: 0.35 },
      dataConfidence: 0.42,
    },
    {
      id: "inferred-high-intent",
      name: "High-Intent First-Time Buyers",
      description: "Archetype inferred from category benchmarks — no first-party segment supplied.",
      estimatedSize: Math.round(monthlyOrders * 12 * 1.4),
      historicalCacINR: Math.round(baseCac * 1.12),
      repeatRatePct: Math.round(repeat * 0.75),
      aovINR: aov,
      grossMarginPct: margin,
      conversionPropensity: 0.6,
      reachability: 0.9,
      channelAffinity: { meta: 0.7, google: 0.92, retention: 0.15, influencer: 0.6 },
      dataConfidence: 0.4,
    },
    {
      id: "inferred-lapsed",
      name: "Lapsed Customers 90–180 Days",
      description: "Archetype inferred from category benchmarks — no first-party segment supplied.",
      estimatedSize: Math.round(monthlyOrders * 12 * 0.55),
      historicalCacINR: Math.round(baseCac * 0.48),
      repeatRatePct: Math.round(repeat * 1.2),
      aovINR: Math.round(aov * 0.93),
      grossMarginPct: margin - 1,
      conversionPropensity: 0.52,
      reachability: 0.68,
      channelAffinity: { meta: 0.62, google: 0.2, retention: 0.96, influencer: 0.18 },
      dataConfidence: 0.38,
      isReactivation: true,
    },
  ];
}

/**
 * Fill gaps with benchmark defaults and record every one of them as "inferred"
 * so the UI can keep user data and machine guesses visually separate.
 */
export function applyInferredDefaults(input: CompanyProfile): CompanyProfile {
  const company: CompanyProfile = JSON.parse(JSON.stringify(input));
  const mark = (key: string) => {
    if (!company.fieldSources[key]) company.fieldSources[key] = "inferred";
  };

  if (!company.name.trim()) {
    company.name = "Unnamed Brand";
    mark("name");
  }
  if (!company.industry.trim()) {
    company.industry = "Direct-to-consumer";
    mark("industry");
  }
  if (!company.geography.trim()) {
    company.geography = "India";
    mark("geography");
  }
  if (!company.primarySalesChannel.trim()) {
    company.primarySalesChannel = "Own online store";
    mark("primarySalesChannel");
  }
  if (company.monthlyPaidSpendINR <= 0) {
    company.monthlyPaidSpendINR = 300_000;
    mark("monthlyPaidSpendINR");
  }
  if (company.annualRevenueINR <= 0) {
    company.annualRevenueINR =
      company.monthlyPaidSpendINR * 12 * BENCHMARKS.annualRevenueMultipleOfSpend;
    mark("annualRevenueINR");
  }
  if (company.aovINR <= 0) {
    company.aovINR = BENCHMARKS.aovINR;
    mark("aovINR");
  }
  if (company.grossMarginPct <= 0) {
    company.grossMarginPct = BENCHMARKS.grossMarginPct;
    mark("grossMarginPct");
  }
  if (company.repeatPurchaseRatePct <= 0) {
    company.repeatPurchaseRatePct = BENCHMARKS.repeatPurchaseRatePct;
    mark("repeatPurchaseRatePct");
  }
  if (company.marketingTeamSize <= 0) {
    company.marketingTeamSize = 2;
    mark("marketingTeamSize");
  }
  if (company.channels.length === 0) {
    company.channels = inferredChannels(company);
    mark("channels");
  }
  if (company.segments.length === 0) {
    company.segments = inferredSegments(company);
    mark("segments");
  }
  return company;
}

/* -------------------------------------------------------------------------- */
/* Derived account metrics                                                     */
/* -------------------------------------------------------------------------- */

export interface AccountMetrics {
  /** Blended CAC across acquisition channels only — retention is excluded. */
  blendedCacINR: number;
  totalMonthlySpendINR: number;
  acquisitionSpendINR: number;
  newCustomersPerMonth: number;
  blendedRoas: number;
  /**
   * How much more a customer is worth than their first order, given the repeat
   * rate. 1.0 means the first order is the whole relationship.
   */
  lifetimeMultiplier: number;
  contributionPerCustomerINR: number;
}

/** Each repeat cycle is worth ~0.85 of the first order after margin decay. */
const REPEAT_VALUE_FACTOR = 1.6;

export function accountMetrics(company: CompanyProfile): AccountMetrics {
  const acquisition = company.channels.filter((c) => c.role !== "repeat-conversion");
  const acquisitionSpend = acquisition.reduce((a, c) => a + c.monthlySpendINR, 0);
  const customers = acquisition.reduce((a, c) => a + safeDiv(c.monthlySpendINR, c.cacINR), 0);
  const blendedCac = safeDiv(acquisitionSpend, customers, company.aovINR * 0.6);
  const totalSpend = company.channels.reduce((a, c) => a + c.monthlySpendINR, 0) ||
    company.monthlyPaidSpendINR;
  const lifetimeMultiplier = 1 + (company.repeatPurchaseRatePct / 100) * REPEAT_VALUE_FACTOR;
  const contributionPerCustomer =
    company.aovINR * (company.grossMarginPct / 100) * lifetimeMultiplier - blendedCac;
  // Retention conversions are revenue too, even though they are not new customers.
  const retentionRevenue = company.channels
    .filter((c) => c.role === "repeat-conversion")
    .reduce((a, c) => a + safeDiv(c.monthlySpendINR, c.cacINR) * company.aovINR, 0);
  const revenue = customers * company.aovINR * lifetimeMultiplier + retentionRevenue;

  return {
    blendedCacINR: Math.round(blendedCac),
    totalMonthlySpendINR: totalSpend,
    acquisitionSpendINR: acquisitionSpend,
    newCustomersPerMonth: Math.round(customers),
    blendedRoas: Number(safeDiv(revenue, totalSpend).toFixed(2)),
    lifetimeMultiplier: Number(lifetimeMultiplier.toFixed(3)),
    contributionPerCustomerINR: Math.round(contributionPerCustomer),
  };
}

export function segmentUnitContribution(
  segment: CustomerSegment,
): number {
  const lifetime = 1 + (segment.repeatRatePct / 100) * REPEAT_VALUE_FACTOR;
  return segment.aovINR * (segment.grossMarginPct / 100) * lifetime - segment.historicalCacINR;
}

export { REPEAT_VALUE_FACTOR, clamp };
