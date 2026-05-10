# plan

_Updated 2026-05-01 — locks in product scope, build sequencing, and the hackdavis vs build-now decision._

---

## what we're actually building

A **forward-deployed agentic data platform for nonprofits**. Not zapier-for-nonprofits. Zapier already exists and nonprofits already use it — it's dumb pipes between apps. We're the layer above that: unified semantic knowledge base + agent runtime that reasons across tools and does ops work, not just routes events.

Two-part product, sold together:

### 1. Core SaaS (the platform)
- **Unified data layer** — etl + entity resolution across the nonprofit stack: salesforce npsp, submittable, mailchimp, eventbrite, quickbooks, raisers edge, blackbaud, google workspace, slack
- **Queryable knowledge base** — semantic search + structured query over donor, event, grant, finance, comms data. donor PII isolated per tenant. SOC 2 aligned.
- **Agent runtime** — pre-built playbooks (lapsed donor outreach, grant tracking, event ops, compliance audits) plus a config layer for org-specific agents
- **Chat interface + dashboard** — natural language queries, agent triggering, workflow visibility
- **Multi-tenant**, hosted by us. Customers don't run anything.

### 2. Forward-deployed onboarding (the wedge)
- 2–4 week white-glove engagement per org. We wire their stack, build initial kb, define their org-specific agents (their grant cycle, donor segments, programs).
- Nonprofits cannot DIY this. They have no engineers. The FDE motion is the only viable distribution.
- Every onboarding compounds: each new org teaches us the nonprofit ops surface area, builds reusable playbooks/integrations that ship to all customers.
- One-time fee or rolled into year-1 contract.

### 3. Ongoing
- Managed agents (we run them, they consume).
- Light-touch CS retainer tier for hands-on orgs.
- Self-serve usage tier as orgs grow into ops sophistication.

---

## differentiation vs existing tools

| | zapier | salesforce npsp | kali |
|--|--|--|--|
| reasons across tools | no — event routing only | no — single tool | yes — agent layer over unified kb |
| natural language query | no | limited | yes — semantic kb |
| pre-built nonprofit context | no | partial | yes — donor cycles, grants, compliance baked in |
| forward-deployed setup | no | partner-led, $100k+ | included, 2–4wk |
| pricing model | task-based, scales painfully | seat-based, expensive | flat per-org tier |

---

## unit economics

**Variable per-org per month (at moderate use):**
- llm inference: $50–100 (largest line — claude/gpt for queries + agent runs)
- vector kb (pinecone or pgvector): $5–20
- agent compute (cron, queue, etl workers): $10–30
- **total variable: ~$80–150/org/mo**

**Fixed infra:** ~$200–500/mo flat (postgres, auth, hosting, monitoring) — sublinear scaling.

**Pricing tiers (target):**
- small nonprofit: $500/mo + $5k onboarding
- mid: $1.5k/mo + $15k onboarding
- large: $5k/mo + $40k onboarding (multi-program, multi-state)

**Gross margin: 70–85%** at any reasonable scale. Onboarding fees front-load year-1 cash.

**Cost levers we control:**
- prompt caching (anthropic cache cuts repeated context cost ~90%)
- tiered model use (haiku for classification, sonnet for reasoning, batch api for bulk)
- semantic cache on common queries
- per-tenant kb stays small (one nonprofit's data is gigs, not TB)

---

## the hackdavis question

**hackdavis is a forcing function, not the strategy.** Build for it AND start building now. Don't wait.

### why we don't wait
- Customer discovery via matthew's dad starts NOW. We need a clickable thing to show in those calls within 2 weeks, not a hackathon prototype 4+ weeks out.
- Hackathons compress time but don't replace product work. Anything we build at hackdavis is throwaway-quality without the structural work behind it (auth, multi-tenant, real integration plumbing).
- The deck and landing page are live. If we don't have a usable product behind them by mid-may, we lose the inbound momentum.

### what we do instead
- **Now → mid-may**: build the unified data layer skeleton + 1 integration deep (salesforce npsp) + chat-over-kb minimum. Real auth, real tenant isolation, real db. This is the spine.
- **Mid-may → hackdavis**: layer in 2–3 more integrations + agent runtime v1 + 2 pre-built playbooks. Hackdavis becomes the polish + demo sprint, not the build-from-scratch sprint.
- **At hackdavis**: present this as a fully real product with live customer discovery data behind it. Win is bonus; the actual goal is recruiting + investor signal + design partner intros.
- **Post-hackdavis**: onboard first 2–3 design partners (matthew's dad's network). Forward-deployed engagements start.

### tl;dr
Don't wait for hackdavis. Use it as a deadline checkpoint, not a starting line.

---

## build sequencing (12 weeks)

### weeks 1–2 (now → 2026-05-15)
- Customer discovery: 8–10 calls via matthew's dad. Lock in 2 design partners.
- Eng: repo scaffolding, auth, multi-tenant postgres schema, env setup
- Eng: salesforce npsp integration v1 — pull contacts, donations, campaigns
- Eng: kb skeleton — pgvector, embedding pipeline, basic semantic search
- Sales: design partner agreement template

### weeks 3–4 (2026-05-15 → 2026-05-29)
- Eng: chat-over-kb v1 — claude api, prompt caching, citations back to source records
- Eng: 2 more integrations — mailchimp + eventbrite
- Eng: entity resolution v1 — same donor across tools merges to one record
- Customer: kickoff first design partner. Start onboarding playbook doc.

### weeks 5–8 (2026-05-29 → 2026-06-26, includes hackdavis)
- Eng: agent runtime v1 — scheduled jobs, action surface (send email, create task, update record)
- Eng: 2 pre-built playbooks — lapsed donor re-engagement, grant cycle tracker
- Eng: dashboard v1 — query history, agent runs, integration health
- Hackdavis: demo polish, judging prep, pitch.

### weeks 9–12 (2026-06-26 → 2026-07-24)
- Onboard 2nd + 3rd design partners.
- Eng: 2–3 more integrations based on design partner stacks.
- Compliance: SOC 2 Type 1 audit prep, security questionnaire boilerplate.
- Apply: YC summer batch (deadline TBD), nonprofit accelerators.

---

## risks + mitigations

- **risk: nonprofits won't pay $500–5k/mo.** mitigate: customer discovery validates pricing in calls 1–10 before building further.
- **risk: integration sprawl eats all eng time.** mitigate: 1 deep integration (salesforce npsp) before any breadth. Use unified ETL framework (airbyte / fivetran / hand-rolled with shared schema).
- **risk: forward-deployed motion doesn't scale beyond 5–10 orgs.** mitigate: ruthlessly templatize each onboarding. Year 2 target is 80% reuse from playbook library.
- **risk: llm cost runs hot on power users.** mitigate: aggressive prompt caching, tiered models, usage caps with overage pricing.
- **risk: data privacy incident.** mitigate: SOC 2 from day one, per-tenant logical isolation, no shared embeddings, audit log everything.

---

## decision log
- **2026-05-01**: confirmed product is FDE + saas hybrid, not pure self-serve. Build now, don't wait for hackdavis. Hackdavis is checkpoint, not starting line.
- **2026-05-01**: confirmed primary differentiation vs zapier is agentic reasoning + queryable kb, not integration breadth.
- **2026-04-30**: pitch deck shipped at kalilabs.ai/deck for columbia ignition grant.
- **2026-04-29**: idea locked: AI infra for nonprofits, problem is 5–7 saas tools that don't talk.
