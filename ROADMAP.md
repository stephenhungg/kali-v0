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
- [x] **F1.2** mock data loader — `lib/connectors/seed-loader.ts` reads `data/seed/<size>/<tool>.json`, validates against zod schema, caches by `(baseDir, size, connectorId)`
- [ ] **F1.3** sync-state tracker (in-memory for now, db-backed later)
- [x] **F1.4** zod schema convention — every connector exports `<tool>.schema.ts` (reference: `bloomerang.schema.ts`)

## phase 2 — seed data: one coherent fictional org

- [x] **F2.1** master entity graph: "Rivertown Community Foundation" — `lib/seed/build-graph.ts` builds tenant + people (staff, board, donors, prospects, vendors, partners) + orgs + events + donations + campaigns + grants + docs + emails + calendar + zoom + flows + dashboards + qb txns + knowbe4 + solana txs from one seeded RNG. Three sized fixtures (small/medium/large).
- [x] **F2.2** generator script: `scripts/generate-seed.ts` builds the graph and projects to all 11 connectors via `lib/seed/project.ts`. Cross-references stable across runs (deterministic seed).
- [x] **F2.3** seed: bloomerang (medium: 830 constituents, 2,437 transactions, 4 online forms)
- [x] **F2.4** seed: salesforce npsp (medium: ~200 contacts, ~80 accounts, ~350 opps via `projectSalesforce`)
- [x] **F2.5** seed: m365 (medium: 22 staff, 3,200 emails, 1,229 calendar events)
- [x] **F2.6** seed: zoom (medium: 60 meetings, 30 transcripts)
- [x] **F2.7** seed: sharepoint (medium: 220 docs across 5 sites)
- [x] **F2.8** seed: instrumentl (medium: 38 grants — 21 awarded — across foundations + government funders)
- [x] **F2.9** seed: quickbooks (medium: trailing-12-mo P&L, 2,779 txns, 6 program budgets)
- [x] **F2.10** seed: solana (devnet wallet metadata, 55 historical disbursements totaling $365K USDC)
- [x] **F2.11** seed: powerbi (4 dashboards across donor health / program impact / fundraising pipeline / financial health)
- [x] **F2.12** seed: powerautomate (12 flows with 6mo run history)
- [x] **F2.13** seed: knowbe4 (22 staff risk scores, 6mo phishing data)

## phase 3 — connector implementations

each connector exposes its query functions per the scope, validates with zod, returns hydrated typed records, and self-registers with `lib/connectors/registry.ts`. test coverage is mandatory — see `lib/connectors/bloomerang.test.ts` for the pattern (schema validation + pure-query tests + tool-handler audit assertions).

- [x] **F3.1** bloomerang (reference connector — sets pattern for all others). `lib/connectors/bloomerang.{schema,ts,test}.ts`. 6 tools: `searchDonors`, `getDonor`, `getDonations`, `getRecentDonations`, `getEngagementScore`, `getOnlineDonationForms`. 41 tests passing.
- [x] **F3.2** salesforce npsp. `lib/connectors/salesforce.{schema,ts,test}.ts`. 8 tools: `getAccount`, `searchAccounts`, `getContact`, `searchContacts`, `getOpportunitiesForContact`, `getRelatedAccount`, `getCampaignMembers`, `searchCampaigns`. 45 tests passing.
- [x] **F3.3** m365 (mail + calendar + directory). `lib/connectors/m365.{schema,ts,test}.ts`. 7 tools: `getUser`, `searchUsers`, `searchEmails`, `getEmailThread`, `getLastEmailToEmail`, `getCalendarEvents`, `getDistributionLists`. 33 tests passing.
- [x] **F3.4** zoom (meetings + transcripts + attendance). `lib/connectors/zoom.{schema,ts,test}.ts`. 7 tools: `searchMeetings`, `getMeeting`, `getMeetingTranscript`, `searchTranscripts` (full-text with snippet context), `getAttendees`, `getAttendanceForPerson` (powers "donor attended N events"), `getPhoneCallLogs`. 33 tests passing.
- [x] **F3.5** sharepoint (documents + sites + sharing audit). `lib/connectors/sharepoint.{schema,ts,test}.ts`. 6 tools: `searchDocuments` (query+type+site+tag+program+grant+date filters with query-aware snippets), `getDocument`, `getRecentDocuments`, `getDocumentsByTag`, `getSharedWithExternalUsers`, `listSites`. 26 tests passing.
- [x] **F3.6** instrumentl (grants + funders). `lib/connectors/instrumentl.{schema,ts,test}.ts`. 7 tools: `searchGrants`, `getGrant`, `getTrackedGrants` (active pipeline statuses), `getDeadlinesInRange` (sorted ascending with daysUntilDeadline — powers F8.2 grant-ops wow-query), `getFunderProfile`, `getMatchScore`, `searchFunders`. 28 tests passing.
- [x] **F3.7** quickbooks (finance + accounting). `lib/connectors/quickbooks.{schema,ts,test}.ts`. 8 tools: `getCashPosition`, `getRestrictedFunds`, `getRevenueByPeriod`, `getExpensesByCategory` (with pctOfTotal), `getRunwayProjection` (forward-projects cash with exhaustsByMonth), `getProgramBudgetVsActual`, `getPnLSummary`, `searchTransactions`. Powers the F8.3 finance↔programs wow-query. 31 tests passing.
- [x] **F3.8** solana (devnet wired up — the demo money moment). `lib/connectors/solana.{schema,ts,test}.ts`. 6 tools: `getTreasury`, `searchDisbursements`, `getRecentDisbursements`, `getTransaction`, `estimateFee`, `batchPayout`. **batchPayout has two modes: LIVE on Solana devnet (real `@solana/web3.js` transfers + memo program) when `KALI_SOLANA_DEVNET_SECRET_KEY` env var is set with a base58 keypair from a faucet-funded wallet, otherwise SIMULATED with realistic 88-char base58 signatures.** This is the F8.5 onchain money moment. 29 tests passing.
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

**building right now:** phase 3 — 3 connectors left (powerbi, powerautomate, knowbe4) on the bloomerang reference pattern.

**last shipped:** F0.4 drizzle schema, F0.5 project layout, F0.6 env contract, F1.1 connector base interface + registry, F1.2 seed loader (size-aware + cache-keyed), F1.4 zod schema convention, F2.* full master entity graph + 11 connector seeds (small/medium/large), F3.1–F3.8 (bloomerang, salesforce, m365, zoom, sharepoint, instrumentl, quickbooks, **solana w/ live devnet path**) with 266 passing tests.

frank/nicole — you don't need to wait on any of this to start the landing page. work on `app/page.tsx` and add components in `components/marketing/`. avoid touching `lib/` for now (that's tenzin's lane).
