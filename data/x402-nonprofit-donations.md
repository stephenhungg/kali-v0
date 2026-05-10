# x402 Agent Donations — Spec

_Version 0.1 · 2026-05-10 · Author: tenzin (with stephen hung). Status: proposal, awaiting team review._

---

## 0. TL;DR

Kali becomes the **first nonprofit infrastructure that natively accepts agent-driven donations over [x402](https://www.x402.org/)**. Every nonprofit on the platform gets a public payment endpoint that AI agents (Claude, ChatGPT, custom agents, autonomous research bots) can pay in USDC over HTTP without any account, login, or platform integration. Settlements occur on Solana in ~400ms with sub-cent fees. Receipts are auto-issued, tax-status flagged based on attribution, and ingested into the agent's audit log + the nonprofit's CRM (Bloomerang / Salesforce NPSP).

Why this matters now: x402 hit ~165M transactions and ~$600M annualized volume by Q1 2026. Agent-to-agent commerce is no longer hypothetical, and nonprofits are missing from that flow entirely. Kali plants a flag.

Hackathon framing: stacks **Best Use of Solana**, **Best Hack for Social Good**, **Most Technically Challenging**, and **Best UI/UX** in a single demo.

---

## 1. Background — what is x402

x402 is an open payment protocol from Coinbase that revives the long-dormant `HTTP 402 Payment Required` status code as a standard for agentic + machine-to-machine payments. Spec is open, foundation-governed, currently chaired by Coinbase + Cloudflare + the Solana Foundation.

The protocol flow:

```
1. Client requests resource:           GET /donate/rivertown
2. Server replies 402 + payment terms: HTTP 402 Payment Required
                                       Body: { x402Version, accepts: [...] }
3. Client constructs + signs payment:  signs USDC transfer to recipient
4. Client retries with proof:          GET /donate/rivertown
                                       X-Payment: <base64 JSON>
5. Server verifies + settles via       (server submits tx to chain or to a
   facilitator                          facilitator endpoint)
6. On confirmation:                    HTTP 200 + content/receipt
                                       X-Payment-Response: <receipt>
```

Key headers:

- **`X-Payment` (request)** — base64-encoded JSON: `{ x402Version: 1, scheme: "exact", network: "solana-mainnet" | "solana-devnet" | "base-mainnet" | ..., payload: { serializedTransaction: "<b64>" } }`
- **`X-Payment-Response` (response)** — base64-encoded JSON receipt

Networks supported (as of May 2026): Solana mainnet/devnet, Base, Polygon, Arbitrum, World. Kali targets **Solana** (mainnet for production, devnet for the hackathon demo) because:
- Sub-cent fees and 400ms finality (vs Base's ~2s + L2 fees)
- Stephen + the team's existing Solana experience
- USDC on Solana mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (mainnet), `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (devnet)

Facilitator landscape:
- **PayAI Network** (https://payai.network) — Solana-first facilitator, generous free tier, recommended for v1
- **Corbits** (https://corbits.dev) — Solana-first SDK, simpler ergonomics
- **Coinbase CDP facilitator** — 1,000 free txs/month, then $0.001/tx; multi-chain; brand recognition matters for nonprofit trust
- **Self-hosted (Stakefy fork)** — open source, 0.5% fee model, run our own infra

Decision: **start with PayAI**, allow per-tenant override. Coinbase facilitator as fallback. Self-host post-traction.

---

## 2. Why this matters for nonprofits

### 2.1 Three flows worth supporting

#### A. Human-attributed agent donations (the core use case)
A user tells Claude or ChatGPT: _"set up a $25/month donation to a youth mentorship nonprofit in Sacramento."_ The agent uses Kali's nonprofit directory (or any directory built on top of x402), discovers Rivertown Community Foundation, opens a recurring x402 subscription. Each month the agent autonomously pays $25 USDC. Kali ingests the payment, attributes it to the named human donor (via wallet → identity binding the user authorized once), and issues a tax-deductible receipt because the gift originated from a human-controlled wallet via a delegated session. The donor has now given $300/year with one consent flow and no ongoing friction.

This is **better than any current digital giving rail** — Stripe Donate has 2.9% + 30¢ per transaction, Bloomerang's online forms have 3-5% all-in, ACH donor-advised-funds take days to clear. x402 is sub-cent fees, instant settlement, and the "agent setup" is way more frictionless than recurring credit card UX.

#### B. Autonomous agent micro-donations
Research agents pay nonprofits when they consume their public data. Example: a climate-research agent pulls a region's water-rights data from a coalition of small nonprofits → x402-pays each of them $0.05 → the nonprofits get a sustained passive revenue stream from the AI economy without ever fundraising or shipping invoices. Aggregate value at $billion-volume agent economy = real money to small orgs.

These are NOT tax-deductible (no human donor of record), but they _are revenue_, treated as program service revenue or earned income. Bookkeeping flag: `agent_income`, not `contribution`.

#### C. Agent-to-agent program payments
A foundation's grant-administration agent x402-pays a recipient nonprofit's program-execution agent for delivery of services, milestone-by-milestone, with onchain proof of payment. Example: Open Society awards $200K to Rivertown for their Workforce Development program → the OSF agent x402-pays Rivertown's agent $50K on Q1 milestone delivery → Rivertown's agent x402-pays partner orgs for sub-deliverables → all auditable, no wires, no invoices.

Replaces the worst part of foundation grant operations (paperwork between grantor and grantee, slow disbursement, confused accounting).

### 2.2 Why nonprofits should care about being x402-native

- **Brand**: be the org that "moves on the agent economy" before peers. Forward-looking foundation funders care.
- **Cost**: existing digital giving rails take 2.9–5%. x402 takes ~0%.
- **Speed**: 400ms vs 2-5 day ACH.
- **New revenue surface**: research agents, data marketplaces, AI-assisted philanthropy advisors will route capital through whichever rail accepts it. Don't be Blockbuster.
- **Differentiation**: Kali is the only platform offering this. Nonprofits switching to Kali get x402 as a value-add, not a separate integration project.

---

## 3. Architecture

### 3.1 Surface

Each tenant on Kali gets a public x402 endpoint:

```
https://pay.kalilabs.ai/<tenant-slug>          (one-time donation)
https://pay.kalilabs.ai/<tenant-slug>/recurring (subscription)
https://pay.kalilabs.ai/<tenant-slug>/program/<program-id> (program-restricted)
https://pay.kalilabs.ai/<tenant-slug>/grant/<grant-id>     (grant disbursement endpoint, A2A)
```

These are public unauthenticated endpoints. The nonprofit's Solana treasury wallet is the recipient. Kali's role: handle the protocol dance + verify settlement + persist receipts + ingest into the audit log + sync to CRM.

### 3.2 Components

```
                                             ┌───────────────────────────────┐
agent (Claude/GPT/custom)                    │   Kali x402 connector         │
        │                                    │                               │
        │  GET /<tenant>                     │   handlers/x402.ts            │
        ├────────────────────────────────────►   - 402 quote                 │
        │                                    │   - X-Payment verify          │
        │  402 + accepts[]                   │   - facilitator settle        │
        ◄────────────────────────────────────┤   - receipt issue             │
        │                                    │   - kali_entity_id resolve    │
        │  GET /<tenant> + X-Payment         │                               │
        ├────────────────────────────────────►                               │
        │                                    │   PayAI facilitator           │
        │                                    │   ←──────────────────────►    │
        │  200 + X-Payment-Response          │                               │
        ◄────────────────────────────────────┤   audit log (postgres)        │
                                             │   ↓                           │
                                             │   Bloomerang / SF NPSP        │
                                             │   sync (soft credit)          │
                                             └───────────────────────────────┘
```

### 3.3 Where it lives in kali-v0

Following Matty's existing connector framework:

```
kali-v0/
├── lib/connectors/
│   ├── x402.ts                ← connector + tools (~250 LOC)
│   └── x402.schema.ts         ← Zod schemas for receipts, accepts, payloads
├── app/api/x402/
│   └── [tenant]/route.ts      ← Next.js route handler — the actual payment endpoint
├── lib/x402/
│   ├── verifier.ts            ← Solana tx verification (against expected recipient/amount/mint)
│   ├── facilitator.ts         ← PayAI client (or self-hosted)
│   ├── receipt.ts             ← issue + sign receipts
│   └── attribution.ts         ← human vs autonomous classifier
└── lib/db/schema.ts           ← + x402_receipts table
```

Hooks into existing infra:
- **Solana connector** (`lib/connectors/solana.ts`): adds a `getX402Receipts` tool, treasury balance now reflects x402 inflows
- **Bloomerang connector**: x402 receipts auto-create soft-credit transactions
- **Salesforce connector**: x402 receipts auto-create Opportunity records, Type = "Agent Donation"
- **Audit log**: every receipt is an immutable entry, signed
- **Agent runtime**: new tools `x402.getRecentDonations`, `x402.getRecurring`, `x402.cancelRecurring`, `x402.summarizeAgentRevenue`

---

## 4. API contract

### 4.1 Inbound — accepting payments

```
GET /api/x402/<tenant-slug>
```

**402 Response (no payment):**
```json
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana-mainnet",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "payTo": "<tenant-treasury-pubkey>",
      "maxAmountRequired": "10000000",
      "minAmountRequired": "100000",
      "description": "Donate to Rivertown Community Foundation",
      "mimeType": "application/json",
      "outputSchema": { "$ref": "https://kalilabs.ai/schemas/x402-receipt.json" },
      "extra": {
        "kali_entity_id": "tenant_rivertown",
        "ein": "82-3491582",
        "tax_status": "501(c)(3)",
        "min_human_amount": "1000000",
        "min_autonomous_amount": "100000"
      }
    }
  ],
  "error": null
}
```

`maxAmountRequired` and `minAmountRequired` are USDC base units (10^6). `minAmount` is enforced to prevent dust attacks ($0.10 floor, raised to $1.00 for human-attributed flows).

**200 Response (after valid X-Payment):**
```json
HTTP/1.1 200 OK
Content-Type: application/json
X-Payment-Response: <base64 receipt>

{
  "receipt": {
    "id": "rcpt_abc123",
    "kali_entity_id": "rcpt_abc123",
    "tenant_kali_entity_id": "tenant_rivertown",
    "amount_usdc": 25.00,
    "tx_signature": "5j...xY",
    "explorer_url": "https://explorer.solana.com/tx/5j...xY",
    "received_at": "2026-05-10T04:13:18Z",
    "attribution": "human" | "autonomous" | "unknown",
    "attribution_proof": { ... } | null,
    "tax_deductible": true | false,
    "tax_receipt_url": "https://kalilabs.ai/r/rcpt_abc123" | null,
    "memo": "Climate giving subscription via Claude",
    "synced_to_crm": true
  }
}
```

### 4.2 Outbound — agent donating

Standard x402 client SDK. We bundle a thin wrapper for Kali agents (so `kali_donate_via_x402` is a tool the orchestrator can call when a user query implies "donate to X"):

```ts
import { wrap } from "@payai/x402-client"; // or coinbase SDK
import { connection, kaliWallet } from "./solana";

const handler = createPaymentHandler(kaliWallet, USDC_MINT, connection);
const fetchWithPayer = wrap(fetch, { handlers: [handler] });

const res = await fetchWithPayer("https://pay.kalilabs.ai/rivertown", {
  method: "POST",
  headers: { "X-Donation-Memo": "Q3 climate giving" },
});
const { receipt } = await res.json();
```

### 4.3 Recurring subscriptions

x402 v1 doesn't have native recurring. We implement on top:

- Client POSTs `/api/x402/<tenant>/recurring` with `{ amount, period: "monthly" | "weekly", end_date }`. The first payment proves intent + funds.
- Kali stores a recurring schedule keyed by the payer wallet.
- A cron worker (Inngest) runs at the period boundary, requests a 402 from itself, and if the payer's wallet has registered a delegated signing session (via Privy or similar), settles automatically. Otherwise emits a webhook to the payer with a "click to confirm" link.
- v1 (hackathon) demos with a single immediate payment + scheduled "next charge in 30 days" stub. Real recurring is post-hackathon.

---

## 5. Implementation plan

### 5.1 Phase 1 — minimal demo path (~6 hours, hackathon-shippable)

1. **Solana wallet pre-funded on devnet** (already done — `EMc4KPGgmQAZJkopMr4iCc2i7ZJ9s6jSFXe6rgVyiocS`)
2. **Add deps**: `@solana-foundation/x402-server` or `@payai/x402-server` + their client equivalents
3. **Route handler** at `app/api/x402/[tenant]/route.ts`:
   - On `GET` without `X-Payment`: 402 with the accepts array
   - On `GET` with `X-Payment`: parse, verify the inner Solana tx (recipient = tenant treasury, mint = devnet USDC, amount within bounds), submit to devnet, wait for confirmation, issue receipt
   - On `POST /recurring`: accept first payment, persist subscription stub, return next-charge timestamp
4. **Receipt persistence**: add `x402_receipts` table to drizzle schema
5. **Connector**: `lib/connectors/x402.ts` exposes `getRecentDonations`, `summarizeAgentRevenue` tools to the agent
6. **Demo client script**: `scripts/x402-donate.ts` — a tiny client that pays $25 USDC to the tenant. Used in the live demo to prove end-to-end works.

### 5.2 Phase 2 — production hardening (post-hackathon, ~2 weeks)

1. **Multi-tenant treasury management**: each tenant has their own Solana wallet, managed by Privy (server wallets) or Squads (multi-sig)
2. **Mainnet support**: env-keyed `KALI_X402_NETWORK=solana-mainnet`
3. **Real recurring**: scheduled-payments engine via Inngest + Privy delegated sessions
4. **Tax receipt PDFs**: auto-generate IRS-compliant receipts via `pdf-lib`, link via `tax_receipt_url`
5. **AML/sanctions**: TRM Labs or Chainalysis hook on every inbound wallet — refuse if flagged, hold in escrow if mid-risk
6. **Bloomerang/Salesforce sync**: write each receipt as a soft credit / Opportunity
7. **Discoverability**: `pay.kalilabs.ai/.well-known/x402-directory.json` lists all tenants accepting x402, structured for agent crawlers
8. **Dashboard**: per-tenant view of agent donations, top paying agents, revenue trend

### 5.3 Phase 3 — agent-economy native features

1. **Quote API**: agents can pre-quote donations with optional metadata (memo, designation, restricted-to-program)
2. **Receipt verification API**: any 3rd-party can verify a receipt by ID + signature
3. **Agent reputation passport**: track agent wallets that have donated, surface "top-philanthropic-agent" leaderboards (creates positive incentives in the agent economy)
4. **A2A grant rails**: foundations can disburse via x402 to Kali tenants, gets us into the foundation segment as a strategic lever
5. **MCP integration**: expose every Kali x402 endpoint as an MCP tool, agents can discover + pay in one step

---

## 6. Demo flow (HackDavis 2026)

**Setup (visible to judges):** Kali's web UI shows Rivertown's chat, with a side panel showing the source connectors lit up.

**Demo line 1 (40s):** Operator types in chat:
> _"Watch this. I'm going to ask Claude on my phone to donate $25 to climate work in Sacramento."_

Operator pulls up Claude on phone, asks: _"Donate $25 USDC to a Sacramento youth mentorship nonprofit on my behalf using x402."_

Claude uses Kali's directory MCP, finds Rivertown, hits `pay.kalilabs.ai/rivertown`, gets 402, signs the payment, retries, receives receipt.

**Demo line 2 (15s):** Live on the projector:
- Solana Explorer link appears in Claude's response (real on-chain tx, devnet, ~400ms confirmation)
- Kali's chat side panel: Solana tile pulses, Bloomerang tile pulses (soft credit auto-sync), Salesforce tile pulses (Opportunity created)
- Kali's audit log shows the receipt timestamp

**Demo line 3 (40s):** Operator queries Kali:
> _"How much have we received via x402 this hour, and which donors are tied to existing CRM records?"_

Agent runs:
1. `x402.getRecentDonations(window: 1hour)` — pulls the receipt
2. `bloomerang_get_donor` — checks if the wallet is bound to an existing donor
3. `salesforce_get_account` — checks for matching corporate sponsor

Returns:
> "Received 1 donation via x402 in the last hour: $25 USDC from wallet `Cz...8K`, attributed to Stephen Hung (kali_entity_id ppl_001234, existing major donor in Bloomerang). I've added a soft credit to his Bloomerang record and tagged the Opportunity in Salesforce as 'Agent Donation'. Tax-deductible: yes (delegated human session via Privy)."

**Closing line:** _"This is the only nonprofit infrastructure that natively accepts agent-driven donations. There are 69,000 active x402 agents today moving $50M cumulative volume, and that's six months in. Nonprofits should be the first to get paid by the agent economy, not the last."_

Judges' jaws hit the floor. We win Solana track. We win Social Good track. We win Most Challenging. We win UI/UX.

---

## 7. Risks + Mitigations

| risk | impact | mitigation |
|---|---|---|
| **Tax-deductibility error** — issuing tax-deductible receipts for autonomous-agent donations is fraud | high — IRS revocation of 501(c)(3) status | Strict attribution classifier. Default = `unknown`, never tax-deductible unless we have a signed Privy/Turnkey delegation proof binding the wallet to a human's verified identity. Receipt clearly flags `tax_deductible: false` for unknown attribution. |
| **AML / sanctions** — agent wallet is OFAC-flagged | high — fines, reputation | TRM Labs or Chainalysis pre-settlement check on every inbound wallet. Refuse settlement if flagged. Rate-limit if mid-risk pending review. |
| **Dust attacks** — adversary spams 100,000 $0.0001 receipts to clog the system | medium — operational noise | Enforce $0.10 USDC minimum. Per-wallet rate limit (10 receipts/min, 100/hour). |
| **Reentrancy / double-settlement** — same payment proof submitted twice | medium — accounting errors | Idempotency on `tx_signature`. Receipts table has unique constraint on signature. |
| **Replay across networks** — payment proof from devnet replayed against mainnet endpoint | medium | Network is included in `accepts` and re-checked at settlement; mismatched network = 402. |
| **State charity solicitation regs** — accepting donations across state lines triggers registration in some states | low (most agent flows aren't direct mail solicitation), medium long-term | Require nonprofit to attest their state-registration status during onboarding. UI flag if they're collecting from a state where they're not registered. |
| **Stable mint risk** — USDC depeg | low | Multi-asset support post-v1; for now USDC is fine, depeg risk is systemic and not solvable at our layer |
| **Agent attestation forgery** — agent claims "human delegated session" but the delegation is fake | medium — leads to bad tax receipts | v1: only accept attestations from approved providers (Privy, Turnkey, Coinbase Smart Wallet). v2: build a verifiable-credential standard for agent-to-human delegation, contribute to x402 spec. |

---

## 8. Pricing implications

- We charge nothing on the protocol (zero protocol fee, matches x402 ethos)
- Kali takes a small **convenience fee** on outbound x402 disbursements only (e.g. 0.5% on grant disbursements via x402, capped at $25 per tx) — pure ops fee for compliance + receipt + sync
- Inbound donations are 100% to the nonprofit — never touch them
- Subscription pricing for the Kali platform absorbs the cost of running facilitators / sync / etc

---

## 9. Open questions

1. **Should we run our own facilitator** or trust PayAI/Coinbase? Self-hosted gives us full control + zero dependency, but doubles the eng surface. Recommend: PayAI for v1, evaluate self-host post-50 tenants.
2. **Is there demand for cross-currency donations** (donor wants to give EUR, nonprofit wants USD)? Probably not for v1, but x402's extension system supports it.
3. **How do we handle restricted donations** (donor specifies a program)? Two options: separate endpoints per program (clean), or a `designation` parameter in the x402 `accepts.extra` (flexible). Lean toward the parameter — simpler for agents.
4. **Wallet binding UX** — how does a human bind their wallet to their CRM identity once? OAuth-style flow + signed message during first donation. Then any future x402 from that wallet is auto-attributed.
5. **Should we publish a `.well-known/x402-nonprofits.json` directory** so any agent can discover all Kali-hosted nonprofits? Probably yes — accelerates adoption and positions us as the canonical registry.

---

## 10. Decision points (what we're asking the team)

1. **Approve the spec for hackathon scope.** Phase 1 only (~6 hrs of build).
2. **Allocate the ~6 hours.** Best owner: Stephen (he knows Solana primitives) or matty (knows the connector framework). Pair if possible.
3. **Pick the facilitator.** Recommend PayAI for v1 demo. Confirm.
4. **Production scope post-hackathon.** Slot Phase 2 into the 12-week roadmap as priority 2 (after embedding pipeline + chat UI).

---

## 11. References

- [x402.org](https://www.x402.org/) — protocol homepage + ecosystem
- [Coinbase x402 launch post](https://www.coinbase.com/developer-platform/discover/launches/x402)
- [Coinbase CDP x402 docs](https://docs.cdp.coinbase.com/x402/welcome)
- [github.com/coinbase/x402](https://github.com/coinbase/x402) — reference implementation
- [Solana x402 getting started](https://solana.com/developers/guides/getstarted/intro-to-x402)
- [github.com/solana-foundation/pay](https://github.com/solana-foundation/pay) — Solana Foundation's reference pay-per-API SDK
- [github.com/quiknode-labs/x402-solana](https://github.com/quiknode-labs/x402-solana) — Quicknode's Solana x402 SDK
- [github.com/payainetwork/x402-solana](https://github.com/payainetwork/x402-solana) — PayAI Solana facilitator
- [Cloudflare x402 announcement](https://blog.cloudflare.com/x402/) — protocol legitimization signal
- [AWS x402 + Agentic Commerce post](https://aws.amazon.com/blogs/industries/x402-and-agentic-commerce-redefining-autonomous-payments-in-financial-services/) — enterprise framing

---

_This spec is a working document. Edit freely. Decisions move into kali-info/decisions.md once made._
