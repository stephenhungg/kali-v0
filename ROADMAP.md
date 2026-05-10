# kali-v0 roadmap

prioritized feature list for v1 prototype. each item is **implement → test → refine → commit**, atomic and pushable. ordered by leverage × demo-impact.

> contract: [`data/v1-prototype-scope.md`](./data/v1-prototype-scope.md). these features serve that scope. no scope creep.

## ownership split

- **frank + nicole** → landing page (`app/page.tsx` + supporting marketing components). own the public-facing first impression.
- **matty** → architecture authority. taste decisions on the agent + connectors.
- **tenzin (autonomous)** → grinding through the feature list below while stephen sleeps.

---

## phase 0 — foundation (unblocks everything)

- [x] **F0.1** repo scaffold: next.js 16 + ts strict + tailwind 4 + bun + app router
- [x] **F0.2** vercel deployment + auto-deploy on push
- [x] **F0.3** beginner-friendly README + CONTRIBUTING
- [x] **F0.4** drizzle schema (tenants, users, connectors, entities, records, conversations, messages, agent_runs, audit_log) — code only, no DB connection yet
- [x] **F0.5** project layout per scope §9: `lib/connectors/`, `lib/context/`, `lib/agent/`, `lib/db/`, `lib/audit/`, `data/seed/`
- [x] **F0.6** env var contract documented: `.env.example` extended with everything we'll eventually need (anthropic, voyage, neon, clerk, solana, etc.)

## phase 1 — connector framework (the spine for all 11 tools)

- [x] **F1.1** `lib/connectors/base.ts` — `Connector` interface, `ToolDefinition` type, registration pattern (`lib/connectors/registry.ts`)
- [x] **F1.2** mock data loader — `lib/connectors/seed-loader.ts` reads `data/seed/<tool>.json`, validates against zod schema, caches in memory
- [ ] **F1.3** sync-state tracker (in-memory for now, db-backed later)
- [ ] **F1.4** zod schema convention — every connector exports `<tool>.schema.ts`

## phase 2 — seed data: one coherent fictional org

- [ ] **F2.1** master entity graph: "Rivertown Community Foundation" — staff, donors, programs, grants, vendors, board, partners. ONE source of truth.
- [ ] **F2.2** generator script: `scripts/seed.ts` produces all 11 connector json files from the master graph. Cross-references guaranteed consistent.
- [ ] **F2.3** seed: bloomerang (1.2K donors, 2.8K donations, 15K touchpoints)
- [ ] **F2.4** seed: salesforce npsp (200 contacts, 80 accounts, 350 opps)
- [ ] **F2.5** seed: m365 (30 staff, 1500 emails, 200 calendar events)
- [ ] **F2.6** seed: zoom (30 meetings, 18 transcripts)
- [ ] **F2.7** seed: sharepoint (200 docs)
- [ ] **F2.8** seed: instrumentl (80 grants, 40 funders)
- [ ] **F2.9** seed: quickbooks (12mo P&L, 1K txns, 6 program budgets)
- [ ] **F2.10** seed: solana (devnet wallet metadata, 30 historical disbursements)
- [ ] **F2.11** seed: powerbi (4 dashboards, 50 KPIs)
- [ ] **F2.12** seed: powerautomate (12 flows, 6mo run history)
- [ ] **F2.13** seed: knowbe4 (30 user risk scores, 6mo phishing data)

## phase 3 — connector implementations

each connector exposes its query functions per the scope, validates with zod, returns hydrated typed records.

- [ ] **F3.1** bloomerang (reference connector — sets pattern for all others)
- [ ] **F3.2** salesforce
- [ ] **F3.3** m365
- [ ] **F3.4** zoom
- [ ] **F3.5** sharepoint
- [ ] **F3.6** instrumentl
- [ ] **F3.7** quickbooks
- [ ] **F3.8** solana (devnet wired up)
- [ ] **F3.9** powerbi
- [ ] **F3.10** powerautomate
- [ ] **F3.11** knowbe4

## phase 4 — context layer

- [ ] **F4.1** entity resolution (rule-based: email > name+org > phone > fuzzy match)
- [ ] **F4.2** embedding pipeline (voyage-3 with openai fallback)
- [ ] **F4.3** pgvector storage with per-tenant namespaces
- [ ] **F4.4** hybrid retriever (semantic + structured filters, top-K=20 with reranking)
- [ ] **F4.5** structured query DSL (typed, compiles to SQL)
- [ ] **F4.6** audit log infrastructure (immutable, append-only)

## phase 5 — agent runtime

- [ ] **F5.1** anthropic SDK wired up with prompt caching
- [ ] **F5.2** tool registry — all 60+ connector functions exposed as anthropic tools
- [ ] **F5.3** system prompt v1 (cached prefix, domain-tagged tool groupings, citation rules)
- [ ] **F5.4** streaming chat endpoint (`app/api/chat/route.ts`) with vercel ai sdk
- [ ] **F5.5** tool-call rendering in the message stream
- [ ] **F5.6** parallel tool-use surfacing (multiple tool calls in one turn)
- [ ] **F5.7** citation chain rendering (`[1]` style with hover-to-source)
- [ ] **F5.8** conversation persistence

## phase 6 — chat UI

- [ ] **F6.1** three-pane layout: history / chat / context-panel
- [ ] **F6.2** source-pulse component (11 connector tiles, animate on tool call)
- [ ] **F6.3** suggested-queries empty state (the four wow-queries as buttons)
- [ ] **F6.4** message renderer with citation chips
- [ ] **F6.5** tool-call collapsible cards in the chat stream

## phase 7 — auth + multi-tenancy

- [ ] **F7.1** clerk integration + protected routes
- [ ] **F7.2** tenant context provider (every query carries tenant_id)
- [ ] **F7.3** demo tenant pre-seeded ("Rivertown Community Foundation")
- [ ] **F7.4** skip-login mode for demo machine

## phase 8 — the five wow-queries

each demoable end-to-end: query → tools fire → citations land.

- [ ] **F8.1** donor intelligence (lapsed + matching gifts + event attendance)
- [ ] **F8.2** grant ops (deadlines + funder ties)
- [ ] **F8.3** finance ↔ programs (cash runway + at-risk flags)
- [ ] **F8.4** automation discovery (email patterns + power automate gaps)
- [ ] **F8.5** **onchain money moment** (solana batch payout, the wow)

## phase 9 — polish

- [ ] **F9.1** loading states + skeleton
- [ ] **F9.2** error states with retry
- [ ] **F9.3** keyboard shortcuts
- [ ] **F9.4** mobile-responsive (judges might pull it up on phones)
- [ ] **F9.5** dark/light theme polish
- [ ] **F9.6** demo storyboard rehearsal
- [ ] **F9.7** screen recording for the four queries

---

## current cursor

**building right now:** phase 2 (master entity graph + seed data generator).

**last shipped:** F0.4 drizzle schema, F0.5 project layout, F0.6 env contract, F1.1 connector base interface + registry, F1.2 seed loader. All on `main`, deployed at https://kali-v0.vercel.app.

frank/nicole — you don't need to wait on any of this to start the landing page. work on `app/page.tsx` and add components in `components/marketing/`. avoid touching `lib/` for now (that's tenzin's lane).
