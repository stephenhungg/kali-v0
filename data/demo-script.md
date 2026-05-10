# HackDavis 2026 — Demo Script

Two stories stitched together: x402 agent donations (xspec §6) and Cause Coins (cspec §5). Each is ~2:30. Total demo ~5:00 with handoffs.

> **Pre-flight**: `bun run seed && bun run seed:x402 && bun run seed:causecoin && bun dev` running on `pay.kalilabs.ai`, `coin.kalilabs.ai`, `kalilabs.ai` with `/etc/hosts` entries pointing to `127.0.0.1`. Inngest dev server: `npx inngest-cli@latest dev`.

---

## Story A — x402 Agent Donations (2:30)

### Line 1 (40s)
**Operator** opens phone Claude on stage:
> "Donate $25 USDC to a Sacramento youth mentorship nonprofit on my behalf using x402."

Claude consults `pay.kalilabs.ai/.well-known/x402-directory.json`, finds Rivertown Community Foundation (`tenant_rivertown`), POSTs to the endpoint, gets back 402 + accepts[]. Claude builds and signs the inner USDC transfer with the demo wallet, retries with `X-Payment` header. Receipt comes back inline.

**(Real proxy)**: `bun run x402:donate --tenant rivertown --amount 25 --memo "From phone via Claude"` runs in 412ms. Solana Explorer link visible.

### Line 2 (15s)
Switch to projector — Kali chat. Demo donation just happened. Without prompting:
- Solana tile pulses (treasury balance updated)
- Bloomerang tile pulses (Inngest CRM-sync event fired soft-credit)
- Salesforce tile pulses (Opportunity created with type=Agent Donation)
- Audit log shows the receipt entry timestamped to 2 seconds ago

### Line 3 (40s)
Operator types:
> "How much have we received via x402 this hour, and which donors are tied to existing CRM records?"

Agent fans:
- `x402.recentDonations({ windowDays: 1 })` → 1 receipt (the just-settled one) + ~3 seed-flagged receipts
- `bloomerang.searchDonors` matched on the email metadata
- `salesforce.getRelatedAccount` for the matched donor

Agent answers:
> "Received 1 donation via x402 in the last hour: $25 USDC from wallet `Cz...8K`, attributed to Stephen Hung (kali_entity_id ppl_001234). Soft credit added to his Bloomerang record. Salesforce Opportunity tagged 'Agent Donation'. Tax-deductible: yes — delegated human session via Privy."

### Closing (10s)
> "x402 hit 165M txs and $600M annualized by Q1. We're the only nonprofit infrastructure that natively accepts agent-driven donations."

---

## Story B — Cause Coins (2:15)

### Line 1 (30s)
Operator types:
> "Launch our cause coin. Symbol RVRT. 1% trading fee to our treasury."

Agent calls `causecoin.launch({ tenantSlug: "rivertown", symbol: "RVRT", name: "Rivertown" })`. <5s later: mint address + bonding curve pool address + Solana Explorer URLs returned. Solana tile pulses, **Cause Coins tile lights up for the first time**.

### Line 2 (45s)
Switch to phone. Operator opens `coin.kalilabs.ai/rivertown` on the projector.
- Above-the-fold: cause hero (NOT chart) per cspec §8 rule 6
- "Fees to treasury · ticking live" counter shows $1.4K (seed)
- Operator buys $50 of $RVRT via the embedded wallet
- Chart ticks. Trade row appears in feed. **Counter increments by ~$0.40 in real time** (SSE). Pulse animation triggers on the counter card.

### Line 3 (60s)
Switch back to Kali chat:
> "How is our $RVRT cause coin doing? Cross-reference holders with our existing donor base."

Agent fans:
- `causecoin.getMarketStats({ symbol: "RVRT" })`
- `causecoin.getHolders({ top: 50 })`
- `causecoin.crossReferenceHoldersWithDonors({ topN: 50 })`

Agent answers:
> "$RVRT has 312 holders generating ~$1.45K in fees so far. Of the top 50, 14 are existing Bloomerang donors (including 2 majors > $5K lifetime) and 3 are board members. The remaining 33 are net-new wallets — awareness reach beyond your existing donor base. Top 5 holders own 31% of supply, a healthy distribution."

### Closing (10s)
> "First time a nonprofit has had passive recurring revenue tied to community engagement. Trading volume becomes treasury, forever. The agent reasons across donations, grants, finance, AND token mechanics in one query."

---

## Cross-spec wow (optional 30s)

If time:
> "Summarize Rivertown's onchain story this month."

Agent fans across BOTH new connectors plus existing Solana:
- `solana.getTreasury` + `solana.getRecentDisbursements`
- `x402.treasuryInflows({ windowDays: 30 })` (joins x402 + legacy)
- `causecoin.getCumulativeFeesToTreasury`
- `bloomerang.searchDonors` for biggest matched soft-credit

Returns one paragraph:
> "Rivertown received $X via x402 (Y human-attributed, Z autonomous) plus $W via $RVRT trading fees. Total onchain inflow this month: $X+W. The biggest soft-credit recipients in Bloomerang are A, B, C. Treasury balance is $Q USDC and runway covers 8 months at current burn."

This is the connector-graph payoff — every other nonprofit-OS competitor would need 4 separate dashboards.

---

## Pre-warm cache before going on stage

```bash
# warm seed
bun run seed
bun run seed:x402 medium
bun run seed:causecoin medium

# warm runtime + connector init
curl -s http://localhost:3000/api/connectors/status > /dev/null

# warm two queries (agent prompts cached)
curl -s -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"query":"What is our cash runway?"}' > /dev/null
```
