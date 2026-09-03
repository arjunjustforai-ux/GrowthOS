import type {
  CreativeAsset,
  GuardrailCategory,
  GuardrailFinding,
  GuardrailReport,
  GuardrailSeverity,
} from "@/lib/types";
import { slugId } from "./math";

/**
 * Stage 8 — Guardrail Critic.
 *
 * Rule-based on purpose. A marketing lead who is about to put their name on a
 * claim needs to know exactly which rule fired and why, and a rule engine can
 * answer that question the same way every time. Each finding carries its rule
 * id, the literal text that tripped it, and a concrete replacement — never a
 * silent rewrite.
 *
 * Nothing here is legal advice, and the UI says so. It is a first-pass check
 * that stops the obvious problems reaching a founder or a platform reviewer.
 */

interface GuardrailRule {
  id: string;
  category: GuardrailCategory;
  categoryLabel: string;
  severity: GuardrailSeverity;
  pattern: RegExp;
  reason: string;
  /** Builds the suggested replacement for the matched fragment. */
  fix: (match: string) => string;
}

const RULES: GuardrailRule[] = [
  {
    id: "HC-01",
    category: "health-claim",
    categoryLabel: "Health claim",
    severity: "warning",
    pattern:
      /\b(clinically|dermatologically|scientifically)\s+(proven|tested|validated)\b[^.!?]*/gi,
    reason:
      "States a clinical or scientific proof claim. Under ASCI's code an efficacy claim of this kind needs substantiation on file, and no supporting study was supplied with this context.",
    fix: () => "Designed to support clearer-looking skin",
  },
  {
    id: "HC-02",
    category: "health-claim",
    categoryLabel: "Health claim",
    severity: "warning",
    pattern: /\b(cure|cures|eliminate|eliminates|removes?|treats?|heals?)\s+(acne|eczema|psoriasis|scars?|pigmentation|dandruff|hair fall|wrinkles)\b/gi,
    reason:
      "Claims to treat or eliminate a skin or medical condition. Cosmetic products cannot make therapeutic claims without a drug licence.",
    // Keep the condition the copy was talking about, so the replacement reads
    // as a sentence rather than as a fragment dropped into one.
    fix: (m) => `help improve the appearance of ${m.split(/\s+/).slice(1).join(" ")}`,
  },
  {
    id: "HC-03",
    category: "health-claim",
    categoryLabel: "Health claim",
    severity: "warning",
    pattern: /\b(chemical[- ]free|100%\s*(natural|safe|chemical[- ]free)|toxin[- ]free)\b/gi,
    reason:
      "Absolute safety and purity claims of this kind are not substantiable and are routinely challenged.",
    fix: () => "formulated without parabens and sulphates",
  },
  {
    id: "UP-01",
    category: "unsupported-performance-claim",
    categoryLabel: "Unsupported performance claim",
    severity: "warning",
    pattern: /\b(guaranteed|guarantee[sd]?)\s+(results?|outcomes?|growth|sales|returns?)\b[^.!?]*/gi,
    reason:
      "Guarantees an outcome the brand cannot control. No performance guarantee was recorded in the company context.",
    fix: () => "Results vary from person to person",
  },
  {
    id: "UP-02",
    category: "unsupported-performance-claim",
    categoryLabel: "Unsupported performance claim",
    severity: "warning",
    pattern: /\b(no\.?\s*1|number one|#1|best[- ]selling|india'?s (?:largest|best|top))\b/gi,
    reason:
      "Superlative market-position claim. Requires a cited, dated third-party source next to the claim.",
    fix: () => "most reordered",
  },
  {
    id: "UP-03",
    category: "unsupported-performance-claim",
    categoryLabel: "Unsupported performance claim",
    severity: "warning",
    pattern: /\b(thousands|millions|lakhs?|crores?)\s+of\s+(customers?|users?|people)\b[^.!?]*\b(completely|fully|entirely)\b[^.!?]*/gi,
    reason:
      "Aggregate testimonial framed as a universal result. Typical results must be described, not the best case.",
    fix: () => "many customers tell us they have seen a difference",
  },
  {
    id: "MC-01",
    category: "misleading-claim",
    categoryLabel: "Misleading claim",
    severity: "warning",
    pattern: /\b(instant(?:ly)?|overnight|in\s*(?:24|48)\s*hours?)\s+(results?|transformation|glow|fix)\b/gi,
    reason: "Implies a speed of result that the product's own evidence does not support.",
    fix: () => "visible over consistent use",
  },
  {
    id: "FC-01",
    category: "financial-claim",
    categoryLabel: "Financial claim",
    severity: "block",
    pattern: /\b(risk[- ]free|assured returns?|double your money|guaranteed savings? of)\b/gi,
    reason:
      "Financial guarantee language. This cannot be published without regulatory review and is blocked rather than flagged.",
    fix: () => "with a 14-day return window",
  },
  {
    id: "DT-01",
    category: "discriminatory-targeting",
    categoryLabel: "Discriminatory targeting",
    severity: "block",
    pattern: /\b(fair(?:er)?\s+skin|skin\s+whitening|gora|complexion\s+improvement|only\s+for\s+(?:men|women)\b)/gi,
    reason:
      "Targets or promises change to a protected or sensitive personal attribute. Blocked outright — this is not an override-with-a-reason case.",
    fix: () => "all skin tones",
  },
  {
    id: "SA-01",
    category: "sensitive-attributes",
    categoryLabel: "Sensitive attributes",
    severity: "warning",
    pattern: /\b(overweight|obese|insecure|ugly|flawed|ashamed)\b/gi,
    reason:
      "Uses a body-image or self-worth framing. Platform policy restricts ads that imply a personal deficiency.",
    fix: () => "comfortable",
  },
  {
    id: "UL-01",
    category: "unsafe-language",
    categoryLabel: "Unsafe language",
    severity: "warning",
    pattern: /\b(hurry|last chance|only\s+\d+\s+left|before it'?s too late|don'?t miss out)\b/gi,
    reason:
      "Artificial-urgency language. Permitted only when the scarcity is real and verifiable at the time of serving.",
    fix: () => "while stock lasts",
  },
  {
    id: "RG-01",
    category: "regulatory-risk",
    categoryLabel: "Regulatory risk",
    severity: "warning",
    pattern: /\b(fda[- ]approved|who[- ]approved|iso[- ]certified)\b/gi,
    reason:
      "Names a regulator or standards body as an endorsement. Requires the certificate number displayed alongside.",
    fix: () => "manufactured in a licensed facility",
  },
  {
    id: "MD-01",
    category: "missing-disclaimer",
    categoryLabel: "Missing disclaimer",
    severity: "warning",
    pattern: /\b(free\s+(?:delivery|shipping|exchange)s?)\b(?![^.!?]*(?:over|above|₹|within|terms))/gi,
    reason:
      "An unconditional offer with no stated threshold or window. The qualifying condition has to appear with the offer.",
    fix: (m) => `${m} over ₹999`,
  },
  {
    id: "BS-01",
    category: "brand-safety",
    categoryLabel: "Brand safety",
    severity: "warning",
    pattern: /\b(better than|beats|destroys|crushes)\s+(?:any\s+)?(?:other\s+)?(?:brand|competitor)\b/gi,
    reason: "Direct disparaging comparison without a substantiated basis for the comparison.",
    fix: () => "different from what you have tried",
  },
];

/** Tone check: a retention message that suddenly shouts is a real tell. */
function toneFindings(creative: CreativeAsset): GuardrailFinding[] {
  const out: GuardrailFinding[] = [];
  const shouty = /\b[A-Z]{4,}\b/.exec(creative.body);
  const exclamations = (creative.body.match(/!/g) ?? []).length;
  if (creative.channelId === "retention" && (shouty || exclamations >= 2)) {
    out.push(
      finding(creative, "body", shouty?.[0] ?? "!!", {
        id: "TI-01",
        category: "tone-inconsistency",
        categoryLabel: "Tone inconsistency",
        severity: "warning",
        reason:
          "Lifecycle messaging to an existing customer is using promotional intensity that does not match the rest of the brand's owned communication.",
        fix: () => "",
        pattern: /x/,
      }),
    );
  }
  return out;
}

function finding(
  creative: CreativeAsset,
  field: GuardrailFinding["field"],
  detected: string,
  rule: GuardrailRule,
): GuardrailFinding {
  return {
    id: slugId("gf", creative.id, rule.id, field),
    creativeId: creative.id,
    creativeLabel: `${creative.channelLabel} — ${creative.format}`,
    category: rule.category,
    categoryLabel: rule.categoryLabel,
    severity: rule.severity,
    detectedText: detected.trim(),
    field,
    reason: rule.reason,
    suggestedCorrection: rule.fix(detected.trim()),
    ruleId: rule.id,
    resolution: "unresolved",
  };
}

export function reviewCreative(creative: CreativeAsset): GuardrailFinding[] {
  const found: GuardrailFinding[] = [];
  const fields: { key: GuardrailFinding["field"]; text: string }[] = [
    { key: "headline", text: creative.headline },
    { key: "body", text: creative.body },
    { key: "cta", text: creative.cta },
  ];

  for (const rule of RULES) {
    for (const { key, text } of fields) {
      // Fresh regex per use: the shared literals carry the /g flag and would
      // otherwise share lastIndex across fields.
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      const match = re.exec(text);
      if (match) found.push(finding(creative, key, match[0], rule));
    }
  }
  found.push(...toneFindings(creative));

  // One finding per rule per creative, blocks first.
  const seen = new Set<string>();
  return found
    .filter((f) => {
      const key = `${f.ruleId}:${f.creativeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.severity === "block" ? -1 : b.severity === "block" ? 1 : 0));
}

export function reviewCreatives(creatives: CreativeAsset[]): GuardrailReport {
  const findings = creatives.flatMap(reviewCreative);
  const flagged = new Set(findings.map((f) => f.creativeId));
  return {
    findings,
    checkedCreatives: creatives.length,
    passCount: creatives.length - flagged.size,
    warningCount: findings.filter((f) => f.severity === "warning").length,
    blockCount: findings.filter((f) => f.severity === "block").length,
    firstPassRate:
      creatives.length === 0
        ? 1
        : Number(((creatives.length - flagged.size) / creatives.length).toFixed(3)),
  };
}

/**
 * Apply a suggested fix to the creative text. Returns the new value for the
 * flagged field — the caller decides whether to store it, so the user's accept
 * step stays explicit.
 */
export function applyFix(creative: CreativeAsset, f: GuardrailFinding): string {
  const current =
    f.field === "headline" ? creative.headline : f.field === "body" ? creative.body : creative.cta;
  if (!f.detectedText) return current;
  const replaced = current.replace(f.detectedText, f.suggestedCorrection);
  if (replaced === current) return current;
  // Keep sentence casing sane after a mid-sentence replacement.
  return replaced.replace(/^\s*([a-z])/, (_, c: string) => c.toUpperCase());
}

export const GUARDRAIL_CATEGORIES: { id: GuardrailCategory; label: string }[] = [
  { id: "misleading-claim", label: "Misleading claims" },
  { id: "unsupported-performance-claim", label: "Unsupported performance claims" },
  { id: "financial-claim", label: "Financial claims" },
  { id: "health-claim", label: "Health claims" },
  { id: "discriminatory-targeting", label: "Discriminatory targeting" },
  { id: "sensitive-attributes", label: "Sensitive attributes" },
  { id: "brand-safety", label: "Brand safety" },
  { id: "unsafe-language", label: "Unsafe language" },
  { id: "regulatory-risk", label: "Regulatory / compliance risk" },
  { id: "missing-disclaimer", label: "Missing disclaimers" },
  { id: "tone-inconsistency", label: "Tone inconsistency" },
];

export const GUARDRAIL_DISCLAIMER =
  "Guardrail review is an automated first-pass check against common advertising and platform rules. It is not legal advice and does not replace your own compliance sign-off.";
