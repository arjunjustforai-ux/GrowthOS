# GrowthOS

**AI drafts the argument. You make the call.**
*Decide smarter. Grow faster.*

An AI growth operating system for lean marketing teams. GrowthOS turns company
context, a business objective and your own performance data into a **budget
allocation you can interrogate, edit, approve and defend** — and stops there. It
does not launch campaigns, move money, or optimise anything in an ad account.


---

## The problem

A two-person marketing team at an Indian D2C brand has a Meta dashboard, a Google
dashboard, a Shopify export, a spreadsheet and an instinct. Every month they have
to commit next month's budget across channels. No analyst checks their thinking.

Then the founder asks: **"Why 60% to Meta?"**

There is usually no defensible answer. That gap — not a shortage of data, and not
a shortage of AI copy — is the entire product.

GrowthOS assembles the argument from the same data the team already has, exposes
every step of it, lets a human overrule any part of it, records what they
overruled and why, and produces a document they can defend line by line.

## What it is not

Not a chatbot, not a dashboard, not a CRM, not a scheduler, and explicitly not an
autonomous ad buyer. There is no auto-publish mode and no code path that produces
an approved plan without a person pressing the button.

---

## Installation

Requires **Node.js 20.9+** (developed on 22.x).

```bash
npm install
npm run dev          # http://localhost:3000
```

For a production build:

```bash
npm run build
npm start
```

### Environment setup

**None is required.** GrowthOS runs its complete demo with no configuration, no
API keys and no network access. Copy `.env.example` to `.env.local` only if you
want the optional LLM copy assistance:

```bash
LLM_PROVIDER=anthropic   # or openai; default "none"
LLM_API_KEY=...
# LLM_MODEL=claude-sonnet-5
```

If no key is present, the LLM service layer reports itself unavailable and every
caller falls back to deterministic output. Keys are read server-side only and
never reach the browser.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript, no emit |
| `npm run verify` | Runs the five product test scenarios against the engine, headless |

### Demo credentials

There are none. GrowthOS is a single-workspace demo product with no login —
multi-user roles are an explicit non-goal. The approver name written into the
approval record defaults to **Demo User** and is editable in Settings.

State lives in the browser's `localStorage`. **Reset demo** (sidebar or Settings)
returns everything to the initial presentation state.

---

## Demo walkthrough

Press **Presentation demo** on the home screen. It loads Aura Skincare with the
objective already set, then walk the nine stages:

1. **Context** — 82% complete, two named gaps, ~8% confidence penalty. Missing
   data never blocks.
2. **Objective** — natural language is parsed into goal, horizon, budget and
   constraint, and shown back for confirmation.
3. **Segments** — three segments scored on five weighted factors. The weights
   move with the objective, visibly.
4. **Strategy** — the hero screen. Reasoning trace, open by default:
   input → interpretation → decision, plus "what would change this".
5. **Budget** — Meta 50 / Google 30 / Retention 20. Move a slider; the economics
   and the confidence move with it.
6. **Creative** — three concepts, one per funded channel.
7. **Guardrails** — an unsupported health claim is caught, explained and given a
   concrete replacement.
8. **Approval** — mandatory. Nothing gets past it.
9. **Outcome** — a scenario band, never a point forecast.

Then **Growth decision proposal** — fifteen sections, printable to PDF.

A full presenter script is in [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).

---

## Architecture summary

```
Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 3
```

### The pipeline

```
COMPANY CONTEXT → NORMALISE → OBJECTIVE → SEGMENT SCORING → STRATEGY
   → BUDGET → REASONING → CREATIVE → GUARDRAIL → [HUMAN REVIEW]
   → [HUMAN APPROVAL] → OUTCOME RANGE → PROPOSAL
```

Ten typed stages in `src/lib/engine/`, each taking typed input and returning
typed output. They are pipeline stages, not agents holding conversations.

| Module | Stage |
| --- | --- |
| `context.ts` | Context interpreter, completeness scoring, inferred defaults |
| `objective.ts` | Objective interpreter (natural language → measurable variables) |
| `segments.ts` | Segment analyst |
| `strategy.ts` | Strategy agent, channel scoring, allocation |
| `budget.ts` | Budget allocator, reflow, impact model |
| `creative.ts` | Creative generator |
| `guardrails.ts` | Guardrail critic |
| `outcome.ts` | Outcome scenario generator |
| `proposal.ts` | Proposal composer |
| `pipeline.ts` | Orchestrator and stage gates |

**The orchestrator has no code path that produces an approved plan.** Approval is
written only by the approval screen, in response to a person acting.

### Scoring

```
Segment Score = 0.30 profitability + 0.25 conversion propensity
              + 0.20 repeat behaviour + 0.15 reachable audience
              + 0.10 strategic fit

Channel Score = 0.30 historical efficiency + 0.25 marginal scalability
              + 0.20 objective alignment + 0.15 audience fit
              + 0.10 data confidence
```

Those are the base weights. The **objective re-weights the segment factors**,
which is why "grow profitable revenue" and "acquire new customers" return
genuinely different rankings rather than the same ranking reworded. The applied
weights are shown next to the score.

Two structural rules sit on top of the channel scores, and they are the
difference between a plausible answer and a defensible one:

- **Funding floor** — a channel whose contribution ratio (ROAS × gross margin)
  is below 1.5× does not cover its own cost. It gets zero and the trace says so,
  rather than a token 4%.
- **Scalable capacity cap** — a channel cannot absorb unlimited spend in one
  cycle. The cap comes from how much of the available demand it already
  captures. This is why the highest-*scoring* channel is often not the largest
  budget line, and it is the single most useful thing the product explains.

### The budget impact model

```
effectiveCAC(spend) = baseCAC × (spend / baseSpend) ^ exponent
```

The curve is **asymmetric**: scaling past a channel's proven level costs full
elasticity; cutting a channel back returns only 35% of it. A symmetric curve
would let a user "improve" blended CAC by starving their expensive channel —
the kind of answer that looks clever in a model and loses money in an ad account.

### Determinism

Nothing in the engine calls `Math.random()`. The same inputs produce
byte-identical output, which is what makes the reasoning trace defensible rather
than decorative. `npm run verify` asserts this.

### AI usage

AI is an optional finishing pass, never the decision-maker. The recommendation,
reasoning trace, budget model, guardrail findings and outcome band are all
deterministic. A configured LLM is only ever asked to re-phrase copy the engine
has already committed to — which is why the product is fully demonstrable with
no key, no vendor and no network.

### State

The growth-plan workspace lives in the browser and is written to `localStorage`
on every change. That is deliberate for a demo product: a live presentation
should not be able to fail because a database connection dropped in a lecture
theatre. Every write goes through one `persist` function, so swapping in a
SQLite- or Postgres-backed adapter is a change in one place, not a rewrite.

### Project layout

```
src/
├── app/                    routes (9 plan stages + home, proposal, history, data,
│   │                       settings, admin) and /api/llm
├── components/
│   ├── ui/                 design system
│   ├── nav/                shell, sidebar, stepper, logo
│   └── plan/               stage shell + reasoning trace
└── lib/
    ├── types.ts            the full data model
    ├── engine/             the ten pipeline stages
    ├── demo/               three seeded D2C brands
    ├── llm/                provider-agnostic service layer + fallback
    └── store/              workspace, plan lifecycle, overrides, audit log
scripts/verify-engine.mjs   the five product test scenarios
```

---

## Known limitations

Stated plainly, because a product about honest uncertainty should be honest
about itself.

1. **The demo data is invented.** The three brands are shaped to be plausible for
   an Indian D2C business in the ₹2–20 crore band. They are not derived from any
   real company and are labelled as simulated everywhere they appear. They must
   never be presented as market evidence.

2. **The impact model is a transparent approximation, not marketing science.**
   A single cost-elasticity exponent per channel is a crude stand-in for a real
   response curve. It is directionally right and fully inspectable, which is what
   the MVP needs; it is not a media-mix model and the product never claims to be
   one.

3. **The outcome band is not calibrated.** Its width comes from a confidence
   score, not from a distribution fitted to historical variance. It is an honest
   statement of uncertainty, not a statistical interval. The UI says so on the
   screen.

4. **Guardrails are rule-based and English-only.** They catch the common,
   obvious problems — claim language, superlatives, sensitive attributes — and
   will miss anything phrased unusually. It is a first-pass check, not legal
   advice, and it does not replace compliance sign-off.

5. **No persistence beyond the browser.** Clearing site data or switching browser
   loses the workspace. There is no server-side store, no export/import of the
   workspace itself, and no sync.

6. **Segments are supplied, not discovered.** GrowthOS scores the segments in
   your context or infers three archetypes from category benchmarks. It does not
   cluster your customer data to find new ones.

7. **Single currency and single market.** Everything is rupee-native and shaped
   around Indian D2C. Nothing is localised.

8. **Objective parsing is deterministic pattern-matching.** It reads the
   constructions a marketing lead actually writes. An unusual phrasing will be
   read imperfectly — which is exactly why the interpretation is shown back for
   confirmation before anything downstream runs.

9. **CSV import is minimal.** It updates channel spend, CAC and ROAS on existing
   channels from a header row. It does not create channels or import segments.

10. **No accessibility audit has been done.** The interface is keyboard-operable
    and uses semantic markup, but it has not been tested with a screen reader.

## Non-goals

Deliberately out of scope: publishing to Meta or Google, launching or pausing
campaigns, automatic budget movement, real-time optimisation, a CRM, multi-user
roles, email or social scheduling, lead scoring, SEO content generation, a full
probabilistic simulator, an integrations marketplace, and a mobile app.

The product does one job well.
