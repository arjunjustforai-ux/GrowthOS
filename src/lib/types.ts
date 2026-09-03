/**
 * GrowthOS data model.
 *
 * Every recommendation the product makes is a value of one of these types, and
 * every one of them carries its own provenance and confidence. That is the
 * whole point of the product: the user has to be able to interrogate any number
 * on any screen and find out where it came from.
 */

/* -------------------------------------------------------------------------- */
/* Provenance                                                                  */
/* -------------------------------------------------------------------------- */

/** Where a single field's value came from. Surfaced in the UI, never hidden. */
export type FieldSource = "user" | "inferred" | "demo";

export type Confidence = number; // 0..1

export type ConfidenceBand = "low" | "moderate" | "high";

/* -------------------------------------------------------------------------- */
/* Company                                                                     */
/* -------------------------------------------------------------------------- */

export type BusinessModel =
  | "d2c-ecommerce"
  | "subscription"
  | "marketplace"
  | "omnichannel-retail"
  | "services";

export type ChannelId = "meta" | "google" | "retention" | "influencer";

export type ChannelRole =
  | "demand-generation"
  | "intent-capture"
  | "repeat-conversion"
  | "brand-amplification";

export interface ChannelPerformance {
  id: ChannelId;
  name: string;
  role: ChannelRole;
  /** Current monthly spend on this channel, INR. */
  monthlySpendINR: number;
  /** Blended cost to acquire one customer through this channel, INR. */
  cacINR: number;
  roas: number;
  conversionRatePct: number;
  /**
   * Share of available auctions already being won, 0-100. High impression share
   * means there is little scalable demand left, whatever the ROAS says.
   */
  impressionSharePct: number;
  /**
   * How much extra spend the channel can absorb before efficiency degrades,
   * 0..1. Derived from impression share and category dynamics.
   */
  headroom: number;
  /**
   * How steeply CAC rises as spend grows. 0 = perfectly scalable,
   * 1 = every extra rupee is wasted. Used by the budget impact model.
   */
  costElasticity: number;
  /** Confidence in this channel's data quality, 0..1. */
  dataConfidence: Confidence;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  estimatedSize: number;
  /** Historical cost to acquire (or reactivate) a customer in this segment. */
  historicalCacINR: number;
  repeatRatePct: number;
  aovINR: number;
  grossMarginPct: number;
  /** Likelihood this segment converts when reached, 0..1. */
  conversionPropensity: number;
  /** How addressable the segment is with the current channel mix, 0..1. */
  reachability: number;
  /** Per-channel affinity, 0..1. Drives channel/audience fit scoring. */
  channelAffinity: Partial<Record<ChannelId, number>>;
  dataConfidence: Confidence;
  /** True for reactivation segments, where "CAC" is a reactivation cost. */
  isReactivation?: boolean;
}

export interface CampaignHistoryEntry {
  month: string;
  spendINR: number;
  revenueINR: number;
  blendedCacINR: number;
  roas: number;
  note?: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  industry: string;
  businessModel: BusinessModel;
  annualRevenueINR: number;
  monthlyPaidSpendINR: number;
  aovINR: number;
  grossMarginPct: number;
  repeatPurchaseRatePct: number;
  primarySalesChannel: string;
  geography: string;
  marketingTeamSize: number;
  channels: ChannelPerformance[];
  segments: CustomerSegment[];
  campaignHistory: CampaignHistoryEntry[];
  /** Field-level provenance. Any key absent here is treated as "inferred". */
  fieldSources: Record<string, FieldSource>;
  /** True for the three seeded demo brands. Always labelled in the UI. */
  isDemo: boolean;
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Context completeness                                                        */
/* -------------------------------------------------------------------------- */

export interface MissingDataItem {
  field: string;
  label: string;
  /** Percentage points of confidence lost by not having this. */
  confidenceCostPct: number;
  why: string;
}

export interface ContextCompleteness {
  scorePct: number;
  missing: MissingDataItem[];
  /** Total confidence penalty, expressed in percentage points. */
  confidencePenaltyPct: number;
  providedCount: number;
  inferredCount: number;
  totalFields: number;
}

/* -------------------------------------------------------------------------- */
/* Objective                                                                   */
/* -------------------------------------------------------------------------- */

export type ObjectivePresetId =
  | "profitable-revenue"
  | "new-customers"
  | "improve-roas"
  | "reduce-cac"
  | "grow-repeat"
  | "launch-product"
  | "expand-category"
  | "custom";

export type GoalMetric =
  | "revenue"
  | "new-customers"
  | "roas"
  | "cac"
  | "repeat-rate"
  | "contribution-margin";

export interface ObjectiveConstraint {
  id: string;
  metric: GoalMetric | "budget";
  operator: "<=" | ">=";
  value: number;
  unit: "INR" | "pct" | "x";
  label: string;
}

/**
 * The structured reading of a natural-language objective. Always shown back to
 * the user for confirmation before anything downstream runs — checkpoint 1.
 */
export interface GrowthObjective {
  presetId: ObjectivePresetId;
  rawText: string;
  goalMetric: GoalMetric;
  /** Target change in the goal metric, e.g. 20 for "+20% revenue". */
  targetChangePct: number;
  timeHorizonDays: number;
  monthlyBudgetINR: number;
  constraints: ObjectiveConstraint[];
  /** Human-readable restatement produced by the objective interpreter. */
  interpretation: string;
  /** How confident the interpreter is that it read the objective correctly. */
  interpretationConfidence: Confidence;
  /** True once the user has confirmed the interpretation (checkpoint 1). */
  confirmed: boolean;
}

/* -------------------------------------------------------------------------- */
/* Reasoning                                                                   */
/* -------------------------------------------------------------------------- */

export type ReasoningTopic =
  | "segment"
  | "channel"
  | "budget"
  | "objective"
  | "risk"
  | "creative";

/**
 * The atomic unit of the reasoning trace: one observed input, what it was
 * compared against, what GrowthOS took it to mean, and what it did about it.
 */
export interface ReasoningNode {
  id: string;
  topic: ReasoningTopic;
  /** The raw observation, e.g. "Meta CAC = INR 930". */
  input: string;
  /** What it was measured against, e.g. "14% below blended CAC". */
  comparison: string;
  interpretation: string;
  decision: string;
  confidence: Confidence;
  /** Conditions that would invalidate this node. Never empty. */
  wouldChangeIf: string[];
}

/* -------------------------------------------------------------------------- */
/* Segments                                                                    */
/* -------------------------------------------------------------------------- */

export interface SegmentScoreBreakdown {
  profitability: number;
  conversionPropensity: number;
  repeatBehaviour: number;
  reachableAudience: number;
  strategicFit: number;
}

export interface SegmentRecommendation {
  segmentId: string;
  segment: CustomerSegment;
  rank: number;
  score: number;
  breakdown: SegmentScoreBreakdown;
  /** Weights actually applied, after the objective adjusted them. */
  weights: SegmentScoreBreakdown;
  confidence: Confidence;
  confidenceBand: ConfidenceBand;
  rationale: string;
  reasoning: ReasoningNode[];
  /** Unit economics computed for this segment, shown on the card. */
  estimatedUnitContributionINR: number;
  recommended: boolean;
}

/* -------------------------------------------------------------------------- */
/* Strategy                                                                    */
/* -------------------------------------------------------------------------- */

export interface ChannelScoreBreakdown {
  historicalEfficiency: number;
  marginalScalability: number;
  objectiveAlignment: number;
  audienceFit: number;
  confidence: number;
}

export interface ChannelRoleRecommendation {
  channelId: ChannelId;
  channelName: string;
  role: ChannelRole;
  roleLabel: string;
  sharePct: number;
  score: number;
  breakdown: ChannelScoreBreakdown;
  rationale: string;
}

export interface StrategyRecommendation {
  headline: string;
  strategicDirection: string;
  primarySegmentId: string;
  supportingSegmentIds: string[];
  channelRoles: ChannelRoleRecommendation[];
  reasoning: ReasoningNode[];
  /** Mandatory: conditions under which this whole strategy should be revisited. */
  wouldChangeIf: string[];
  confidence: Confidence;
  confidenceBand: ConfidenceBand;
}

/* -------------------------------------------------------------------------- */
/* Budget                                                                      */
/* -------------------------------------------------------------------------- */

export interface BudgetLine {
  channelId: ChannelId;
  channelName: string;
  role: ChannelRole;
  roleLabel: string;
  sharePct: number;
  amountINR: number;
}

export interface BudgetImpact {
  projectedBlendedCacINR: number;
  projectedNewCustomers: number;
  projectedRevenueINR: number;
  projectedContributionMarginINR: number;
  projectedRoas: number;
  confidence: Confidence;
  confidenceBand: ConfidenceBand;
  /** Set when a constraint from the objective is violated. */
  constraintBreaches: string[];
  /** Sum of absolute percentage-point deviation from the AI recommendation. */
  deviationFromRecommendationPts: number;
  riskLevel: "low" | "elevated" | "high";
  concentrationWarning?: string;
}

export interface BudgetAllocation {
  totalBudgetINR: number;
  lines: BudgetLine[];
  impact: BudgetImpact;
}

/* -------------------------------------------------------------------------- */
/* Creative                                                                    */
/* -------------------------------------------------------------------------- */

export type CreativeStatus = "draft" | "approved" | "edited" | "rejected";

export interface CreativeAsset {
  id: string;
  channelId: ChannelId;
  channelLabel: string;
  format: string;
  headline: string;
  body: string;
  cta: string;
  targetSegmentId: string;
  targetSegmentName: string;
  strategicPurpose: string;
  reasoning: string;
  status: CreativeStatus;
  /** Preserved so the proposal can show what the user changed. */
  originalHeadline: string;
  originalBody: string;
  generatedBy: "deterministic" | "llm";
}

/* -------------------------------------------------------------------------- */
/* Guardrails                                                                  */
/* -------------------------------------------------------------------------- */

export type GuardrailCategory =
  | "misleading-claim"
  | "unsupported-performance-claim"
  | "financial-claim"
  | "health-claim"
  | "discriminatory-targeting"
  | "sensitive-attributes"
  | "brand-safety"
  | "unsafe-language"
  | "regulatory-risk"
  | "missing-disclaimer"
  | "tone-inconsistency";

export type GuardrailSeverity = "pass" | "warning" | "block";

export type GuardrailResolution =
  | "unresolved"
  | "fix-accepted"
  | "manually-edited"
  | "overridden";

export interface GuardrailFinding {
  id: string;
  creativeId: string;
  creativeLabel: string;
  category: GuardrailCategory;
  categoryLabel: string;
  severity: GuardrailSeverity;
  /** The exact text that tripped the rule. */
  detectedText: string;
  field: "headline" | "body" | "cta";
  reason: string;
  suggestedCorrection: string;
  /** Which rule fired — shown so the check is auditable, not magic. */
  ruleId: string;
  resolution: GuardrailResolution;
  overrideReason?: string;
  resolvedAt?: string;
}

export interface GuardrailReport {
  findings: GuardrailFinding[];
  checkedCreatives: number;
  passCount: number;
  warningCount: number;
  blockCount: number;
  /** Creatives that passed every rule on the first generation. */
  firstPassRate: number;
}

/* -------------------------------------------------------------------------- */
/* Overrides & approval                                                        */
/* -------------------------------------------------------------------------- */

export type OverrideKind =
  | "segment"
  | "budget"
  | "creative"
  | "guardrail"
  | "objective";

export interface UserOverride {
  id: string;
  kind: OverrideKind;
  summary: string;
  detail: string;
  aiValue: string;
  userValue: string;
  reason?: string;
  at: string;
}

export interface ApprovalRecord {
  approvedBy: string;
  approvedAt: string;
  version: string;
  editCount: number;
  overrideCount: number;
  acknowledgedResponsibility: true;
  note?: string;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  actor: "user" | "growthos";
  action: string;
  detail: string;
}

/* -------------------------------------------------------------------------- */
/* Outcome                                                                     */
/* -------------------------------------------------------------------------- */

export interface OutcomeScenario {
  /** Deliberately a range. GrowthOS does not publish a point forecast. */
  lowINR: number;
  baseLowINR: number;
  baseHighINR: number;
  highINR: number;
  confidence: Confidence;
  confidenceBand: ConfidenceBand;
  assumptions: string[];
  uncertaintyDrivers: string[];
  historicalBasis: string;
  whatWouldMakeThisWrong: string[];
  /** Restates that the upper bound is not an expectation. */
  upperBoundCaveat: string;
}

/* -------------------------------------------------------------------------- */
/* Proposal                                                                    */
/* -------------------------------------------------------------------------- */

export type PlanStage =
  | "context"
  | "objective"
  | "segments"
  | "strategy"
  | "budget"
  | "creative"
  | "guardrails"
  | "approval"
  | "outcome";

export type PlanStatus = "draft" | "approved" | "archived";

export interface CampaignProposal {
  id: string;
  title: string;
  cycleLabel: string;
  createdAt: string;
  updatedAt: string;
  status: PlanStatus;

  company: CompanyProfile | null;
  completeness: ContextCompleteness | null;
  objective: GrowthObjective | null;

  segmentRecommendations: SegmentRecommendation[];
  selectedSegmentIds: string[];

  strategy: StrategyRecommendation | null;

  /** What the engine proposed. Never mutated by user edits. */
  recommendedAllocation: BudgetAllocation | null;
  /** What the human actually decided. This is what gets approved. */
  finalAllocation: BudgetAllocation | null;

  creatives: CreativeAsset[];
  guardrailReport: GuardrailReport | null;
  outcome: OutcomeScenario | null;

  overrides: UserOverride[];
  auditLog: AuditLogEntry[];
  approval: ApprovalRecord | null;

  /** Stages the user has completed, used by the stepper and route guards. */
  completedStages: PlanStage[];
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

export type AnalyticsEventName =
  | "context_started"
  | "context_completed"
  | "objective_confirmed"
  | "segment_accepted"
  | "segment_overridden"
  | "reasoning_opened"
  | "budget_changed"
  | "creative_approved"
  | "guardrail_triggered"
  | "guardrail_overridden"
  | "proposal_approved"
  | "proposal_exported"
  | "outcome_panel_opened";

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  at: string;
  planId: string | null;
  props?: Record<string, string | number | boolean>;
}
