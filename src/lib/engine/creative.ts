import type {
  ChannelId,
  CompanyProfile,
  CreativeAsset,
  CustomerSegment,
  GrowthObjective,
  SegmentRecommendation,
  StrategyRecommendation,
} from "@/lib/types";
import { slugId } from "./math";

/**
 * Stage 7 — Creative Generator.
 *
 * Three concepts, not thirty. Each one is tied to a channel role and a segment,
 * and carries the reason it was written that way, so the creative review is a
 * strategy conversation rather than a taste conversation.
 *
 * A note on the copy banks below: category language for beauty and supplements
 * naturally reaches for efficacy claims, and a generator working from that
 * language will reproduce them. GrowthOS does not try to suppress that at the
 * generation step — it lets the draft say what the category says and then makes
 * the Guardrail Critic catch it in the open, where the user can see what was
 * flagged and why. Silently sanitising the draft would hide the one thing the
 * marketing lead actually needs to know before signing off.
 */

type SegmentArchetype = "repeat" | "high-intent" | "lapsed" | "generic";

function archetypeOf(segment: CustomerSegment): SegmentArchetype {
  if (segment.isReactivation) return "lapsed";
  if (segment.repeatRatePct >= 30) return "repeat";
  if (segment.conversionPropensity >= 0.55) return "high-intent";
  return "generic";
}

type CopyBankId = "beauty" | "apparel" | "food" | "generic";

function copyBankFor(company: CompanyProfile): CopyBankId {
  const s = `${company.industry} ${company.name}`.toLowerCase();
  if (/skin|beauty|cosmetic|personal care|derma|wellness/.test(s)) return "beauty";
  if (/apparel|fashion|clothing|wear|textile/.test(s)) return "apparel";
  if (/food|snack|nutrition|beverage|grocer|crave/.test(s)) return "food";
  return "generic";
}

interface CopyTemplate {
  headline: string;
  body: string;
  cta: string;
}

type Bank = Record<SegmentArchetype, CopyTemplate>;

const META_BANK: Record<CopyBankId, Bank> = {
  beauty: {
    repeat: {
      headline: "Your Skin Already Knows What Works.",
      body: "Your last routine worked. Keep the momentum going with a personalised restock bundle, built from what you already bought.",
      cta: "Rebuild my routine",
    },
    // Reads like ordinary category copy and is, apart from one sentence, fine.
    // That is the realistic failure: not a wild claim, one efficacy line that
    // slipped in because the whole category talks that way. The Guardrail
    // Critic is expected to catch it — see the note at the top of this file.
    "high-intent": {
      headline: "Clinically proven to eliminate acne in 14 days.",
      body: "A focused actives range formulated for Indian skin and Indian weather, with the full ingredient list and concentration printed on every pack.",
      cta: "Shop the range",
    },
    lapsed: {
      headline: "Three Months Is a Long Time for Your Skin.",
      body: "Routines drift. Yours is still saved — pick it back up where you left off, with the same formulas you were using.",
      cta: "Restart my routine",
    },
    generic: {
      headline: "Skincare That Earns Its Place on the Shelf.",
      body: "Formulated for Indian skin and Indian weather. No fifteen-step routine required.",
      cta: "Find my products",
    },
  },
  apparel: {
    repeat: {
      headline: "You Already Know How It Fits.",
      body: "The pieces you bought last season are back in new colourways. Same cut, same fit, nothing to re-learn.",
      cta: "See new colours",
    },
    "high-intent": {
      headline: "Workwear That Survives a Full Week.",
      body: "Breathable, structured, and made to hold its shape through the commute. Free size exchange on the first order.",
      cta: "Shop workwear",
    },
    lapsed: {
      headline: "Your Size Is Back In Stock.",
      body: "The style you were looking at has returned in your size. It usually does not stay long.",
      cta: "Check availability",
    },
    generic: {
      headline: "Made to Be Worn, Not Photographed.",
      body: "Considered basics in fabrics that hold up. Designed in India, made in limited runs.",
      cta: "Browse the collection",
    },
  },
  food: {
    repeat: {
      headline: "Running Low Already?",
      body: "You are about due for a refill. Add your usual box to a subscription and it arrives before you notice it is gone.",
      cta: "Set up my box",
    },
    "high-intent": {
      headline: "Snacks You Can Actually Read the Label On.",
      body: "No palm oil, no maida, no mystery. Six ingredients or fewer in every pack.",
      cta: "Try the sampler",
    },
    lapsed: {
      headline: "Your Pantry Misses You.",
      body: "Your last order was a while ago. Your saved box is one tap away, at the same price you paid before.",
      cta: "Reorder my box",
    },
    generic: {
      headline: "Better Snacking, Without the Lecture.",
      body: "Real ingredients, honest labels, delivered on a schedule that suits you.",
      cta: "Explore the range",
    },
  },
  generic: {
    repeat: {
      headline: "Pick Up Where You Left Off.",
      body: "Everything you bought before, ready to reorder in one tap. No hunting through the catalogue.",
      cta: "Reorder now",
    },
    "high-intent": {
      headline: "The Version You Were Comparing, Explained.",
      body: "A straight answer on what you get, what it costs, and who it is not for.",
      cta: "See the details",
    },
    lapsed: {
      headline: "Still Thinking About It?",
      body: "Your basket is saved and your details are still on file. Two taps and it is done.",
      cta: "Finish my order",
    },
    generic: {
      headline: "Built for People Who Read the Fine Print.",
      body: "Clear pricing, clear specs, and a returns policy written in plain language.",
      cta: "Take a look",
    },
  },
};

const GOOGLE_BANK: Record<CopyBankId, Bank> = {
  beauty: {
    repeat: {
      headline: "Restock Your Routine | Same Formulas, One Tap",
      body: "Reorder the exact products you already use. Free delivery over ₹999. Dermatologist-formulated actives.",
      cta: "Reorder now",
    },
    "high-intent": {
      headline: "Niacinamide & Salicylic Serums | Made for Indian Skin",
      body: "Compare actives by concern, strength and skin type. Full ingredient lists on every product page.",
      cta: "Compare serums",
    },
    lapsed: {
      headline: "Your Saved Skincare Routine | Still Available",
      body: "The routine you built is saved to your account. Restart it in one step, at your previous price.",
      cta: "View my routine",
    },
    generic: {
      headline: "Skincare for Indian Skin | Honest Ingredient Lists",
      body: "No unexplained claims. Every formulation lists what is in it and at what concentration.",
      cta: "Shop skincare",
    },
  },
  apparel: {
    repeat: {
      headline: "Your Size, Back In Stock | Same Fit as Last Time",
      body: "Reorder in the size you already own. Free exchanges within 14 days.",
      cta: "Shop your size",
    },
    "high-intent": {
      headline: "Formal & Semi-Formal Basics | Free Size Exchange",
      body: "Structured shirts and trousers in breathable fabric. Detailed size chart on every product.",
      cta: "Shop workwear",
    },
    lapsed: {
      headline: "The Piece You Viewed | Restocked",
      body: "Back in your size after a long wait. Limited run, ships in 48 hours.",
      cta: "Check stock",
    },
    generic: {
      headline: "Considered Basics | Designed and Made in India",
      body: "Limited runs, honest fabric composition, and a returns policy you can read in one minute.",
      cta: "Browse now",
    },
  },
  food: {
    repeat: {
      headline: "Refill Your Snack Box | Subscribe & Save 15%",
      body: "Your usual box on a schedule. Pause or skip any delivery, no penalty.",
      cta: "Set up delivery",
    },
    "high-intent": {
      headline: "Clean-Label Snacks | Six Ingredients or Fewer",
      body: "No palm oil, no maida. Full nutrition panel on every pack. Sampler box available.",
      cta: "Try a sampler",
    },
    lapsed: {
      headline: "Your Saved Snack Box | One Tap to Reorder",
      body: "Everything from your last order, at the price you paid. Delivered in 48 hours.",
      cta: "Reorder box",
    },
    generic: {
      headline: "Honest Packaged Snacks | Delivered Nationwide",
      body: "Real ingredients and clear labels. Subscribe for a standing order or buy once.",
      cta: "Shop snacks",
    },
  },
  generic: {
    repeat: {
      headline: "Reorder in One Tap | Your Previous Order Saved",
      body: "Everything you bought before, ready to send again. Free delivery on repeat orders.",
      cta: "Reorder now",
    },
    "high-intent": {
      headline: "Compare Before You Buy | Clear Specs, Clear Pricing",
      body: "Side-by-side comparison, full specifications, and no hidden charges at checkout.",
      cta: "Compare options",
    },
    lapsed: {
      headline: "Your Basket Is Still Saved | Finish in Two Taps",
      body: "Your details are on file. Complete the order you started, at the same price.",
      cta: "Complete order",
    },
    generic: {
      headline: "Straightforward Products | Plain-Language Policies",
      body: "What it costs, what it does, and who it is not for. Stated up front.",
      cta: "Learn more",
    },
  },
};

const RETENTION_BANK: Record<CopyBankId, Bank> = {
  beauty: {
    repeat: {
      headline: "Your restock window is open",
      body: "Based on your last order, you are about two weeks from running out. Your exact routine is saved — reorder it in one tap, or adjust anything before you confirm.",
      cta: "Reorder my routine",
    },
    "high-intent": {
      headline: "Still deciding? Here is the honest version",
      body: "We put together a short guide on which actives suit which concerns, including the ones we would not recommend for your skin type.",
      cta: "Read the guide",
    },
    lapsed: {
      headline: "Picking your routine back up",
      body: "It has been a few months. Skin changes in that time, so we saved your old routine and added one note on what we would change now.",
      cta: "See my routine",
    },
    generic: {
      headline: "A quick note on your routine",
      body: "Your saved products are still available, and your delivery details are unchanged.",
      cta: "View my account",
    },
  },
  apparel: {
    repeat: {
      headline: "New colourways in the fit you already own",
      body: "The cut you bought last season is back in three new colours. Same measurements, so there is nothing to work out.",
      cta: "See new colours",
    },
    "high-intent": {
      headline: "The size guide, in plain numbers",
      body: "Actual garment measurements rather than S/M/L, so you can compare against something you already own.",
      cta: "Open size guide",
    },
    lapsed: {
      headline: "Back in your size",
      body: "The piece you were looking at has returned in your size. Limited run, and it went quickly last time.",
      cta: "Check availability",
    },
    generic: {
      headline: "Your saved items",
      body: "Still available, still in your size, still at the price you saw.",
      cta: "View saved items",
    },
  },
  food: {
    repeat: {
      headline: "Time for a refill",
      body: "Going by your last order you have about a week left. Turn it into a standing delivery and skip any month you do not need it.",
      cta: "Set up my box",
    },
    "high-intent": {
      headline: "Try three, keep what you like",
      body: "A sampler with three of our most-reordered packs, so you are not committing to a full box on a guess.",
      cta: "Order a sampler",
    },
    lapsed: {
      headline: "Your box is still saved",
      body: "Same contents, same price as your last order. Two new flavours have been added since you were last here.",
      cta: "Reorder my box",
    },
    generic: {
      headline: "A quick note from us",
      body: "Your saved box is ready whenever you are, and your delivery details are unchanged.",
      cta: "View my box",
    },
  },
  generic: {
    repeat: {
      headline: "Ready when you are",
      body: "Your previous order is saved and can be sent again in one tap. Nothing to re-enter.",
      cta: "Reorder now",
    },
    "high-intent": {
      headline: "The information you were looking for",
      body: "A short summary of what you get, what it costs, and the cases it is not right for.",
      cta: "Read it",
    },
    lapsed: {
      headline: "Your basket is still here",
      body: "Saved with your details. Finish whenever suits you — nothing expires.",
      cta: "Finish my order",
    },
    generic: {
      headline: "A quick update on your account",
      body: "Your saved items and delivery details are unchanged.",
      cta: "View account",
    },
  },
};

const CHANNEL_META: Record<
  ChannelId,
  { label: string; format: string; bank: Record<CopyBankId, Bank> }
> = {
  meta: { label: "Meta / Instagram", format: "Feed + Stories, single image", bank: META_BANK },
  google: { label: "Google Search", format: "Responsive search ad", bank: GOOGLE_BANK },
  retention: { label: "Retention", format: "Email + WhatsApp", bank: RETENTION_BANK },
  influencer: { label: "Influencer", format: "Creator brief", bank: META_BANK },
};

function purposeFor(
  channelId: ChannelId,
  objective: GrowthObjective | null,
  segment: CustomerSegment,
): string {
  const goal = objective?.goalMetric ?? "revenue";
  switch (channelId) {
    case "meta":
      return goal === "new-customers"
        ? `Generate first-touch demand among ${segment.name.toLowerCase()} at the top of the funnel.`
        : `Carry the largest share of efficient acquisition against ${segment.name.toLowerCase()}.`;
    case "google":
      return `Capture existing intent from ${segment.name.toLowerCase()} at the moment of search.`;
    case "retention":
      return `Convert the second and third order from ${segment.name.toLowerCase()}, where contribution margin is highest.`;
    default:
      return `Support the wider plan against ${segment.name.toLowerCase()}.`;
  }
}

function reasoningFor(
  channelId: ChannelId,
  segment: CustomerSegment,
  company: CompanyProfile,
): string {
  const arch = archetypeOf(segment);
  switch (channelId) {
    case "retention":
      return `Leads with timing and familiarity rather than discounting, because this segment already has product affinity — a discount here would cost margin on an order that was likely to happen anyway.`;
    case "google":
      return `Written against search intent rather than brand language. The user has already stated the problem in the query, so the ad states the specification, not the story.`;
    default:
      return arch === "repeat"
        ? `Uses product familiarity rather than a discount, because repeat buyers in this account already show strong product affinity and respond to continuity over price.`
        : arch === "lapsed"
          ? `Leads with the saved routine rather than a win-back offer, because the reactivation cost is already low and a discount would erode the margin advantage that made this segment worth targeting.`
          : `Leads with product proof for a first-time audience at ${company.name}, since this segment converts on evidence rather than on price.`;
  }
}

/**
 * Which audience a channel should actually speak to.
 *
 * The selected segment sets the plan's priority, but it does not follow that
 * every channel talks to it. Demand generation exists to reach people who are
 * not customers yet: pointing a prospecting ad at the repeat base would be a
 * retargeting ad wearing the wrong label, and it would waste the budget the
 * strategy just assigned to acquisition. So when the priority segment is a
 * repeat or lapsed audience, the demand-generation concept addresses the
 * strongest prospectable segment in the account instead, and says so in its
 * strategic purpose.
 */
function audienceForChannel(
  channelId: ChannelId,
  selected: SegmentRecommendation[],
  all: SegmentRecommendation[],
): { segment: CustomerSegment; borrowed: boolean } {
  const primary = selected[0]!.segment;
  const prospectable = (s: SegmentRecommendation) =>
    !s.segment.isReactivation && s.segment.repeatRatePct < 30;

  if (channelId === "retention") {
    const best = [...selected].sort(
      (a, b) => b.segment.repeatRatePct - a.segment.repeatRatePct,
    )[0];
    return { segment: best?.segment ?? primary, borrowed: false };
  }

  if (channelId === "google") {
    const intent = [...selected]
      .filter((s) => !s.segment.isReactivation)
      .sort((a, b) => b.segment.conversionPropensity - a.segment.conversionPropensity)[0];
    return { segment: intent?.segment ?? primary, borrowed: false };
  }

  // Demand generation and brand amplification: a prospecting audience.
  const fromSelected = selected.find(prospectable);
  if (fromSelected) return { segment: fromSelected.segment, borrowed: false };
  const fromAll = all.find(prospectable);
  return fromAll
    ? { segment: fromAll.segment, borrowed: true }
    : { segment: primary, borrowed: false };
}

export function generateCreatives(
  company: CompanyProfile,
  objective: GrowthObjective | null,
  strategy: StrategyRecommendation,
  selectedSegments: SegmentRecommendation[],
  allRecommendations: SegmentRecommendation[] = selectedSegments,
): CreativeAsset[] {
  const bankId = copyBankFor(company);
  const primary = selectedSegments[0]?.segment;
  if (!primary) return [];

  // One concept per funded channel, up to three.
  const channels = strategy.channelRoles.slice(0, 3);

  return channels.map((role) => {
    const meta = CHANNEL_META[role.channelId] ?? CHANNEL_META.meta;
    const { segment, borrowed } = audienceForChannel(
      role.channelId,
      selectedSegments,
      allRecommendations,
    );

    const arch = archetypeOf(segment);
    const template = meta.bank[bankId][arch];

    return {
      id: slugId("creative", company.id, role.channelId),
      channelId: role.channelId,
      channelLabel: meta.label,
      format: meta.format,
      headline: template.headline,
      body: template.body,
      cta: template.cta,
      targetSegmentId: segment.id,
      targetSegmentName: segment.name,
      strategicPurpose: borrowed
        ? `${purposeFor(role.channelId, objective, segment)} Your priority segment is an existing-customer audience, so the prospecting concept addresses the strongest prospectable segment in the account instead.`
        : purposeFor(role.channelId, objective, segment),
      reasoning: reasoningFor(role.channelId, segment, company),
      status: "draft",
      originalHeadline: template.headline,
      originalBody: template.body,
      generatedBy: "deterministic",
    };
  });
}
