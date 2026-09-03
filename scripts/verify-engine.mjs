/**
 * Engine verification — the five product test scenarios from the brief, run
 * against the real engine with no browser and no network.
 *
 *   npm run verify
 *
 * These are assertions about product behaviour, not unit tests of arithmetic.
 * If one of them fails, the demo will not tell the story it is supposed to.
 */
import { AURA_SKINCARE, cloneCompany } from "@/lib/demo/companies.ts";
import { accountMetrics, assessCompleteness } from "@/lib/engine/context.ts";
import { interpretObjective } from "@/lib/engine/objective.ts";
import { runPipeline, stageBlockedReason } from "@/lib/engine/pipeline.ts";
import { reflowShares, recomputeAllocation } from "@/lib/engine/budget.ts";
import { buildOutcome } from "@/lib/engine/outcome.ts";

let failures = 0;
const results = [];

function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(title) {
  results.push("", `── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}

const company = cloneCompany(AURA_SKINCARE);
const BUDGET = 600_000;

const objectiveFor = (text, preset) =>
  interpretObjective(text, preset, company, BUDGET);

const PROFITABLE = objectiveFor(
  "Grow monthly revenue by 20% over the next quarter without increasing blended CAC above ₹1,200.",
  "profitable-revenue",
);
const NEW_CUSTOMERS = objectiveFor(
  "Acquire 30% more new customers over the next 90 days within the current budget.",
  "new-customers",
);

/* ---------------------------------------------------------------- context */
section("Company context");
const completeness = assessCompleteness(company);
const metrics = accountMetrics(company);
check(
  "Aura Skincare reads as 82% complete with two named gaps",
  completeness.scorePct === 82 && completeness.missing.length === 2,
  `${completeness.scorePct}%, missing: ${completeness.missing.map((m) => m.label).join(", ")}`,
);
check(
  "Missing context costs confidence rather than blocking",
  completeness.confidencePenaltyPct > 0,
  `${completeness.confidencePenaltyPct} pts`,
);
check("Blended CAC is derived from acquisition channels only", metrics.blendedCacINR === 1070,
  `₹${metrics.blendedCacINR}`);

/* ------------------------------------------------------- objective parsing */
section("Objective interpretation");
check(
  "Natural language yields goal, horizon and constraint",
  PROFITABLE.goalMetric === "revenue" &&
    PROFITABLE.targetChangePct === 20 &&
    PROFITABLE.timeHorizonDays === 90 &&
    PROFITABLE.constraints.some((c) => c.metric === "cac" && c.value === 1200),
  `${PROFITABLE.goalMetric} +${PROFITABLE.targetChangePct}% / ${PROFITABLE.timeHorizonDays}d / ${PROFITABLE.constraints.map((c) => c.label).join("; ")}`,
);

/* ------------------------------------------------- TEST 1 — sensitivity */
section("TEST 1 — Objective sensitivity");
const profitableRun = runPipeline(company, PROFITABLE, []);
const newCustomersRun = runPipeline(company, NEW_CUSTOMERS, []);

const profitableTop = profitableRun.segmentRecommendations[0];
const newCustomersTop = newCustomersRun.segmentRecommendations[0];
check(
  "Profitable-revenue ranks the repeat base first",
  profitableTop.segment.id === "aura-repeat",
  profitableTop.segment.name,
);
check(
  "Switching to new-customer volume changes the top segment",
  newCustomersTop.segment.id !== profitableTop.segment.id,
  `${profitableTop.segment.name} → ${newCustomersTop.segment.name}`,
);
const shares = (run) =>
  run.recommendedAllocation.lines.map((l) => `${l.channelName} ${l.sharePct}%`).join(" / ");
check(
  "The channel mix moves with the objective too",
  shares(profitableRun) !== shares(newCustomersRun),
  `${shares(profitableRun)}  vs  ${shares(newCustomersRun)}`,
);
check(
  "GrowthOS explains why, in the reasoning trace",
  profitableRun.strategy.reasoning.every(
    (n) => n.input && n.interpretation && n.decision && n.wouldChangeIf.length > 0,
  ),
  `${profitableRun.strategy.reasoning.length} nodes, all with input/interpretation/decision/wouldChangeIf`,
);
check(
  "A channel below the contribution floor is excluded, not given a token share",
  profitableRun.channelScores.some((c) => !c.funded && c.sharePct === 0),
  profitableRun.channelScores.filter((c) => !c.funded).map((c) => c.channel.name).join(", ") || "none",
);
check(
  "Demo allocation lands on the briefed 50 / 30 / 20 split",
  shares(profitableRun) === "Meta Ads 50% / Google Ads 30% / Retention / CRM 20%",
  shares(profitableRun),
);

/* ------------------------------------------------- TEST 2 — human override */
section("TEST 2 — Human override");
const run = runPipeline(company, PROFITABLE, ["aura-repeat"]);
const rec = run.recommendedAllocation;
const edited = reflowShares(rec.lines, "meta", 65);
const editedAllocation = recomputeAllocation(
  edited,
  rec,
  run.company,
  PROFITABLE,
  run.segmentRecommendations.slice(0, 1),
  BUDGET,
  run.strategy.confidence,
);
check("Shares still sum to exactly 100 after a reflow",
  edited.reduce((a, l) => a + l.sharePct, 0) === 100,
  edited.map((l) => `${l.channelName} ${l.sharePct}%`).join(" / "));
check(
  "Pushing Meta to 65% raises the projected blended CAC",
  editedAllocation.impact.projectedBlendedCacINR > rec.impact.projectedBlendedCacINR,
  `₹${rec.impact.projectedBlendedCacINR} → ₹${editedAllocation.impact.projectedBlendedCacINR}`,
);
check(
  "…and lowers confidence",
  editedAllocation.impact.confidence < rec.impact.confidence,
  `${Math.round(rec.impact.confidence * 100)}% → ${Math.round(editedAllocation.impact.confidence * 100)}%`,
);
check(
  "…and is recorded as a deviation from the recommendation",
  editedAllocation.impact.deviationFromRecommendationPts > 0,
  `${editedAllocation.impact.deviationFromRecommendationPts} pts, risk ${editedAllocation.impact.riskLevel}`,
);

/* ----------------------------------------------------- TEST 3 — guardrail */
section("TEST 3 — Guardrail");
const report = run.guardrailReport;
const healthFinding = report.findings.find((f) => f.category === "health-claim");
check("At least three creative concepts are generated", run.creatives.length >= 3,
  `${run.creatives.length}: ${run.creatives.map((c) => c.channelLabel).join(", ")}`);
check(
  "The guardrail critic catches an unsupported health claim",
  Boolean(healthFinding),
  healthFinding ? `${healthFinding.ruleId}: "${healthFinding.detectedText}"` : "no health-claim finding",
);
check(
  "…with a reason and a concrete suggested revision",
  Boolean(healthFinding?.reason && healthFinding?.suggestedCorrection),
  healthFinding ? `→ "${healthFinding.suggestedCorrection}"` : "",
);

/* ------------------------------------------------------ TEST 4 — approval */
section("TEST 4 — Approval is required before the outcome range");
const unapproved = {
  company: run.company,
  objective: PROFITABLE,
  selectedSegmentIds: ["aura-repeat"],
  strategy: run.strategy,
  segmentRecommendations: run.segmentRecommendations,
  finalAllocation: rec,
  recommendedAllocation: rec,
  creatives: run.creatives,
  guardrailReport: report,
  approval: null,
  completedStages: [],
};
check(
  "The outcome stage is blocked without an approval record",
  stageBlockedReason(unapproved, "outcome") !== null,
  stageBlockedReason(unapproved, "outcome") ?? "",
);
check(
  "The outcome stage opens once a person has approved",
  stageBlockedReason({ ...unapproved, approval: { approvedBy: "Demo User" } }, "outcome") === null,
);

/* --------------------------------------------------- TEST 5 — uncertainty */
section("TEST 5 — Uncertainty is communicated as a range");
const outcome = buildOutcome(
  run.company,
  PROFITABLE,
  run.strategy,
  run.segmentRecommendations.slice(0, 1),
  rec,
  rec,
);
check(
  "The outcome is a band, not a point",
  outcome.lowINR < outcome.baseLowINR &&
    outcome.baseLowINR < outcome.baseHighINR &&
    outcome.baseHighINR < outcome.highINR,
  `₹${outcome.lowINR} / ₹${outcome.baseLowINR}–₹${outcome.baseHighINR} / ₹${outcome.highINR}`,
);
check("It carries a confidence band", Boolean(outcome.confidenceBand),
  `${Math.round(outcome.confidence * 100)}% ${outcome.confidenceBand}`);
check("At least three assumptions are stated", outcome.assumptions.length >= 3,
  `${outcome.assumptions.length}`);
check("At least three uncertainty drivers are stated", outcome.uncertaintyDrivers.length >= 3,
  `${outcome.uncertaintyDrivers.length}`);
check("“What would make this wrong” is populated", outcome.whatWouldMakeThisWrong.length >= 3,
  `${outcome.whatWouldMakeThisWrong.length} items`);
check(
  "The upper bound is never described as potential revenue",
  /upper scenario/i.test(outcome.upperBoundCaveat) &&
    /not potential revenue/i.test(outcome.upperBoundCaveat),
  outcome.upperBoundCaveat,
);
check("A historical basis is cited", outcome.historicalBasis.length > 40);

/* ---------------------------------------------------- determinism */
section("Reproducibility");
const again = runPipeline(company, PROFITABLE, ["aura-repeat"]);
check(
  "The same inputs produce byte-identical output",
  JSON.stringify(again.strategy) === JSON.stringify(run.strategy) &&
    JSON.stringify(again.recommendedAllocation) === JSON.stringify(run.recommendedAllocation),
);

console.log(results.join("\n"));
console.log(
  `\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`,
);
process.exit(failures === 0 ? 0 : 1);
