# todos

_Living task list. Updated 2026-05-01. See plan.md for context._

---

## this week (2026-05-01 → 2026-05-08)

### customer discovery
- [ ] **matthew**: lock in 5 nonprofit intros from dad's network, calendar them
- [ ] **matthew + jake**: draft discovery interview script (top time-eaters, current saas stack, what they pay for tools today, who handles ops)
- [ ] **stephen**: build a simple notion or airtable to log discovery call notes — donor count, stack, pain points, willingness to pay
- [ ] **all**: target 8–10 calls done by end of week 2

### eng — start the spine
- [ ] **stephen**: kali-app repo scaffolding decision — next.js app router or split frontend/backend? lock it in.
- [ ] **stephen**: auth — clerk or supabase auth? pick one, wire up
- [ ] **stephen + silas**: multi-tenant postgres schema design — tenant_id on every table, row-level security or app-layer enforcement
- [ ] **stephen**: env setup — vercel + supabase or vercel + railway. document.
- [ ] **matthew**: salesforce npsp dev account, get oauth app registered, document scopes needed
- [ ] **matthew**: spike — pull contacts + donations + campaigns from npsp via api, dump to json. just prove it works.

### product / sales
- [ ] **jake**: design partner agreement template — equity-light or zero-equity, free during build period, locked rate after launch
- [ ] **jake**: pricing v1 model — 3 tiers, document assumptions in plan.md
- [ ] **stephen**: kalilabs.ai → "/apply" form route or just email cta wired to airtable

### ops
- [ ] **all**: weekly sync cadence — pick a day + time (sun night?)
- [ ] **stephen**: shared notion or linear for tracking, port this list into it

---

## weeks 2–4 (2026-05-08 → 2026-05-29)

### eng — kb + integrations
- [ ] kb skeleton — pgvector setup, openai or voyage embeddings pipeline, basic semantic search query
- [ ] entity resolution v1 — match contacts across tools by email + fuzzy name
- [ ] mailchimp integration — pull lists, campaigns, engagement data
- [ ] eventbrite integration — pull events, attendees, registrations
- [ ] cron + queue infra — bullmq or equivalent for scheduled syncs

### eng — chat
- [ ] chat-over-kb v1 — claude sonnet api with prompt caching enabled
- [ ] tool use: query kb, fetch records, return with citations (source: salesforce/contact/abc123)
- [ ] simple frontend chat ui — shadcn, message history persisted

### customer
- [ ] kick off design partner #1 — onboarding kickoff call, scope their stack, set 4-week timeline
- [ ] start onboarding playbook doc — every step, every gotcha, every config

---

## weeks 5–8 (2026-05-29 → 2026-06-26, includes hackdavis)

### eng — agent runtime
- [ ] agent runtime v1 — scheduled jobs, action surface api (send email, create task, update record)
- [ ] playbook 1: lapsed donor re-engagement — query lapsed donors, draft personalized outreach, queue for human review
- [ ] playbook 2: grant cycle tracker — pull from submittable, alert on deadlines, autopopulate y2 metrics
- [ ] dashboard v1 — query history, agent runs, integration health, audit log

### hackdavis sprint
- [ ] demo script + storyboard
- [ ] live data from design partner #1 (with permission) for the demo
- [ ] judging prep, pitch deck variant for hackathon (3 min version)
- [ ] post-hackdavis: write up, share to twitter/linkedin, route inbound to design partner pipeline

---

## weeks 9–12 (2026-06-26 → 2026-07-24)

### scale
- [ ] onboard design partners #2 and #3
- [ ] templatize onboarding — turn playbook doc into checklist + scripts
- [ ] 2–3 more integrations based on design partner stacks (likely: quickbooks, blackbaud, raisers edge)
- [ ] usage analytics — per-tenant cost tracking, llm spend by org

### compliance + funding
- [ ] SOC 2 type 1 audit prep — pick auditor (vanta or drata), kick off
- [ ] security questionnaire boilerplate (every nonprofit IT will ask)
- [ ] YC application — summer batch
- [ ] apply to nonprofit-focused accelerators (camelback, fast forward)

---

## parking lot / nice-to-have

- [ ] mobile app for ops staff (low priority, web-first for now)
- [ ] slack bot for in-channel agent triggering
- [ ] zapier-compatibility layer (ironic but practical — many orgs already have zaps)
- [ ] open-source the kb engine? (tbd, post-traction)
- [ ] white-label tier for accelerators / foundation networks

---

## blockers / waiting on

- waiting on: matthew's dad's first 5 intros
- waiting on: jake to draft design partner agreement
- waiting on: stephen to confirm repo + stack decisions
- unblocked the moment we get our first real nonprofit customer call done

---

## owner key
- **stephen** = engineering lead, full-stack
- **matthew** = engineering + customer discovery (dad pipeline)
- **silas** = ops, customer-facing
- **jake** = team lead, sales, design partner agreements

reassign as needed. update this file when scope changes.
