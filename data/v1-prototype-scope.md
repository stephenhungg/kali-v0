# Kali v1 Prototype — Full Scope

_Updated 2026-05-09. The complete build plan for the Kali v1 prototype: every connector, every layer, every demo path. No timeline. Boil the ocean._

---

## Tracks We're Targeting

**HackDavis 2026 — six tracks locked:**

1. **Best User Research** — we have actual customer discovery data through Matthew's dad's network. Cite real conversations. Show the discovery → product loop.
2. **Best Use of Solana** — payouts on Solana (Connector #11): grant disbursements, vendor payments, board stipends, donor refunds. Sub-cent fees, 400ms finality vs ACH's 3-day, $1.50 floor.
3. **Best UI/UX** — Stephen leads. The source-pulse panel + citation chains + animated reasoning trace = the visual differentiator.
4. **Most Challenging Hack** — 11 SaaS integrations + agentic context layer + tenant isolation + audit log + onchain payouts. Surface area speaks for itself.
5. **Best Technically Challenging Hack** — entity resolution across 11 disconnected schemas, hybrid retrieval (semantic + structured), 60+ tool agent w/ parallel tool use.
6. **Best Hack for Social Good** — nonprofits are the canonical underserved-by-AI segment. We're not exploiting this for the track; this is the actual mission.

---

## 0 — North Star

We are building **the agentic context layer for nonprofits**. One product, one demo, one truth: a unified intelligence layer that sits on top of every disconnected SaaS tool a modern nonprofit runs, and lets staff query, reason, and act across the whole stack in plain English.

The v1 prototype must demonstrate, end to end:

1. **Ten real SaaS tools** integrated as connectors (mocked for demo, real-OAuth path scoped).
2. **A unified semantic context layer** — every record from every tool, embedded and entity-resolved into one queryable graph.
3. **An agent runtime** — Claude Sonnet 4.6 with tool use, reasoning across all ten sources in a single query, returning answers with citations.
4. **A chat-first interface** that visibly pulls from multiple sources at once, showing context retrieval as it happens.
5. **A demo flow with four wow-queries** that no other tool on the market can answer.

This document is the contract. Every line below is what we build.

---

## 1 — The Eleven Connectors

The full nonprofit stack we're integrating, plus Solana payouts. Every connector ships as:
- A **TypeScript module** at `lib/connectors/<tool>.ts` exposing `query*` functions consumed by the agent as tools
- A **JSON seed dataset** at `data/seed/<tool>.json` with realistic, internally-consistent records
- A **schema definition** at `lib/connectors/<tool>.schema.ts` (Zod) for validation
- A **real-OAuth path doc** in the connector file documenting the production migration plan

### 1.1 QuickBooks Enterprise Online — Finance & Accounting

**What we expose:**
- `quickbooks.getCashPosition()` — current cash balance across all accounts
- `quickbooks.getRevenueByPeriod(start, end)` — revenue stream breakdown
- `quickbooks.getExpensesByCategory(period)` — categorized spend
- `quickbooks.getRunwayProjection(months)` — projected cash runway
- `quickbooks.getRestrictedFunds()` — donor-restricted fund balances
- `quickbooks.getProgramBudgetVsActual(programId)` — budget variance

**Seed data:** 12 months of P&L, 1,000 transactions, 6 program budgets, 4 restricted funds, projected cash flow forecast. Realistic nonprofit numbers ($2.4M annual budget).

**Real path:** Intuit OAuth 2.0 → QuickBooks Online API v3. Standard, well-documented. ~2 weeks to production-ready.

### 1.2 Salesforce Nonprofit Cloud (NPSP) — CRM

**What we expose:**
- `salesforce.getContact(id)` — full contact record
- `salesforce.searchContacts({ filters })` — query contacts with filters
- `salesforce.getOpportunitiesForContact(contactId)` — gift history
- `salesforce.getCampaignMembers(campaignId)` — campaign participation
- `salesforce.getRelatedAccounts(contactId)` — corporate affiliations
- `salesforce.getCustomFields(objectType)` — org-specific custom fields

**Seed data:** 200 contacts (donors, board members, volunteers, prospects), 80 accounts (corporate sponsors, foundations), 350 opportunities (gifts), 12 campaigns, 50 custom fields covering nonprofit-specific data.

**Real path:** Salesforce OAuth → Bulk API 2.0 + REST API. NPSP-specific custom objects mapped via metadata API. ~3 weeks to production with proper soft-delete handling.

### 1.3 Microsoft SharePoint — File & Document Management

**What we expose:**
- `sharepoint.searchDocuments(query, { siteId? })` — full-text + semantic doc search
- `sharepoint.getDocument(id)` — document metadata + content
- `sharepoint.getRecentDocuments(days)` — recent activity
- `sharepoint.getDocumentsByTag(tag)` — tagged collections
- `sharepoint.getSharedWithExternalUsers()` — external sharing audit

**Seed data:** 200 documents — board minutes, program reports, grant applications, financial statements, policies, HR records, communication plans. Realistic nonprofit document taxonomy.

**Real path:** Microsoft Graph API → SharePoint sites → Files. App-level OAuth with admin consent. Most complex auth flow of the ten. ~3 weeks.

### 1.4 Microsoft 365 — Email, Profiles, Identity

**What we expose:**
- `m365.searchEmail(query, { userId?, dateRange? })` — email search across org
- `m365.getEmailThread(threadId)` — thread context
- `m365.getUser(userId)` — employee profile
- `m365.getCalendar(userId, dateRange)` — calendar events
- `m365.getDistributionLists()` — internal email lists
- `m365.searchTeamsChannels(query)` — Teams chat search

**Seed data:** 30 staff profiles, 1,500 email metadata records (subject, from, to, snippet, date), 8 distribution lists, 200 calendar events, 50 Teams threads.

**Real path:** Same Microsoft Graph auth as SharePoint. Mail.Read.Shared scope requires admin consent for org-wide access. Per-user delegated access for sensitive workflows. ~2 weeks.

### 1.5 Microsoft Power Automate — Workflow Automation

**What we expose:**
- `powerAutomate.listFlows()` — all configured workflows
- `powerAutomate.getFlowRunHistory(flowId)` — execution history
- `powerAutomate.getFlowDefinition(flowId)` — workflow logic
- `powerAutomate.findAutomationOpportunities()` — Kali-specific: analyze patterns and suggest new flows

**Seed data:** 12 active flows (donor receipt automation, board prep, grant deadline alerts, etc.), 6 months of run history, realistic failure/success patterns.

**Real path:** Power Automate Management API. Read-only for v1. Write capability (creating new flows from Kali) is post-v1.

### 1.6 Microsoft Power BI — Analytics & Reporting

**What we expose:**
- `powerBI.listDashboards()` — available dashboards
- `powerBI.getDashboardData(dashboardId)` — current metrics
- `powerBI.queryDataset(datasetId, query)` — DAX query interface
- `powerBI.getKPISnapshot()` — top-level org metrics

**Seed data:** 4 dashboards (donor health, program impact, fundraising pipeline, financial health), 12 datasets, 50 KPIs with 12 months of trend data.

**Real path:** Power BI REST API. Workspace-level access. Embedding tokens for in-Kali visualization. ~2 weeks.

### 1.7 Bloomerang — Donor Management & Online Donations

**What we expose:**
- `bloomerang.getDonor(id)` — full donor record
- `bloomerang.searchDonors({ filters })` — segmentation queries
- `bloomerang.getDonationHistory(donorId)` — gift transactions
- `bloomerang.getEngagementScore(donorId)` — Bloomerang's engagement metric
- `bloomerang.getCommunicationHistory(donorId)` — touchpoints
- `bloomerang.getRecentDonations(days)` — recent giving activity
- `bloomerang.getOnlineDonationForms()` — active donation pages

**Seed data:** 1,200 donors with full lifecycle data, 2,800 donations, 15,000 touchpoints, 6 active donation forms, realistic LYBUNT/SYBUNT cohorts.

**Real path:** Bloomerang REST API with API key auth. Simple. ~1 week.

### 1.8 Instrumentl — Grant Sourcing & Tracking

**What we expose:**
- `instrumentl.searchGrants({ filters })` — grant opportunity search
- `instrumentl.getGrant(id)` — full grant details + funder info
- `instrumentl.getTrackedGrants()` — org's pipeline
- `instrumentl.getDeadlinesInRange(days)` — upcoming deadlines
- `instrumentl.getFunderProfile(funderId)` — funder giving history
- `instrumentl.getMatchScore(grantId)` — Instrumentl's fit score for our org

**Seed data:** 80 grants (mix of tracked + suggested), 40 funder profiles, 25 in-progress applications, 12 awarded grants with reporting requirements.

**Real path:** Instrumentl has limited public API; partnership integration likely required. Backup: web scraping with their permission. ~3 weeks negotiation + integration.

### 1.9 KnowBe4 — Cybersecurity Training & Awareness

**What we expose:**
- `knowbe4.getUserRiskScores()` — per-employee risk
- `knowbe4.getPhishingTestResults(period)` — campaign performance
- `knowbe4.getTrainingCompletion(userId)` — training status
- `knowbe4.getRecentIncidents()` — flagged events
- `knowbe4.getOrgSecurityPosture()` — aggregate score

**Seed data:** 30 employees with risk scores, 6 months of phishing test data, training completion records, 8 flagged incidents.

**Real path:** KnowBe4 Reporting API (KMSAT API). API key auth. ~1 week.

### 1.10 Zoom — Meetings & Phone

**What we expose:**
- `zoom.getMeetings(dateRange, { hostId? })` — meeting history
- `zoom.getMeetingTranscript(meetingId)` — recorded transcript
- `zoom.searchTranscripts(query)` — full-text search across transcripts
- `zoom.getAttendees(meetingId)` — participant list
- `zoom.getPhoneCallLogs(dateRange)` — call records (Zoom Phone)

**Seed data:** 30 meetings (board, donor calls, staff, virtual events), 18 with transcripts, 8 phone calls logged, attendee lists matching Salesforce contacts.

**Real path:** Zoom OAuth + REST API + Webhook for real-time. Cloud Recording access requires paid Zoom tier. ~2 weeks.

### 1.11 Solana Payouts — Onchain Disbursements

**Why this exists:** small foundations and nonprofits bleed 2–3% of every disbursement on wires + bank fees + ACH delays. A single small nonprofit doing $400K/yr in vendor payments + board stipends + grant disbursements + donor refunds loses $8K–12K/yr to payment friction. Solana cuts that to ~$0.0001 per transfer with 400ms finality. This is the strongest social-good narrative on the deck.

**What we expose:**
- `solana.disburseGrant(grantId, recipientWallet, amount)` — pay out an awarded grant
- `solana.payVendor(vendorId, amount, memo)` — vendor payment with onchain memo
- `solana.boardStipend(boardMemberId, amount)` — periodic board comp
- `solana.refundDonor(donationId, amount)` — donor refund (e.g., event cancellation)
- `solana.getTreasuryBalance()` — current onchain treasury
- `solana.getRecentDisbursements(days)` — payout audit trail
- `solana.estimateFee(amount)` — fee estimate (always sub-cent)
- `solana.batchPayouts(payouts[])` — atomic multi-recipient payout

**Seed data:** Devnet wallet pre-funded with 100 SOL. Fictional treasury balance, 30 historical onchain disbursements, 12 vendor wallets, 8 board member wallets.

**Real path:** Solana web3.js + a custodial signing service (Privy or Turnkey) for nonprofits that don't want to manage keys. USDC stablecoin rail for amount-stable disbursements (avoids SOL price volatility for accounting). ~2 weeks for v1, with custodial wallet UX as the hard part.

**Demo magic:** the agent can answer "we just got awarded $50K from the Open Society Foundation, disburse $25K to our partner org's wallet now and stipend the board for this quarter" and execute it onchain in front of the judges with a visible Solana Explorer link to the txn. Sub-second confirmation. That's the moment.

---

## 2 — The Context Layer

The connectors expose data. The context layer makes it queryable, reasoning-ready, and auditable. This is the actual moat.

### 2.1 Entity Resolution

A single donor named Jane Patel exists in:
- Salesforce NPSP as Contact `003abc123`
- Bloomerang as Donor `bl-9821`
- M365 as Calendar attendee `jane.patel@patelindustries.com`
- Zoom as participant `Jane P`
- SharePoint as document author on 3 reports

The context layer resolves these to **one canonical entity** with a stable Kali ID, and every connector record carries a `kali_entity_id` field linking back. Resolution rules:

1. Email match (highest confidence)
2. Full name + organization
3. Phone number normalized
4. Fuzzy name match + at least one corroborating attribute
5. Manual override / confirmation UI for low-confidence matches

Implementation: deterministic rule-based resolver for v1. ML-assisted resolution post-v1.

### 2.2 Semantic Knowledge Base

Every connector record is embedded into a vector store keyed by Kali entity ID + record ID + source.

**Embeddings:** Voyage AI `voyage-3` (best price/perf for retrieval) or OpenAI `text-embedding-3-large` as fallback.

**Storage:** pgvector on Postgres for v1. Pinecone migration path documented.

**Indexed content:**
- Donor profiles + giving narratives
- Email subjects + snippets (not full bodies for privacy)
- SharePoint document text (full content, chunked at 512 tokens)
- Zoom transcript chunks (1024-token chunks with 128-token overlap)
- Grant descriptions + funder narratives
- Custom field values from Salesforce

**Hybrid retrieval:** semantic search (cosine similarity) + structured filters (date, source, entity ID). Top-K=20 with reranking.

### 2.3 Structured Query Interface

Beyond semantic search, the context layer exposes a **structured query DSL** so the agent can ask precise questions:

```typescript
context.query({
  entities: ["donor"],
  filters: [
    { source: "bloomerang", field: "lifetime_giving", op: ">=", value: 5000 },
    { source: "zoom", field: "events_attended_2024", op: ">=", value: 2 },
    { source: "salesforce", field: "employer.matching_gift_program", op: "=", value: true },
  ],
  joinOn: "kali_entity_id",
  limit: 50,
});
```

Compiles to optimized SQL across the connector tables. Returns hydrated entities with all source records linked.

### 2.4 Audit Log

Every query, every retrieval, every agent action is logged with:
- Timestamp
- User ID + tenant ID
- Query string + parameters
- Sources accessed
- Records returned (hashed for privacy)
- Agent action taken (if any)
- Citation chain back to source records

Stored in a separate immutable Postgres table with append-only constraints. Exportable to SIEM systems for nonprofit compliance teams.

### 2.5 Permissions & Tenant Isolation

Every record carries `tenant_id`. Every query is scoped at the API layer. Cross-tenant queries are not just forbidden — they're structurally impossible. Per-tenant pgvector namespaces, per-tenant audit logs, per-tenant rate limits.

---

## 3 — The Agent Runtime

The thing that makes Kali Kali. Not chat. Reasoning.

### 3.0 Architecture Decision: One GOAT Agent

**Locked: single orchestrator agent with all 60+ tools available. Not multi-agent.**

Rejected: a swarm of specialist agents (donor-bot, grants-bot, finance-bot, etc.) coordinated by a router.

**Why single agent wins for v1:**
- **UX:** users want one Kali, not "talk to donor-bot then grants-bot." Single brain matches the brand.
- **Cross-tool reasoning is the moat.** Multi-agent fragments it. Our wow-queries explicitly span 3–5 sources — "lapsed donor whose employer has matching gifts and an active grant cycle in Instrumentl" cannot be answered cleanly by domain-specialist agents.
- **Latency:** multi-agent adds router → specialist → response hops. At least 2× per query. Single agent with parallel tool-use is faster.
- **Cost:** multi-agent doubles or triples token spend. Single agent w/ prompt caching cuts repeated context cost ~90%.
- **Bug surface:** orchestration code is bugs we don't need.
- **Demo narrative:** judges see one brain reasoning, not a system talking to itself.

**How the single agent feels like specialists internally:**
- System prompt has **domain-tagged tool groupings**: `donor`, `grants`, `finance`, `programs`, `comms`, `security`, `payouts`. Tagged in tool descriptions and reinforced in system instructions.
- Heuristics in the system prompt: "for donor-related queries, prefer Bloomerang + Salesforce + M365 first; cross-reference with Zoom for event participation; check Solana treasury only if disbursement context is implicated."
- **Parallel tool use** (Anthropic supports this natively): Claude calls 4+ tools in a single turn when a query needs cross-domain context. The source-pulse panel lights up 4 tiles simultaneously — the visual money shot.
- Internal "think before tool calls" via extended thinking (Claude 4.x): the agent reasons about which tools to call, then executes them in a parallel batch.

**When we'd revisit multi-agent:** post-v1, when a specific workflow demands deep specialization (e.g. a "compliance audit agent" with tightened safety prompts that runs autonomously). For now: one Kali, one brain.

### 3.1 Model

**Primary:** Claude Sonnet 4.6 via Anthropic SDK.

**Why:** best price/perf for tool-use chains, 200K context, prompt caching support, no-retention contract available.

**Fallbacks:**
- Claude Haiku 4.5 for classification, intent detection, simple lookups (10x cheaper)
- Claude Opus 4.7 for the hardest reasoning tasks (donor segmentation strategy, grant strategy)

**Routing logic:** intent classifier (Haiku) decides which model handles the actual query. Most go to Sonnet.

### 3.2 Tool Use

Every connector function is exposed as a tool to the model. ~60 tools total across the 10 connectors. The agent picks tools, executes them, reads results, and chains additional calls until it has enough context to answer.

**Critical patterns:**
- Tools are typed with Zod schemas mirrored to JSON schema for the model
- Tool errors are returned to the model with clear remediation hints (the model retries)
- Long-running tools return a job ID and the agent polls (with a max-iterations cap)
- Tool calls are logged to the audit table with parameters + results

### 3.3 System Prompt

Loaded as a cached prefix (90% cost savings on repeated invocations). Contains:

1. **Identity**: Kali, the agentic context layer for nonprofits
2. **Tools available**: full schema for all 60 tools, grouped by source
3. **Reasoning patterns**: when to call which tool, how to chain, how to cite
4. **Response format**: always cite sources; prefer concise + structured over wall-of-text
5. **Safety rules**: never invent data; if context is missing, say so; never act on external systems without explicit approval
6. **Tenant context**: org name, fiscal year, mission focus, key programs (loaded per tenant from settings)

### 3.4 Memory & Context Management

**Per-conversation memory:** sliding window of last N exchanges, summarized when window fills.

**Per-user memory:** persistent facts about the user (their role, their typical workflows, their favorite reports).

**Per-org memory:** institutional context (programs, key relationships, ongoing campaigns) — loaded into every conversation.

**Implementation:** simple Postgres table for v1. Mem0 or similar post-v1.

### 3.5 Action Layer (Read → Write)

For v1 demo: read-only across all 10 tools (queries return data, agent reasons over it).

For v1.5 (post-hackathon): selective write actions with **human-in-the-loop confirmation**:
- Draft email in MS 365 (Kali drafts, human sends)
- Create task in Salesforce (auto with confirmation)
- Schedule follow-up in Power Automate (auto with confirmation)
- Generate grant draft in SharePoint (auto, human reviews)

Destructive actions (delete, hard mutate) **always require typed confirmation**. Logged to audit trail.

---

## 4 — Frontend

### 4.1 Layout

Three-pane chat interface:

```
┌─────────────────┬───────────────────────┬──────────────────┐
│  history        │  chat                 │  context panel   │
│                 │                       │                  │
│  - donor query  │  user: who are our    │  sources active: │
│  - grant pull   │       lapsed donors?  │  ✓ bloomerang    │
│  - finance      │                       │  ✓ salesforce    │
│  - new chat     │  [kali]               │  ✓ m365          │
│                 │  ─ querying bloomer-  │                  │
│                 │    ang for lapsed... │  retrieved:      │
│                 │  ─ cross-ref'ing      │  - 312 donors    │
│                 │    salesforce...      │  - $147K total   │
│                 │  ✓ found 312 lapsed   │    lapsed value  │
│                 │                       │                  │
│                 │  top segments:        │  citations:      │
│                 │  ...                  │  bl-9821, ...    │
└─────────────────┴───────────────────────┴──────────────────┘
```

### 4.2 Stack

- Next.js 16 App Router (Turbopack)
- TypeScript strict
- Tailwind + shadcn/ui (matches kalilabs.ai design system)
- Framer Motion for source-panel transitions
- Vercel AI SDK for streaming + tool-call rendering
- Server actions for chat persistence

### 4.3 Routes

```
/app                  → marketing (existing kalilabs.ai)
/app/login            → auth (Clerk or Supabase Auth)
/app/dashboard        → tenant overview, integration health
/app/chat             → main chat interface
/app/chat/[id]        → specific conversation
/app/sources          → connected SaaS tools, status, last sync
/app/sources/[tool]   → per-tool config + sync history
/app/agents           → pre-built playbooks, custom agents
/app/audit            → audit log viewer
/app/settings         → tenant + user settings
```

### 4.4 Demo-Specific UX

- **Source pulse animation:** when the agent calls a connector, that connector's tile in the side panel glows + pulses. Shows the agent visibly reasoning across sources in real time.
- **Citation hover:** every claim in the agent's response has a `[1]` style citation. Hover reveals the source record. Click jumps to the connector's record view.
- **Suggested queries:** the four wow-queries pre-loaded as one-click buttons on the empty chat state.

---

## 5 — Auth, Multi-Tenancy, Infra

### 5.1 Auth

**Clerk** for v1. Supports magic links, SSO, MFA, organization management out of the box. Generous free tier for our scale.

Migration path to Supabase Auth or homegrown if Clerk pricing becomes a problem at scale.

### 5.2 Multi-Tenancy

**Logical isolation** by `tenant_id` on every table. Row-level security enforced at the application layer (every query carries `tenant_id`).

**Vector store isolation:** per-tenant pgvector namespaces. No shared embeddings.

**Audit isolation:** per-tenant audit log table partition.

For enterprise customers (post-v1): physical isolation with dedicated DB instances.

### 5.3 Database

Postgres on Neon or Supabase. Schemas:

```
tenants            tenant_id, name, plan, created_at
users              user_id, tenant_id, email, role
connectors         connector_id, tenant_id, type, config_json, sync_state
entities           entity_id, tenant_id, canonical_name, type, attrs
entity_links       entity_link_id, entity_id, source_type, source_record_id
records            record_id, tenant_id, connector_id, raw_data, embedded_at
embeddings         (pgvector) record_id, vector, metadata
conversations      conv_id, tenant_id, user_id, title, created_at
messages           msg_id, conv_id, role, content, tool_calls, citations
agent_runs         run_id, conv_id, msg_id, tools_called, duration, cost
audit_log          audit_id, tenant_id, user_id, action, params, result_hash
```

### 5.4 Hosting

- **App:** Vercel (already setup for kalilabs.ai)
- **DB:** Neon (serverless Postgres, generous free tier, pgvector built-in)
- **Object storage:** Cloudflare R2 (cheaper than S3 for the document content we'll cache)
- **Background jobs:** Inngest or Trigger.dev (event-driven, type-safe)
- **Monitoring:** Axiom for logs, Sentry for errors

### 5.5 Cost Envelope (per tenant, moderate use)

| component | monthly | notes |
|---|---|---|
| Claude inference | $50–100 | with prompt caching |
| Voyage embeddings | $5 | 100K records initial + delta |
| Neon Postgres | $10 | Pro tier per-tenant |
| pgvector | $0 | included with Neon |
| Vercel | $5 | shared across tenants |
| Inngest | $10 | shared |
| **total** | **~$80–130** | |

Pricing: $500–5K/mo per tenant. Margins: 75–85%.

---

## 6 — The Demo Flow

Four queries, in order, that progressively raise the stakes. ~5 minutes total.

### 6.1 Donor Intelligence

> "Find lapsed donors who gave $1K+ in 2024, attended at least 2 events, work at companies with active matching gift programs, and haven't received a re-engagement email in 90 days."

**Tools called:** `bloomerang.searchDonors` → `zoom.getMeetings` (filtered to events) → `bloomerang.getDonationHistory` → `salesforce.getRelatedAccounts` → `m365.searchEmail`.

**Output:** ~14 donors, each with name, last gift, event history, employer match details, last contact date. Cited and exportable.

### 6.2 Grant Operations

> "What grants closing in the next 30 days am I eligible for, and which board members or major donors have ties to those funders?"

**Tools called:** `instrumentl.getDeadlinesInRange` → `instrumentl.getMatchScore` (per grant) → `salesforce.searchContacts` (board members) → `salesforce.getRelatedAccounts` → `sharepoint.searchDocuments` (looking for prior funder relationship docs).

**Output:** 4 grants with deadlines, fit scores, and a list of internal connections per funder. Each connection cited to the underlying record.

### 6.3 Finance ↔ Programs Cross-Check

> "Show our cash runway against projected program spend over the next 90 days. Flag anything from recent SharePoint reports that suggests programs are at risk of going over budget."

**Tools called:** `quickbooks.getCashPosition` → `quickbooks.getRunwayProjection` → `quickbooks.getProgramBudgetVsActual` (per program) → `sharepoint.searchDocuments` (program reports last 90d) → cross-reference for risk signals.

**Output:** Cash position chart, top 3 programs at-risk with citations to specific paragraphs in SharePoint reports flagging the risk.

### 6.4 Automation Discovery

> "Analyze our last 90 days of email patterns and Power Automate run history. Suggest one new workflow we could automate that would save staff at least 5 hours per week."

**Tools called:** `m365.searchEmail` (high-volume patterns) → `powerAutomate.listFlows` (existing) → `powerAutomate.findAutomationOpportunities` (Kali-specific analysis tool).

**Output:** A specific recommendation — e.g. "Auto-acknowledge donations under $500 with personalized thank-yous; current process takes Sarah ~6 hrs/week and 80% of these are templatable." Cited to the email patterns and the Power Automate flow gap.

### 6.5 The Onchain Money Moment

> "We just got awarded $50K from the Open Society Foundation. Disburse $25K to our partner org's wallet for the joint program, stipend the board for this quarter ($1K each, 7 members), and refund the two donors who requested refunds after the gala cancellation."

**Tools called:** `instrumentl.getGrant` (verify award context) → `salesforce.getRelatedAccounts` (partner org) → `bloomerang.getDonor` × 2 (refund recipients) → `solana.getTreasuryBalance` (verify funds available) → `solana.batchPayouts` (atomic execution) → `quickbooks.recordTransaction` × N (post to ledger automatically).

**Output:** Live onchain transaction batch. Solana Explorer link rendered in chat with each txn. Total time: under 3 seconds. Total fee: under $0.01. Ledger entries auto-created in QuickBooks with full audit trail. **This is the wow moment that wins Best Use of Solana, Most Challenging, and Best Hack for Social Good simultaneously.**

### 6.6 Wildcard (judges' Q&A)

The system is open. If a judge says "what about cybersecurity training compliance?" the agent reaches into KnowBe4 and answers live. This is the moment that wins.

---

## 7 — Build Sequence

Six phases. No timeline — execute as fast as we can, in this order, no skipping.

### Phase 1 — Spine

1. Repo scaffold (Next.js 16, Bun, TypeScript strict)
2. Auth (Clerk)
3. Multi-tenant Postgres schema (Neon + pgvector)
4. Tenant onboarding flow
5. Empty dashboard route
6. Vercel deploy w/ kalilabs.ai/app subdomain

### Phase 2 — Connector Framework

1. Connector interface definition (`lib/connectors/base.ts`)
2. Mock data loader system (reads from `data/seed/*.json`)
3. Sync state tracking
4. One reference connector (Bloomerang) end-to-end
5. Connector status UI (the source-pulse animation panel)

### Phase 3 — All 11 Connectors

Build each in order of demo importance:

1. Bloomerang (donor, central to most queries)
2. Salesforce NPSP (cross-references)
3. M365 (email + calendar — touches every workflow)
4. Zoom (transcripts + attendees)
5. SharePoint (documents)
6. Instrumentl (grants)
7. QuickBooks (finance)
8. Solana (onchain payouts — devnet, the demo money moment)
9. Power BI (analytics overlay)
10. Power Automate (workflow discovery)
11. KnowBe4 (cybersecurity)

Each connector ships with seed data, schema, query functions, and a doc page on its own status.

### Phase 4 — Context Layer

1. Entity resolution v1 (rule-based)
2. Embedding pipeline (Voyage AI)
3. pgvector storage with per-tenant namespaces
4. Hybrid retrieval (semantic + filters)
5. Structured query DSL
6. Audit log infrastructure

### Phase 5 — Agent Runtime

1. Anthropic SDK integration with prompt caching
2. Tool registry — all 60 tools wired up
3. System prompt v1 (per-tenant context loading)
4. Streaming chat UI with tool-call rendering
5. Citation chain rendering
6. Suggested queries (the four wow-queries)
7. Conversation persistence

### Phase 6 — Polish & Demo Prep

1. Source-pulse animation system
2. Citation hover/click UX
3. Per-tenant config panel
4. Demo storyboard rehearsal
5. Screen recording for the four queries
6. Live demo dry runs (target: 4-min demo, 1-min Q&A)
7. Pitch deck (3-min variant + 1-min variant)
8. Devpost / submission write-up

---

## 8 — Team Split

| owner | scope | concentration |
|---|---|---|
| **stephen** | spine (auth, db, tenant infra), frontend chat ui, vercel deploy, demo polish | infra + UX |
| **matthew** | all 10 connectors (mocks + schemas + seed data), entity resolution rules, dad-network feedback loop | data + connectors |
| **jake** | agent runtime (claude sdk, tool use, prompt engineering), demo query design, pitch deck | agent + narrative |
| **silas** | demo storyboard + screen recording, devpost + submission, customer narrative threads, ops support during build | comms + ops |

Stephen unblocks everyone on infra. Matthew owns the most surface area (10 connectors) but parallelizable. Jake's agent work depends on connectors landing in order. Silas in parallel from day one.

---

## 9 — Repo Layout

```
kali-app/
├─ app/
│  ├─ (auth)/
│  ├─ (app)/
│  │  ├─ chat/
│  │  ├─ sources/
│  │  ├─ dashboard/
│  │  ├─ audit/
│  │  └─ settings/
│  ├─ api/
│  │  ├─ chat/route.ts          ← streaming chat endpoint
│  │  ├─ tools/[connector]/[fn] ← internal tool router
│  │  └─ sync/[connector]/route.ts
│  └─ layout.tsx
├─ components/
│  ├─ chat/
│  ├─ sources/
│  └─ ui/                       ← shadcn
├─ lib/
│  ├─ connectors/
│  │  ├─ base.ts                ← Connector interface
│  │  ├─ bloomerang.ts
│  │  ├─ salesforce.ts
│  │  ├─ sharepoint.ts
│  │  ├─ m365.ts
│  │  ├─ powerAutomate.ts
│  │  ├─ powerBI.ts
│  │  ├─ quickbooks.ts
│  │  ├─ instrumentl.ts
│  │  ├─ knowbe4.ts
│  │  ├─ zoom.ts
│  │  └─ solana.ts
│  ├─ context/
│  │  ├─ entityResolver.ts
│  │  ├─ embedder.ts
│  │  ├─ retriever.ts
│  │  └─ queryDsl.ts
│  ├─ agent/
│  │  ├─ runtime.ts             ← Claude SDK + tool loop
│  │  ├─ systemPrompt.ts
│  │  ├─ toolRegistry.ts
│  │  └─ memory.ts
│  ├─ db/
│  │  ├─ schema.ts              ← Drizzle schema
│  │  └─ client.ts
│  └─ audit/
│     └─ log.ts
├─ data/
│  └─ seed/
│     ├─ tenant.json            ← rivertown community foundation
│     ├─ bloomerang.json
│     ├─ salesforce.json
│     ├─ sharepoint.json
│     ├─ m365.json
│     ├─ powerAutomate.json
│     ├─ powerBI.json
│     ├─ quickbooks.json
│     ├─ instrumentl.json
│     ├─ knowbe4.json
│     ├─ zoom.json
│     └─ solana.json
├─ scripts/
│  ├─ seed-db.ts
│  └─ embed-all.ts
└─ package.json
```

---

## 10 — Risks

| risk | likelihood | mitigation |
|---|---|---|
| Connector data inconsistency across the 10 sources | high | One canonical seed script generates all 10 from a shared entity graph. Single source of truth. |
| Agent hallucination on missing data | medium | Strict system prompt: "if context is missing, say so." Tool schemas validate outputs. Cite or don't claim. |
| Demo crashes live | medium | Pre-recorded fallback. Local-only deploy for demo machine. Backup laptop. |
| Latency on multi-tool queries (>10s) | medium | Parallel tool execution, prompt caching, optimistic streaming. |
| Embeddings too expensive at scale | low | Voyage > OpenAI on price; per-tenant kbs stay under 100K records. |
| Pgvector slow at scale | low | Fine for v1. Pinecone path documented for >1M records. |
| Auth flow blocking demo | medium | Pre-seeded demo tenant. Skip-login mode for demo machine. |

---

## 11 — Success Criteria

The v1 prototype is complete when:

1. Login → land on the demo tenant ("Rivertown Community Foundation").
2. Chat interface shows all 11 connector tiles in the side panel, all green/connected.
3. The five wow-queries (incl. the onchain money moment) each run end-to-end, return correct cross-tool answers in < 8s, and cite their sources.
4. A judge can ask an arbitrary question that requires reasoning across at least 3 of the 11 tools, and the agent answers correctly with citations.
5. The Solana payout flow executes a real onchain transaction on devnet during the demo with a clickable Solana Explorer link.
5. The audit log shows every tool call from the demo, exportable as CSV.
6. The pitch deck is shipped (3-min and 1-min variants).
7. The demo screen recording is rendered and uploaded to Devpost / kalilabs.ai/demo.
8. Three founders independently can run the full demo without a script, in under 5 minutes.

---

## 12 — Post-v1 Roadmap

Once the prototype lands, immediate priorities (in order):

1. **Real OAuth for Bloomerang + Salesforce** — first two real customers can connect their actual data.
2. **Customer discovery follow-through** — convert dad-network calls into design partner agreements.
3. **Agent action layer** — start with email drafting in MS 365.
4. **Onboarding playbook** — document the 2-week FDE process so it's repeatable.
5. **Real OAuth for the remaining 8 tools** in priority order.
6. **SOC 2 Type 1 audit** kickoff.
7. **YC application.**

---

## 13 — Decision Log

- **2026-05-09**: locked v1 scope at 11 mocked connectors with fully consistent seed data + agent runtime + chat ui. No real OAuth in v1 (Solana is real onchain on devnet — the exception).
- **2026-05-09**: Claude Sonnet 4.6 confirmed as primary model. Haiku for routing, Opus for hardest queries.
- **2026-05-09**: Voyage AI for embeddings, pgvector on Neon for storage.
- **2026-05-09**: Clerk for auth, Vercel for hosting, Inngest for background jobs.
- **2026-05-09**: demo tenant is "Rivertown Community Foundation" — single coherent fictional org seeded across all 11 tools.
- **2026-05-09**: five wow-queries locked: donor intelligence, grant ops, finance↔programs, automation discovery, **onchain money moment** (Solana batch payout).
- **2026-05-09**: **single GOAT agent architecture locked**. One Claude Sonnet 4.6 orchestrator with all 60+ tools, parallel tool-use, domain-tagged tool groupings in system prompt. Multi-agent rejected for v1.
- **2026-05-09**: Solana payouts added as Connector #11 — devnet for demo, USDC stablecoin rail for real path, custodial wallet UX (Privy or Turnkey).
- **2026-05-09**: HackDavis tracks locked: Best User Research, Best Use of Solana, Best UI/UX, Most Challenging Hack, Best Technically Challenging Hack, Best Hack for Social Good.

---

We are that nigga. Let's ship it.
