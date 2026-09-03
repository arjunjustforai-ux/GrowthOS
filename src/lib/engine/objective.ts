import type {
  CompanyProfile,
  GoalMetric,
  GrowthObjective,
  ObjectiveConstraint,
  ObjectivePresetId,
} from "@/lib/types";
import { clamp } from "./math";

/**
 * Stage 2 — Objective Interpreter.
 *
 * Turns a sentence a marketing lead would actually say into the measurable
 * variables the rest of the pipeline needs. The interpretation is always shown
 * back for confirmation: GrowthOS does not act on its own reading of an
 * objective without the human agreeing to it first (checkpoint 1).
 */

export interface ObjectivePreset {
  id: ObjectivePresetId;
  label: string;
  blurb: string;
  template: string;
  goalMetric: GoalMetric;
  defaultChangePct: number;
  defaultHorizonDays: number;
}

export const OBJECTIVE_PRESETS: ObjectivePreset[] = [
  {
    id: "profitable-revenue",
    label: "Increase profitable revenue",
    blurb: "Grow revenue without letting acquisition cost run away.",
    template:
      "Grow monthly revenue by 20% over the next quarter without increasing blended CAC above ₹1,200.",
    goalMetric: "revenue",
    defaultChangePct: 20,
    defaultHorizonDays: 90,
  },
  {
    id: "new-customers",
    label: "Acquire new customers",
    blurb: "Volume of first-time buyers is the number that matters.",
    template: "Acquire 30% more new customers over the next 90 days within the current budget.",
    goalMetric: "new-customers",
    defaultChangePct: 30,
    defaultHorizonDays: 90,
  },
  {
    id: "improve-roas",
    label: "Improve ROAS",
    blurb: "Same spend, more return.",
    template: "Improve blended ROAS by 15% over the next 60 days without cutting total spend.",
    goalMetric: "roas",
    defaultChangePct: 15,
    defaultHorizonDays: 60,
  },
  {
    id: "reduce-cac",
    label: "Reduce CAC",
    blurb: "Bring acquisition cost down without collapsing volume.",
    template: "Reduce blended CAC by 12% over the next 90 days while holding revenue flat.",
    goalMetric: "cac",
    defaultChangePct: -12,
    defaultHorizonDays: 90,
  },
  {
    id: "grow-repeat",
    label: "Grow repeat purchases",
    blurb: "Push value into the second and third order.",
    template: "Grow repeat purchase rate by 25% over the next quarter.",
    goalMetric: "repeat-rate",
    defaultChangePct: 25,
    defaultHorizonDays: 90,
  },
  {
    id: "launch-product",
    label: "Launch new product",
    blurb: "Get a new SKU in front of the right buyers quickly.",
    template: "Drive 20% incremental revenue from a new product launch in the next 60 days.",
    goalMetric: "revenue",
    defaultChangePct: 20,
    defaultHorizonDays: 60,
  },
  {
    id: "expand-category",
    label: "Expand category",
    blurb: "Reach buyers who do not know the brand yet.",
    template: "Expand into an adjacent category and grow revenue 15% over 120 days.",
    goalMetric: "revenue",
    defaultChangePct: 15,
    defaultHorizonDays: 120,
  },
  {
    id: "custom",
    label: "Custom objective",
    blurb: "Write it in your own words.",
    template: "",
    goalMetric: "revenue",
    defaultChangePct: 15,
    defaultHorizonDays: 90,
  },
];

export function presetById(id: ObjectivePresetId): ObjectivePreset {
  return OBJECTIVE_PRESETS.find((p) => p.id === id) ?? OBJECTIVE_PRESETS[0];
}

/* -------------------------------------------------------------------------- */
/* Natural-language reading                                                    */
/* -------------------------------------------------------------------------- */

const GOAL_KEYWORDS: { metric: GoalMetric; words: RegExp }[] = [
  { metric: "cac", words: /\b(reduce|lower|cut|bring down)\b[^.]*\bcac\b/i },
  { metric: "repeat-rate", words: /\brepeat|retention|reorder|second order|resubscrib/i },
  { metric: "new-customers", words: /\bnew customers?|first[- ]time buyers?|acquire\b/i },
  { metric: "roas", words: /\broas|return on ad spend\b/i },
  { metric: "contribution-margin", words: /\bcontribution margin|profit(ability)?\b/i },
  { metric: "revenue", words: /\brevenue|sales|top line|gmv\b/i },
];

function parseAmountINR(raw: string): number | null {
  // Matches "₹1,200", "1200", "1.2L", "₹1.5 lakh", "2 cr"
  const m = raw.match(/₹?\s*([\d,]+(?:\.\d+)?)\s*(l(?:akh)?|cr(?:ore)?|k)?/i);
  if (!m) return null;
  const base = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("l")) return base * 100_000;
  if (unit.startsWith("cr")) return base * 10_000_000;
  if (unit === "k") return base * 1_000;
  return base;
}

function parseHorizonDays(text: string): number | null {
  const days = text.match(/(\d+)\s*days?/i);
  if (days) return Number(days[1]);
  const months = text.match(/(\d+)\s*months?/i);
  if (months) return Number(months[1]) * 30;
  const weeks = text.match(/(\d+)\s*weeks?/i);
  if (weeks) return Number(weeks[1]) * 7;
  if (/\bquarter\b/i.test(text)) return 90;
  if (/\bnext month\b|\bmonthly\b/i.test(text)) return 30;
  if (/\bhalf[- ]year|\bh[12]\b/i.test(text)) return 180;
  if (/\byear\b|\bannual\b/i.test(text)) return 365;
  return null;
}

/**
 * Read a free-text objective. Deterministic and inspectable — the user is shown
 * exactly what was extracted and can correct any field before continuing.
 */
export function interpretObjective(
  rawText: string,
  presetId: ObjectivePresetId,
  company: CompanyProfile,
  monthlyBudgetINR: number,
): GrowthObjective {
  const preset = presetById(presetId);
  const text = rawText.trim();
  let confidence = 0.48;
  const signals: string[] = [];

  // --- goal metric -------------------------------------------------------
  let goalMetric: GoalMetric = preset.goalMetric;
  if (text) {
    for (const { metric, words } of GOAL_KEYWORDS) {
      if (words.test(text)) {
        goalMetric = metric;
        confidence += 0.12;
        signals.push("goal metric matched explicitly");
        break;
      }
    }
  } else {
    confidence += 0.2;
    signals.push("preset objective selected");
  }
  // "profitable revenue" is revenue with a margin qualifier, not margin itself.
  if (/\bprofitab/i.test(text) && /\brevenue\b/i.test(text)) goalMetric = "revenue";

  // --- magnitude ---------------------------------------------------------
  let targetChangePct = preset.defaultChangePct;
  const pctMatch = text.match(/(?:by|of|to)?\s*(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    targetChangePct = Number(pctMatch[1]);
    if (/\b(reduce|lower|cut|decrease|bring down)\b/i.test(text) && goalMetric === "cac") {
      targetChangePct = -Math.abs(targetChangePct);
    }
    confidence += 0.1;
    signals.push("target magnitude found");
  }

  // --- horizon -----------------------------------------------------------
  const parsedHorizon = parseHorizonDays(text);
  const timeHorizonDays = parsedHorizon ?? preset.defaultHorizonDays;
  if (parsedHorizon) {
    confidence += 0.08;
    signals.push("time horizon found");
  }

  // --- constraints -------------------------------------------------------
  const constraints: ObjectiveConstraint[] = [];
  const cacCap = text.match(
    /cac\D{0,24}?(?:above|over|beyond|exceed(?:ing)?|more than|greater than|under|below|<=?|≤)\s*(₹?\s*[\d,.]+\s*(?:l(?:akh)?|cr(?:ore)?|k)?)/i,
  );
  if (cacCap) {
    const value = parseAmountINR(cacCap[1]);
    if (value) {
      constraints.push({
        id: "cac-cap",
        metric: "cac",
        operator: "<=",
        value,
        unit: "INR",
        label: `Blended CAC must stay at or below ₹${value.toLocaleString("en-IN")}`,
      });
      confidence += 0.1;
      signals.push("CAC ceiling found");
    }
  }
  const roasFloor = text.match(/roas\D{0,20}?(?:above|at least|>=?|≥)\s*([\d.]+)\s*x?/i);
  if (roasFloor) {
    constraints.push({
      id: "roas-floor",
      metric: "roas",
      operator: ">=",
      value: Number(roasFloor[1]),
      unit: "x",
      label: `Blended ROAS must stay at or above ${roasFloor[1]}x`,
    });
    confidence += 0.06;
    signals.push("ROAS floor found");
  }
  if (/\bwithout increasing (?:total )?(?:spend|budget)|within (?:the )?current budget|same budget\b/i.test(text)) {
    constraints.push({
      id: "budget-fixed",
      metric: "budget",
      operator: "<=",
      value: monthlyBudgetINR,
      unit: "INR",
      label: `Total monthly budget fixed at ₹${monthlyBudgetINR.toLocaleString("en-IN")}`,
    });
    confidence += 0.04;
    signals.push("budget held flat");
  }
  if (constraints.length === 0) {
    // An objective with no constraint is the failure mode this product exists
    // to prevent, so GrowthOS proposes one rather than proceeding silently.
    const suggested = Math.round((company.aovINR * (company.grossMarginPct / 100) * 1.15) / 10) * 10;
    constraints.push({
      id: "cac-cap-suggested",
      metric: "cac",
      operator: "<=",
      value: suggested,
      unit: "INR",
      label: `Blended CAC must stay at or below ₹${suggested.toLocaleString("en-IN")} (proposed by GrowthOS — edit or remove)`,
    });
    signals.push("no constraint stated; a break-even CAC ceiling was proposed");
  }

  const metricLabel: Record<GoalMetric, string> = {
    revenue: "Revenue",
    "new-customers": "New customers",
    roas: "Blended ROAS",
    cac: "Blended CAC",
    "repeat-rate": "Repeat purchase rate",
    "contribution-margin": "Contribution margin",
  };

  const direction = targetChangePct >= 0 ? "+" : "";
  const interpretation = `${metricLabel[goalMetric]} ${direction}${targetChangePct}% over ${timeHorizonDays} days, at ₹${monthlyBudgetINR.toLocaleString("en-IN")}/month, subject to ${constraints.length} constraint${constraints.length === 1 ? "" : "s"}. Read from: ${signals.join("; ") || "defaults"}.`;

  return {
    presetId,
    rawText: text || preset.template,
    goalMetric,
    targetChangePct,
    timeHorizonDays,
    monthlyBudgetINR,
    constraints,
    interpretation,
    interpretationConfidence: clamp(confidence, 0.35, 0.96),
    confirmed: false,
  };
}

export function objectiveHeadline(objective: GrowthObjective): string {
  const metricLabel: Record<GoalMetric, string> = {
    revenue: "revenue",
    "new-customers": "new customers",
    roas: "ROAS",
    cac: "CAC",
    "repeat-rate": "repeat rate",
    "contribution-margin": "contribution margin",
  };
  const sign = objective.targetChangePct >= 0 ? "+" : "";
  return `${metricLabel[objective.goalMetric]} ${sign}${objective.targetChangePct}% in ${objective.timeHorizonDays} days`;
}
