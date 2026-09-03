# GrowthOS — 5-minute presentation script

**Target length:** 5–7 minutes. **Setup:** `npm run build && npm start`, open
`http://localhost:3000`, press **Reset demo** in the sidebar, full screen.

Every figure below is what the engine actually produces for Aura Skincare. If a
number on screen differs, the input changed — check you reset the demo.

---

## 0 · Before you start (10 seconds)

- Sidebar → **Reset demo** → confirm. You land on a clean home screen with two
  seeded historical plans.
- Do **not** press "Presentation demo" yet.

---

## 1 · The problem (45 seconds)

*Stay on the home screen. Read the card at the bottom left.*

> A two-person marketing team at an Indian D2C brand has a Meta dashboard, a
> Google dashboard, a Shopify export, a spreadsheet and an instinct. Every month
> they commit next month's budget across channels, and no analyst checks their
> thinking.
>
> Then the founder asks: **"Why 60% to Meta?"**
>
> There is usually no defensible answer. That is the gap. Not a shortage of data
> — a shortage of argument.

**Press "Presentation demo"** in the header. It loads Aura Skincare with the
objective already set, so we can spend the time on the reasoning rather than on
typing.

---

## 2 · Load the company (40 seconds) — Stage 1

*You are on Company context.*

> Aura Skincare. ₹8 crore revenue, ₹6 lakh a month in paid media, ₹1,850 average
> order value, 68% margin, 23% repeat, two people in marketing.

**Point at the right rail — this is the first thing that makes GrowthOS different:**

> Context completeness: **82%**. It is missing repeat customer CAC and Google
> conversion data, and it tells you what each gap costs: *recommendation
> confidence reduced by approximately 8%*.
>
> Missing data does not block anything. It reduces confidence, is labelled as
> inferred, and that penalty follows the plan all the way to the final document.

*Optional, if you have a second: point at the "Demo data" tags on each field.
User-provided data and machine guesses never look the same in this product.*

**Click "Set growth objective →".**

---

## 3 · The objective (40 seconds) — Stage 2

> *"Grow monthly revenue by 20% over the next quarter without increasing blended
> CAC above ₹1,200."* That is how a marketing lead actually says it.

**Point at the right-hand card:**

> GrowthOS turns it into variables — **Revenue +20%, 90 days, ₹6,00,000 a month,
> CAC ≤ ₹1,200** — and shows you what it understood before anything runs on that
> reading. If the reading is wrong, the whole argument is wrong in a way that
> looks confident. So a person confirms it first.

**Point at "How this objective changes the scoring":**

> The objective does not just get stored. It re-weights the segment scoring —
> profitability up, reachable audience down. Remember that; we come back to it.

**Click "Rank customer segments →".**

---

## 4 · The segments (45 seconds) — Stage 3

> Three segments, scored on the same five factors.
>
> **Repeat Skincare Buyers** ranks first: 18,400 people, ₹720 acquisition cost,
> 41% repeat, about ₹1,575 of contribution per customer.
>
> Second is **Lapsed Customers**, third is **High-Intent First-Time Buyers**.

**Scroll to "How the score is built".**

> Every factor, every weight, every segment's score. The applied weights are
> shown next to the base weights, and the ones this objective moved are
> highlighted. Nothing here is a black box.

**Click "Build strategy →".**

---

## 5 · The reasoning — the hero screen (75 seconds) — Stage 4

> This is the screen the product exists for.

**Read the channel roles:**

> Meta 50% for demand generation. Google 30% for intent capture. Retention 20%
> for repeat conversion.

**Then point at "Not funded this cycle: Influencer":**

> Influencer gets **zero**. ROAS 2.05× at 68% margin is a 1.39× contribution
> ratio, below the 1.5× floor — it does not return more gross profit than it
> costs. A weaker product would have given it 4% to look thorough.

**Scroll into the reasoning trace. It is open by default — say so:**

> Input → interpretation → decision. Every material call in this plan.
>
> *Meta CAC ₹915* → *14% below blended CAC of ₹1,070, with 72% headroom left* →
> *maintain Meta as the largest acquisition line at 50%.*
>
> *Google ROAS 4.80× but impression share 89%* → *only 11% of available demand
> is still unclaimed* → *increase Google moderately; do not make it dominant.*
> Strong channel, almost no room left to grow.
>
> *Repeat customers contribute 37% more margin* → *retention has better
> contribution economics than any acquisition channel here* → *20% to CRM,
> capped by the size of the addressable base, not by its efficiency.*
>
> Retention actually scores highest of the three. It is not the biggest line
> because there are only so many repeat customers to reach.

**Scroll to "What would change this recommendation?" — do not skip this:**

> Every one of these is checkable against next month's numbers. Meta CAC above
> ₹1,124. Google impression share below 64%. Repeat rate below 16%. If one of
> them happens, this plan gets rebuilt, not defended.

**Click "Edit the budget →".**

---

## 6 · Human override (60 seconds) — Stage 5

> The founder has a view: there is a creator campaign coming, so push Meta.

**Drag Meta from 50 to 60.** *(Or type 60 in the field.)*

> Everything reflows. Google 24, Retention 16 — the split is always exactly 100.

**Point at the Projected impact panel and read the arrows:**

> Blended CAC **₹1,032 → ₹1,052**. Worse.
> New customers **465 → 479**. Better.
> Contribution margin **₹7.62 L → ₹7.51 L**. Worse.
> Confidence **79% → 73%**.
>
> More customers, worse economics. That is the actual trade, and the product
> shows you the cost of your own judgement instead of just agreeing with you.

**Point at the "AI recommendation vs your final allocation" table:**

> These are kept apart on purpose. The gap between them is the human judgement
> in this plan, and it goes on the proposal by name.

**Type into the reason field:** *"Upcoming Meta creator campaign expected to
improve CTR."*

> Six weeks from now nobody remembers why. This one sentence is what turns an
> override into a defensible decision.

**Click "Generate creative →".**

---

## 7 · Creative and the guardrail catch (60 seconds) — Stages 6–7

> Three concepts, one per funded channel. Each carries its target segment, its
> strategic purpose, and why it was written that way — the retention message
> leads with timing rather than a discount, because a discount here costs margin
> on an order that was probably going to happen anyway.

**Click "Run guardrail review →".**

*Let the screen land. Then:*

> The Meta concept opens with **"Clinically proven to eliminate acne in 14
> days."** It reads like ordinary skincare copy. It is also a claim this brand
> cannot substantiate.
>
> Two rules fired. **HC-01, health claim** — under ASCI's code an efficacy claim
> of that kind needs substantiation on file, and no study was supplied with this
> context. The suggested replacement: *"Designed to support clearer-looking
> skin."*
>
> Note what did **not** happen: it was not quietly rewritten. You are told what
> was detected, which rule caught it, and what it proposes instead.

**Click "Accept fix" on HC-01.**

> The copy changes, and the second finding disappears — GrowthOS re-checks the
> creative after the edit rather than leaving a stale flag on copy that no longer
> says the flagged thing.

*If you have 10 spare seconds, point at the "Override" button:*

> You can override a warning — but it demands a written reason, and that reason
> goes in the audit log. Blocking findings, like discriminatory targeting, cannot
> be overridden at all.

**Click "Review & approve →".**

---

## 8 · Approval is structural (45 seconds) — Stage 8

> Objective, segment, strategy, budget, creative, guardrails, risks. Each block
> can be approved, edited or rejected individually.

**Scroll to "Human judgement recorded on this plan":**

> Both overrides are here. AI said Meta 50, human said 60, and here is the
> reason.

**Point at the notice above the button:**

> *"You remain responsible for the final marketing decision. GrowthOS provides
> decision support, not autonomous execution."*
>
> There is no auto-publish mode in this product. Not a setting that is turned
> off — there is no code path that produces an approved plan without a person.

*Optional 8-second proof, if the room is sceptical: click **Outcome** in the
stepper before approving. It refuses, and explains why.*

**Tick the checkbox. Click "Approve growth plan".**

---

## 9 · The outcome range (45 seconds) — Stage 9

> Now the important part. GrowthOS does **not** give you a predicted number.

**Point at the band:**

> Low ₹15.5 L. Central range ₹17.7–20.9 L. Upper scenario ₹23.1 L. Confidence
> 64%, moderate.
>
> The upper figure is labelled *"Not potential revenue. Not a target."* A single
> predicted number is the most over-trusted object in marketing software — it
> gets screenshotted and defended as if it were a commitment.

**Point at the three panels:**

> The range holds only if Meta CAC stays within ±12%, repeat rate stays above
> 20%, Google demand does not fall more than 15%, and margin holds at 68%.

**Then "What would make this wrong?":**

> Mandatory on every plan. CPMs spike. A competitor goes promotional.
> Landing-page conversion drops. Product goes out of stock — spend continues,
> revenue does not.

**Click "Open growth decision proposal →".**

---

## 10 · The artefact (30 seconds)

> Fifteen sections. Company snapshot, objective, segment ranking, strategic
> thesis, channel roles, budget with the AI-versus-human column, the full
> reasoning trace, creative, guardrail findings and how each was resolved,
> every override with its reason, the outcome range, assumptions, risks, the
> approval record, and a complete audit log.

**Press "Download PDF / Print"** — show the print dialog for two seconds and
cancel.

**Close on this:**

> The founder asks *"why 60% to Meta?"*
>
> Line by line: Meta acquires 14% below blended CAC with 72% headroom left,
> Google is at 89% impression share so there is nothing left to buy there,
> retention has the best economics but the smallest reachable base — and the
> extra ten points on top of the model were a human call, made by a named person,
> for a written reason, on a stated date.
>
> **AI drafted the argument. A person made the call.**

---

## Contingencies

| If | Do |
| --- | --- |
| A screen looks wrong | Sidebar → **Reset demo** → **Presentation demo**. Under 10 seconds. |
| You are behind schedule | Skip §4 (segments) and §10 (proposal). Never skip §5 or §9. |
| Asked "is this really AI?" | Settings shows copy assistance is off. The engine is deterministic on purpose — that is what makes the reasoning reproducible and the trace worth trusting. An LLM is only ever used to re-phrase copy the engine already decided on. |
| Asked "where do the numbers come from?" | **Data** in the sidebar. Every seeded figure the engine uses, on one page. |
| Asked "does it launch the campaign?" | No. There is no ad-platform connection anywhere in the product. It ends at an approved proposal. |
| The network drops | Irrelevant. Nothing in the demo path uses it. |
