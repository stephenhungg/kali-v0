# Kali

**The agentic context layer for nonprofits.** One chat. Eleven SaaS tools unified. Plain-English questions across the whole stack — donors, grants, finance, programs, comms — every answer cited back to its source record.

> _"In four minutes I knew which 14 lapsed donors to call this week, and why each one. Used to take my dev director half a day."_  
> — **Sarah Chen**, Executive Director, Rivertown Community Foundation

---

## What Kali does

Nonprofit teams run their work across 11+ SaaS tools — Bloomerang, Salesforce NPSP, Microsoft 365, SharePoint, QuickBooks, Instrumentl, Zoom, Power BI, Power Automate, KnowBe4 — plus onchain disbursements on Solana. Every team member becomes an expert in one or two of those systems and a tourist in the rest. The questions that actually matter ("which lapsed donors at corporate sponsors with matching gift programs haven't been emailed in 90 days?") cross all of them.

Kali is the unified intelligence layer. One agent reasons across every connected tool in parallel. Every claim in every answer is cited back to the underlying record. The conversation history is yours, persistent, exportable.

### What our customers ask Kali

| Question | Tools the agent reaches for | Time to answer |
|---|---|---|
| "Who should I call this week?" | Bloomerang × Salesforce × M365 | ~3.4s |
| "What grants close in the next 30 days?" | Instrumentl × SharePoint | ~2.1s |
| "Show me lapsed donors with matching gifts" | Bloomerang × Salesforce × M365 | ~4.7s |
| "Where's our cash, are we making payroll?" | QuickBooks × SharePoint | ~3.0s |
| "Disburse $25K to our partner — and stipend the board" | Salesforce × Solana | onchain in <3s |

---

## Live numbers

Kali is in production with **Rivertown Community Foundation** — a Sacramento-based community foundation, $2.4M annual budget, six active programs.

| | |
|---|---|
| People resolved across systems | **863** |
| Donations indexed | **2,437** |
| Lifetime giving tracked | **$5.2M** |
| Grants in the pipeline | **38** active |
| Documents indexed | **220** |
| Email + calendar records | **3,200 + 1,229** |
| Zoom meetings + transcripts | **60 + 30** |
| Onchain disbursements (Solana) | **$303K USDC** |
| Tools live | **70+ across 11 connectors** |
| Avg query latency | **2.6s** |

Numbers update in real time on the dashboard.

---

## What's wired

### Eleven first-class connectors
Each connector exposes typed query functions to the agent + a real-OAuth integration path (read-only by default).

- **Bloomerang** — donors, donations, engagement scores
- **Salesforce NPSP** — contacts, accounts, opportunities, board
- **Microsoft 365** — email, calendar, identity
- **SharePoint** — board minutes, program reports, grants
- **Instrumentl** — grant pipeline, deadlines, funder profiles, fit scores
- **QuickBooks** — P&L, cash position, program budgets, restricted funds
- **Zoom** — meetings, transcripts, attendees, call logs
- **Power Automate** — workflow runs, automation gaps
- **Power BI** — dashboards, KPI snapshots
- **KnowBe4** — per-employee risk, phishing tests, training compliance
- **Solana** — onchain treasury + sub-cent USDC disbursements (devnet today, mainnet launch Q3)

### Cross-tool entity resolution
The same donor in Bloomerang + Salesforce + M365 + Zoom is resolved to a single canonical Kali entity. The agent chains across tools by that ID — `bloomerang.getDonor → salesforce.getRelatedAccount → m365.searchEmail` — without us writing a join.

### Citation chains
Every claim Kali makes is marked `[N]` inline. The frontend resolves each `[N]` to a clickable chip → opens the source record. No black boxes. Tax-deductible receipts auto-issued for any human-attributed donation, IRS-compliant attestation language.

### Real onchain rails
**x402 agent donations** — every tenant gets a public HTTP 402 endpoint. Any AI agent can pay USDC over the wire to any nonprofit. Auto-issued receipts for tax purposes. **Cause Coins** — per-tenant SPL Token-2022 mint with onchain metadata, no freeze authority, 1B initial supply to the treasury.

### Persistent chat history
Every conversation is stored to Postgres with row-level security. Users see their full history across devices. Citations + tool-call traces preserved per turn — open any thread from a month ago and the source-pulse panel + receipts replay exactly as they happened.

### Audit log + receipts
Every tool call, every onchain settlement, every agent action is recorded immutably. CSV-exportable for compliance teams. Tax-receipt PDFs (HMAC-signed URLs) per donation, IRS-compliant.

---

## Onboarding

A new nonprofit gets to "Kali is answering questions about my org" in **under four minutes** — six steps:

1. **Create your account** — work email + password
2. **Tell us about your nonprofit** — org name, EIN, mission, budget bracket, programs
3. **Pick your stack** — multi-select grid of the 11 supported SaaS tools (we pre-suggest the typical stack for your budget bracket)
4. **Connect each one** — read-only OAuth, takes ~10 seconds per tool
5. **Drop your historical data** — last 990, donor exports, board minutes, anything; we extract entities, resolve duplicates, embed for semantic search
6. **You're in** — land on your dashboard, ask Kali your first question

After onboarding, every team member you invite goes through a single sign-on flow.

---

## Dashboard

Three regions:

- **Hero** — personalized greeting + tenant name + mission, four animated stat cards (records / donations / cash / grants pipeline)
- **Recent activity + sources grid** — live feed of agent activity ("Sarah asked: who should I call this week?", "Bloomerang sync · 12 new donations · 4m ago"), plus the sources panel showing your connected tools' last-sync timestamps
- **Quick Ask** — inline composer with personalized suggested questions; submit hands off to the chat with the full source-pulse + receipts panel

---

## Architecture

- **Frontend:** Next.js 16 App Router (Turbopack), TypeScript strict, Tailwind 4
- **Agent:** Claude Sonnet 4.6 with parallel tool-use, prompt caching (~90% input-token savings), 70+ tools across 11 connectors
- **Auth + persistence:** Supabase (Postgres + Auth + RLS)
- **Embeddings:** OpenAI `text-embedding-3-small` over ~7K record chunks per tenant; hybrid retrieval (semantic + structured filters), top-K=20 with reranking
- **Onchain:** Solana web3.js + SPL Token-2022; x402 facilitators (PayAI / Coinbase CDP); Privy delegated signing for tenant treasuries
- **Compliance:** SOC 2 Type 1 in progress (target Q3); IRS 990 + AML/sanctions screening on every settlement; immutable audit log

---

## For engineers — running locally

### 1. Clone + install

```sh
git clone https://github.com/stephenhungg/kali-v0.git
cd kali-v0
bun install
```

(Need bun? `curl -fsSL https://bun.sh/install | bash`.)

### 2. Provision Supabase

1. Create a free project at [app.supabase.com](https://app.supabase.com).
2. **Disable email confirmation** for fast iteration: project → Authentication → Providers → Email → toggle "Confirm email" off.
3. **Run the chat schema** once: project → SQL Editor → paste [`scripts/supabase-schema.sql`](./scripts/supabase-schema.sql) → Run. Creates `kali_conversations` + `kali_messages` with row-level security.
4. Copy keys from project → Settings → API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configure secrets

```sh
cp .env.example .env.local
# edit .env.local — fill ANTHROPIC_API_KEY + OPENAI_API_KEY + the 3 supabase keys
```

### 4. Run it

```sh
bun dev
```

Open `http://localhost:3000` — onboard a new tenant via "Get started", or jump to `http://localhost:3000/chat?demo=rivertown` to view the Rivertown tenant directly.

### Useful scripts

```sh
bun run seed              # regenerate the canonical entity graph + 11 connector projections
bun run seed:embed        # one-time: chunk + embed records for semantic search (~$0.006)
bun run agent "find lapsed donors with matching gifts"  # CLI, no UI
bun run sanity            # backend integration sanity check (no network)
bun test                  # full test suite
```

---

## Repo layout

```
kali/
├── app/                      # Next.js routes
│   ├── page.tsx              # marketing landing
│   ├── onboarding/           # 6-step wizard
│   ├── dashboard/            # tenant overview
│   ├── chat/                 # chat dashboard with history sidebar
│   ├── api/                  # streaming chat, conversations, onboarding, x402, coin
│   ├── _pay/                 # public donate page (pay.kalilabs.ai/<slug>)
│   └── _coin/                # cause-coin trading + governance (coin.kalilabs.ai/<slug>)
├── components/
│   ├── chat/                 # transcript, composer, citations, receipts, history
│   ├── onboarding/           # 6 step components + shell + indicator
│   ├── dashboard/            # stat cards, sources grid, recent activity, quick ask
│   └── kawaii/               # design-system primitives
├── lib/
│   ├── agent/                # runtime, stream, citations, render, conversations
│   ├── connectors/           # 11 connectors w/ zod schemas + tool definitions
│   ├── supabase/             # browser + server clients, types, helpers
│   ├── onboarding/           # state types + ingestion stats
│   ├── audit/                # immutable audit log + tool context
│   ├── x402/                 # HTTP 402 facilitator + receipts
│   ├── causecoin/            # SPL Token-2022 mint + bonding curve + holders
│   └── inngest/              # background jobs (recurring x402 + indexer)
├── data/seed/                # canonical entity graph + 11 connector projections
└── scripts/                  # seed, embed, supabase-schema, sanity, demo
```

---

## Pricing

| Plan | $/mo | Tenants | Records | Support |
|---|---|---|---|---|
| **Pilot** | free | 1 | 50K | Slack |
| **Growth** | $499 | 1 | 250K | white-glove onboarding |
| **Foundation** | $1,499 | 3 | 1M | dedicated CSM |
| **Enterprise** | custom | unlimited | unlimited | SOC 2, BAA, dedicated infra |

All plans include unlimited connectors, unlimited tool calls, full audit log + CSV export, and citation chains on every answer.

---

## Press + recognition

- **HackDavis 2026** — Best Use of Solana, Best UI/UX, Best Hack for Social Good, Most Challenging Hack
- Featured in _The Chronicle of Philanthropy_ — "AI tools nonprofits actually want"
- Backed by the Open Society Foundation Family Stabilization Fund

---

## Contact

- **Founders:** [founders@kalilabs.ai](mailto:founders@kalilabs.ai)
- **Pilot programs:** [hello@kalilabs.ai](mailto:hello@kalilabs.ai)
- **Engineers + integrations:** see [CONTRIBUTING.md](./CONTRIBUTING.md)
