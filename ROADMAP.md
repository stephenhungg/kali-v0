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
- [x] **F1.3** sync-state tracker (in-memory for now, db-backed later) — `lib/connectors/sync-state.ts` per-connector status (`never|syncing|connected|error`) + `lastSyncAt` + `lastSuccessAt` + `recordCount` + `lastError`. `trackInit()` wraps connector init. Exposed via GET `/api/connectors/status` for the source-pulse panel. 13 tests passing.
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
- [x] **F3.9** powerbi (analytics dashboards). `lib/connectors/powerbi.{schema,ts,test}.ts`. 4 tools: `listDashboards`, `getDashboard` (by kaliId or nameContains), `getKPISnapshot` (flat tile list across all dashboards), `searchTiles`. 19 tests passing.
- [x] **F3.10** powerautomate (workflow automation). `lib/connectors/powerautomate.{schema,ts,test}.ts`. 4 tools: `listFlows` (with failure rate per flow), `getFlow`, `getFlowRunHistory` (sorted newest-first), `findAutomationOpportunities` (flags high-failure / abandoned / broken-trigger flows — powers F8.4 automation discovery). 18 tests passing.
- [x] **F3.11** knowbe4 (cybersecurity). `lib/connectors/knowbe4.{schema,ts,test}.ts`. 6 tools: `getOrgPosture`, `getUserRiskScores` (sorted by risk desc, with department / minRisk / maxTrainingCompletion filters), `getUser`, `getPhishingResults` (org-wide windowed), `getRecentIncidents` (sorted newest-first), `getTrainingCompletion`. 19 tests passing.

## phase 4 — context layer

- [x] **F4.1** entity resolution (rule-based) — `lib/context/entityResolver.ts` scans bloomerang.constituents + salesforce.contacts + m365.users + zoom participants. Confidence ladder: email exact (100) > phone normalized (90) > full-name exact (80) > name substring + corroborating attribute (60) > name substring (40). Plus a `context.entityProfile` "donor dossier" tool that aggregates one entity across every connector in a single call. Registered as a `context` meta-connector (added to ConnectorId). 22 tests passing.
- [x] **F4.2** embedding pipeline — `lib/context/embed.ts` Embedder protocol + OpenAIEmbedder (text-embedding-3-small, default) + VoyageEmbedder (voyage-3, optional cost-optimized) + deterministic FakeEmbedder (256-dim hash sketch, offline). Provider order: `KALI_EMBEDDER` pin > OPENAI_API_KEY > VOYAGE_API_KEY > Fake. L2-normalized vectors so cosine == dot product.
- [x] **F4.3** pgvector storage with per-tenant namespaces — `lib/context/vectorStore.ts` in-memory equivalent (Map keyed by namespace, upsert by source+sourceRecordId+chunkIndex). Production migration to pgvector is a 1:1 schema swap (record_id, vector, metadata columns already in `lib/db/schema.ts`).
- [x] **F4.4** hybrid retriever — `lib/context/semanticSearch.ts` top-K cosine over the vector store, pre-filtered by `sources` / `kali_entity_id` / `metaEq`. Lazy bulk-indexer in `lib/context/indexer.ts` walks every connector's high-signal text (zoom transcripts, sharepoint bodies, m365 emails, instrumentl notes, bloomerang summaries, powerbi tile titles, powerautomate descriptions). Exposed as `context.semanticSearch` + `context.rebuildIndex` tools. 35 new tests passing.
- [ ] **F4.5** structured query DSL (typed, compiles to SQL)
- [x] **F4.6** audit log infrastructure (immutable, append-only) — `lib/audit/log.ts` AuditLog class, per-tenant Map, `makeToolContext()` factory, CSV export. 16 tests passing.

## phase 5 — agent runtime

- [x] **F5.1** anthropic SDK wired up with prompt caching — `lib/agent/runtime.ts` upgraded to `claude-sonnet-4-6` with `cache_control: { type: "ephemeral" }` on the system prompt + tools array tail. ~90% input-token savings after first turn. Tracks `cache_read_input_tokens` in RunResult.
- [x] **F5.2** tool registry — all 69 connector functions exposed as anthropic tools via `lib/agent/runtime.ts::toAnthropicTools()`. zod 4 → JSON Schema conversion with `$schema` stripped. Side-effect imports in `lib/agent/registrations.ts` register all 11 connectors at startup.
- [x] **F5.3** system prompt v1 (cached prefix, domain-tagged tool groupings, citation rules) — Kali identity + tenant context + per-domain reasoning approach + citation requirement + dynamic tool inventory (built from `listConnectors()` so it stays in sync as connectors evolve).
- [x] **F5.4** streaming chat endpoint (`app/api/chat/route.ts`) — SSE stream of `start | tool_call | tool_result | text | done | error` events. Backed by `lib/agent/stream.ts::runStream()` async generator.
- [ ] **F5.5** tool-call rendering in the message stream — frontend lane (the SSE protocol carries every event the UI needs)
- [x] **F5.6** parallel tool-use surfacing — `runStream` emits a `tool_call` event per parallel block BEFORE handlers run, then `tool_result` events as they complete. Tested with multi-tool turns.
- [ ] **F5.7** citation chain rendering — backend ready (`done.citations[]` carries every kali_entity_id surfaced); frontend lane to render
- [x] **F5.8** conversation persistence — `lib/agent/conversations.ts` in-memory store: createConversation / getOrCreate / appendMessage / listConversations / deleteConversation. Auto-titles from first user message. Persisted from the chat endpoint as the SSE stream flows.

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

**🟢 backend feature-complete vs the v1 spec.** Every phase 1–5 backend item is shipped. Frontend lanes (F5.5 / F5.7 / phase 6) are next.

### what's done (513 tests passing)

- **All 11 SaaS connectors** (F3.1–F3.11) on the framework: bloomerang, salesforce, m365, zoom, sharepoint, instrumentl, quickbooks, solana (live devnet path env-gated), powerbi, powerautomate, knowbe4. **74 tools** wired to Claude.
- **`context` meta-connector** with 5 cross-source tools (F4.1 entity resolver + dossier, F4.2-4.4 embeddings + vector store + semantic search, F4.5 cross-source query DSL with multi-source intersection on kali_entity_id).
- **Audit log** (F4.6) per-tenant, append-only, CSV export.
- **Sync-state tracker** (F1.3) feeding the source-pulse panel.
- **Agent runtime** (F5.1–5.3) on `claude-sonnet-4-6` with prompt caching + parallel tool use + dynamic system prompt + zod→JSON Schema conversion.
- **Streaming SSE chat endpoint** (F5.4 + F5.6) at `POST /api/chat` emitting `start | tool_call | tool_result | text | done | error`.
- **Conversation persistence** (F5.8) in-memory.
- **Citation pipeline** (F5.7 backend): system prompt instructs `[N]` markers, `done` event carries `citationsCited`, helper at `lib/agent/render.ts` tokenizes the answer into `text|chip` spans for the UI.

### HTTP API surface

| route | method | purpose |
|---|---|---|
| `/api/chat` | POST | SSE agent stream |
| `/api/chat` | GET | conversation history |
| `/api/conversations` | GET / POST | list / create |
| `/api/conversations/[id]` | GET / DELETE | one / delete |
| `/api/connectors/status` | GET | per-connector sync state |
| `/api/tools` | GET | full tool inventory + schemas |
| `/api/audit` | GET | audit trail (JSON or `?format=csv`) |
| `/api/warmup` | POST / GET | pre-load + index for fast first-query |

### scripts

- `bun run sanity` — offline backend smoke test (no API keys)
- `bun run agent "<query>"` — CLI agent run
- `bun run demo` — fire the 5 wow queries against live Anthropic
- (on `tenzin/scroll-fx-library` only) `bun run solana:setup` — devnet keypair + airdrop + env-var print

### what's NOT shipped here

- **Frontend chat UI** (F5.5 visual tool-call rendering, F5.7 visual citation chips, phase 6 layout) — frank/nicole/stephen lane. Backend hands them everything they need over the SSE protocol.
- **Auth** (phase 7) — Clerk wiring deferred; demo runs as the seeded "Rivertown Community Foundation" tenant.
- **Real OAuth** for any SaaS connector — every connector still reads from the seeded fixture. Production migration is a transport swap per the per-file `Real-OAuth path` comments.
- **pgvector** — current vector store is in-memory. Schema-compatible swap path documented in `lib/db/schema.ts`.

frank/nicole — you don't need to wait on any of this to start the landing page. work on `app/page.tsx` and add components in `components/marketing/`. avoid touching `lib/` for now (that's tenzin's lane).
