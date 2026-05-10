# Cause Coins on Solana — Spec

_Version 0.1 · 2026-05-10 · Author: tenzin (with stephen hung). Status: proposal, awaiting team review._

> Sister doc to [x402-nonprofit-donations.md](./x402-nonprofit-donations.md). x402 is the **payment rail** for inbound capital. Cause Coins are an **issuance + speculation rail** for community-owned awareness + recurring fee revenue. Different problems, different mechanics, deliberately separated.

---

## 0. TL;DR

Kali becomes the **first nonprofit infrastructure that lets nonprofits launch their own Solana token with built-in fee revenue routing**. A nonprofit clicks "launch cause coin" → Kali deploys a [Meteora Dynamic Bonding Curve](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk) token with the nonprofit's EIN baked into onchain metadata, a 1% trading fee routed 100% to the nonprofit's treasury wallet, and graduation logic that migrates to a real liquidity pool at threshold so the token doesn't rug. Holders get governance over a community-directed grant fund. The Kali agent reasons over trading data alongside donor data, surfacing things like "your $RVRT cause coin generated $2.1K in fees this week from 312 holders, two of whom are also $5K+ Bloomerang donors."

This is **NOT pump.fun for nonprofits.** The framing is **transparent participatory giving with onchain rails** — speculation as a side effect, awareness + recurring fees as the goal. Done right, this stacks Best Use of Solana, Best Hack for Social Good, Most Technically Challenging, and Best UI/UX simultaneously. Done wrong (i.e. framed as a token casino), it kills the social-good narrative + summons regulators.

---

## 1. Why this exists

### 1.1 The actual problem we solve

Small + mid nonprofits have **zero recurring revenue infrastructure beyond donations**. Every dollar requires fresh fundraising. Compare to:

- SaaS companies: ARR, automatic renewals
- Foundations: endowment yield
- DAOs: token treasury growth + protocol fees
- Membership orgs: dues

Nonprofits get nothing automated. They run capital campaigns, exhaust their network, repeat. Cause coins introduce a **passive recurring revenue stream** — every trade of $RVRT generates fees that flow to the treasury, with zero additional fundraising effort. At $50K/day token volume @ 1% fee, that's **$182K/year in passive revenue** for a nonprofit that previously had none.

Plus three secondary effects:

1. **Awareness via speculation** — degens will research a cause to inform their position, far more deeply than they'd read a donation pitch. Coin holders become the most informed advocates a nonprofit has.
2. **New donor segment** — wallet-native crypto holders who'd never write a check but ape into a $200 position because the chart is going up
3. **Onchain provable impact** — every trade tied to a public cause ID lets the nonprofit publish "this trade contributed $X to our food security program" with an explorer link

### 1.2 Why now

- Meteora's Dynamic Bonding Curve SDK shipped v1.5 in early 2026 — production-grade bonding curves with custom fee routing, 5 minutes to integrate
- Pump.fun has trained millions of crypto users on bonding-curve UX
- Solana's $0.0001 fees + 400ms finality make microtrading economical
- The 2025-2026 wave of "social tokens that aren't memes" (Friend.tech successor protocols, mirror.xyz cause posts, pleasrDAO copies) primed the cultural ground
- No incumbent nonprofit infrastructure has touched this space — Blackbaud, Bloomerang, Salesforce NPSP, all silent

If Kali ships first we own this category for years.

### 1.3 Why this isn't pump.fun

- **Pump.fun mechanics**: 1% trading fee + 6% creator fee, creator dumps on holders post-graduation, 99.9% rug, designed as speculation casino
- **Cause Coin mechanics**: 1% trading fee, **0% creator fee**, **100% of fees route to nonprofit treasury wallet onchain (auditable)**, no creator-dump ability (mint-locked at deploy), graduation to Meteora DAMMv2 with locked LP, **token utility beyond speculation** (member-directed governance over a portion of treasury)
- **Pump.fun framing**: "fair launch your meme coin"
- **Cause Coin framing**: "transparent participatory giving with onchain rails"
- **Pump.fun audience**: degens hunting 100x
- **Cause Coin audience**: cause supporters who happen to want exposure + governance

The technical primitives overlap (bonding curves on Solana). The product is fundamentally different.

---

## 2. Mechanics

### 2.1 Token launch

When a Kali tenant launches a cause coin, the following happens onchain:

```
1. Kali tenant clicks "Launch Cause Coin" in UI
2. Kali generates SPL token mint + token metadata:
   - name: "Rivertown Community Foundation"
   - symbol: "RVRT"
   - decimals: 9
   - metadata.attributes:
       ein: "82-3491582"
       kali_tenant_id: "tenant_rivertown"
       cause: "community foundation - sacramento"
       irs_status: "501(c)(3)"
       launch_disclaimer: "Speculative purchase. NOT a donation. NOT tax-deductible."
3. Kali deploys a Meteora Dynamic Bonding Curve pool:
   - Quote token: USDC (not SOL — stable accounting, no volatility for the nonprofit)
   - Initial market cap: ~$5K (low, accessible)
   - Bonding curve shape: linear (predictable price action, less degen-y)
   - Cliff fee: 100 bps = 1% of every trade
   - Fee recipient: nonprofit's Solana treasury wallet (already exists from Solana connector)
   - Fee distribution: 100% to recipient wallet (NOT split with platform)
   - Graduation threshold: $69K market cap (mirrors pump.fun convention)
   - Graduation target: Meteora DAMMv2 with locked LP for 12 months
4. Mint authority is renounced or set to a multi-sig governance program (post-v1)
5. Kali surfaces the launch in the agent's context — every connector now sees this token
```

Fee routing is the moat. The fee recipient is hardcoded in the bonding curve config at deploy time. **The nonprofit literally cannot rug** because they have no admin keys to drain. The only way for the nonprofit to access funds is through the legitimate trading fee accumulator, which the agent + Kali UI surfaces transparently.

### 2.2 Trading

Standard bonding curve dynamics:
- Anyone with a Solana wallet can buy $RVRT in USDC
- Price increases as supply is bought
- Sells push price down
- **Each trade generates 1% fee → nonprofit treasury wallet**
- Trading is permissionless, no KYC, no allowlist (public-good token, anyone can participate)
- Front-end (Kali-hosted at `coin.kalilabs.ai/<tenant-slug>`) shows live chart + holder count + cumulative-fees-to-treasury counter

### 2.3 Holder utility (the legal moat)

The token cannot be just speculation. It must have real utility beyond price action, otherwise we're stamped a security under Howey. Three baked-in utilities:

1. **Member-directed giving fund.** A fixed % of each trading fee (recommend 20%) goes to a "community fund" wallet, separate from the main treasury. Holders vote (1 token = 1 vote, snapshot-based) on which programs the community fund disburses to each quarter. This makes the token a governance instrument over a real fund, not a passive bet.
2. **Tier-based recognition + perks.** Holding ≥ X tokens unlocks IRL benefits — gala access, named recognition, advisory board seat for top-100 holders. These are non-fungible unlocks tied to wallet, refreshed monthly.
3. **Holder-only impact updates.** Quarterly impact reports + financials made available to token holders before public release. Creates an information asymmetry that has real value.

Together these establish the token as a **governance + membership instrument with a market-traded secondary**, not a security promising returns from the issuer's efforts.

### 2.4 Graduation

At $69K market cap (or 80% of bonding curve supply consumed, whichever first):
1. Bonding curve closes
2. Remaining USDC liquidity from the curve auto-LPs to a Meteora DAMMv2 pool with the token
3. LP tokens are locked for 12 months in a Streamflow vesting contract
4. Trading continues on the AMM with the same 1% fee continuing to route to treasury (via Meteora's hook program for AMM fee redirection)

**Critical**: locked LP at graduation is what makes this NOT a rug. Pump.fun graduates to Raydium with creator-controlled LP that can be removed. We lock for 12 months minimum with a public Streamflow vesting URL anyone can verify.

### 2.5 Issuance economics

Initial token supply: 1,000,000,000 (1B) — standard memecoin supply, holders prefer round numbers.

Distribution at launch:
- 80% — bonding curve (public buy)
- 15% — community treasury (locked, controlled by holder governance)
- 5% — Kali platform reserve (locked 24 months, used for liquidity bootstrap on partner DEXs)
- 0% — nonprofit team or kali team allocation. **Zero insider allocation.** This is the trust signal that lets us ship this without controversy.

---

## 3. Architecture

### 3.1 Where it lives in kali-v0

```
kali-v0/
├── lib/connectors/
│   ├── causecoin.ts            ← new connector (~300 LOC)
│   └── causecoin.schema.ts     ← Zod schemas for coin, holder, trade, fee accrual
├── app/
│   ├── coin/[slug]/page.tsx    ← public-facing trading UI (chart, buy/sell, holders)
│   └── api/coin/
│       ├── launch/route.ts     ← protected: deploy a new cause coin for a tenant
│       └── [mint]/route.ts     ← public: token info, holder list, fee history
└── lib/causecoin/
    ├── deploy.ts               ← Meteora DBC SDK launch flow
    ├── trading.ts              ← buy/sell quote + execute helpers
    ├── governance.ts           ← snapshot-based holder votes (post-v1)
    └── metadata.ts             ← onchain token metadata management (EIN, etc)
```

### 3.2 Connector tools (exposed to the agent)

```ts
causecoin.launch                    // (admin) deploy new coin for a tenant
causecoin.getCoinForTenant         // resolve coin from tenant kali_entity_id
causecoin.getMarketStats            // price, market cap, 24h volume, holder count
causecoin.getCumulativeFeesToTreasury  // total $ accrued to nonprofit since launch
causecoin.getHolders                // top N holders, distribution stats
causecoin.crossReferenceHoldersWithDonors  // ← the wow query: "show me holders who are also Bloomerang donors"
causecoin.getRecentTrades           // last N trades w/ buyer wallets
causecoin.getGovernanceSnapshot     // current holder voting power for community fund decisions
causecoin.proposeAllocation         // (post-v1) submit governance proposal
causecoin.simulateBuy               // pre-trade quote (for chat preview)
causecoin.executeBuyOnBehalfOfUser  // signed-via-Privy buy from chat
```

### 3.3 Deps to add

```json
{
  "@meteora-ag/dynamic-bonding-curve-sdk": "^1.5.0",
  "@solana/spl-token": "^0.4.0",        // already in
  "@solana/web3.js": "^1.95.0",          // already in
  "bs58": "^6.0.0"                        // already in
}
```

Plus we need a treasury keypair-management strategy. For v1: Privy server wallets per tenant. Post-v1: optional Squads multi-sig for nonprofits with formal fiduciary controls.

---

## 4. Implementation plan

### 4.1 Phase 1 — hackathon-shippable demo (~8 hours)

1. **Add Meteora DBC SDK** + write `lib/causecoin/deploy.ts`:
   - Single function `launchCauseCoin(tenant, params)` that:
     - Generates token mint + metadata with EIN, kali_tenant_id, disclaimer
     - Calls Meteora DBC `createPool` with USDC quote, 1% fee, fee recipient = tenant's treasury
     - Returns token mint address, bonding curve pool address, explorer URLs
2. **Connector** `lib/connectors/causecoin.ts`:
   - Zod schemas matching matty's framework
   - Tools: `launch`, `getMarketStats`, `getHolders`, `getCumulativeFeesToTreasury`, `getRecentTrades`, `crossReferenceHoldersWithDonors`
   - Tools read from devnet via `@solana/web3.js` + Meteora SDK queries; no new database needed for v1 (state lives onchain)
3. **Public trading UI** at `app/coin/[slug]/page.tsx`:
   - Chart (Recharts or TradingView lightweight-charts)
   - Buy/Sell forms (Privy embedded wallet)
   - Holder leaderboard
   - Live "fees to nonprofit since launch" counter
   - **Massive disclaimer card** at top: "$RVRT is a speculative purchase, NOT a donation. You may lose money. The nonprofit makes NO promises of returns. Token grants governance over a community fund only. **NOT tax-deductible** — for tax-deductible giving use [Donate via Kali](/<tenant>/donate)."
4. **Demo launch script** `scripts/launch-cause-coin.ts`:
   - One-shot CLI: `bun scripts/launch-cause-coin.ts --tenant rivertown --symbol RVRT`
   - Used in the demo to launch live in front of judges
5. **Cross-reference query proven**: agent runs `crossReferenceHoldersWithDonors` and returns "of 312 $RVRT holders, 14 are existing Bloomerang donors and 3 are board members" — this is the wow line for judges, validating the "agent reasons across all rails" thesis

### 4.2 Phase 2 — production hardening (~3 weeks post-hackathon)

1. **Governance v1**: snapshot-based voting infra for community fund allocations. Post-vote, agent auto-disburses via existing Solana batch payout.
2. **Mainnet support**: env-keyed network selection, Privy mainnet wallets, real KYC for nonprofit treasury controllers
3. **Tier-based perks**: token-gated content + IRL access lists synced to Bloomerang as custom fields ("$RVRT_holder_5k_plus")
4. **Auto-LP-locking at graduation**: integrate Streamflow vesting + verify lock URL is publicly viewable
5. **Cause coin directory**: `coin.kalilabs.ai/directory` listing all live cause coins, sortable by total fees raised, holder count, cause area
6. **Holder analytics dashboard for nonprofits**: weekly holder activity report, top buyers, distribution health, holder geo (privacy-preserving, country-level only)
7. **Legal opinion + IRS letter**: counsel-drafted opinion that the token model is governance+membership not security. Costly (~$25K) but unblocks foundation-level adoption

### 4.3 Phase 3 — scale + ecosystem

1. **DAO/foundation tools**: any 501(c)(3) can self-serve launch via Kali, w/ automated KYC + EIN verification before deploy permissions
2. **Inter-coin vaults**: Kali aggregator that lets a holder put $X into a basket of cause coins with one click
3. **Patron NFTs**: top holders get unique NFT membership cards minted from the bonding curve graduation
4. **Foundation grant rails**: foundations can route grants by buying causes coins at scale, providing structural liquidity in exchange for governance representation
5. **Kali revenue**: charge a one-time launch fee ($500-2K) per cause coin deployment + take 0.5% of trading volume on Kali-hosted UI (still 100% of bonding curve fees go to nonprofit, this is a separate UI fee for buyers using our front-end vs raw RPC)

---

## 5. Demo flow (HackDavis 2026)

**Setup:** Kali UI shows Rivertown's chat. Rivertown's deck says "we're launching $RVRT today."

**Demo line 1 (30s):** Operator types in chat:
> _"Launch our cause coin. Symbol RVRT. Initial supply 1B. 1% trading fee to our treasury."_

Agent runs `causecoin.launch` → Meteora DBC pool deploys onchain → token mint address + Solana Explorer link returned in <5 seconds. Side panel: Solana tile pulses, Causecoin tile (new) lights up.

**Demo line 2 (45s):** Switch to phone. Operator opens `coin.kalilabs.ai/rivertown` on the projector. Chart starts at $5K market cap. Operator buys $50 of $RVRT from the phone. Chart ticks up. Trade appears in trades list. **"Fees to Rivertown" counter ticks up by $0.50 in real time.** Live onchain.

**Demo line 3 (60s):** Switch back to Kali chat:
> _"How is our $RVRT cause coin doing? Cross-reference holders with our existing donor base."_

Agent fans out:
- `causecoin.getMarketStats` — 312 holders, $14K market cap, $1.4K cumulative fees in 4 hours since launch
- `causecoin.getHolders(top: 50)` — wallet list
- `bloomerang.getDonor` × 50 in parallel — entity resolution by wallet
- Returns: _"$RVRT has 312 holders generating $1.4K in fees so far. Of those, 14 are existing Bloomerang donors (including 2 major donors > $5K lifetime) and 3 are current board members. The remaining 295 are new wallets we've never seen — net new awareness reach. Top 5 holders own 31% of supply, suggesting healthy distribution."_

**Closing line:** _"This is the first time a nonprofit has ever had passive recurring revenue tied to community engagement. Every trade, forever, builds the treasury. And the agent reasons over the whole picture — donations, grants, finance, AND token mechanics — in one query. **No other nonprofit infrastructure can do this.**"_

Judges' brains break. We win Solana track, Social Good track, Most Challenging, and UI/UX in 2 minutes 15 seconds.

---

## 6. Risks + Mitigations

This is the high-stakes section. Most of these are deal-breakers if mishandled.

| risk | severity | mitigation |
|---|---|---|
| **Securities classification (Howey)** — SEC could classify $RVRT as an unregistered security if it's perceived as expecting profits from issuer's efforts | **catastrophic** — SEC enforcement, criminal liability for issuers | Token utility design: governance over community fund (real governance, not theater), tier-based membership perks, NO promised distributions to holders, NO insider allocation, NO marketing of price expectations. Engage securities counsel **before mainnet deploy** for written opinion. v1 demo on devnet only. |
| **501(c)(3) status revocation** — IRS could revoke nonprofit's tax-exempt status if speculative trading is deemed inconsistent with exempt purpose | **catastrophic** | Token launch is the *platform's* product, not the nonprofit's primary activity. Fee revenue is treated as program-related investment income, not unrelated business taxable income, because it advances the awareness mission. Get IRS private letter ruling before scale (post-v1). |
| **Donor confusion — buying = donating** | high | Three layers of disclosure: (1) massive banner on coin page "NOT a donation, NOT tax-deductible," (2) checkbox-required acknowledgment before first buy, (3) post-purchase email confirmation reiterates. Separate `/donate` flow on every nonprofit's page is visually distinct. |
| **Token rug despite our protections** — bad actor gains control of treasury wallet, drains fees | high | Treasury wallet is Privy-managed with delegated signing; full audit log on every withdrawal; mainnet upgrade requires multi-sig (Squads) with 3+ signers including a Kali-controlled compliance signer. |
| **Pump-and-dump by early buyers** — first-hour buyers dump on later buyers, leaving bagholders | medium | Linear bonding curve (less aggressive than exponential) reduces 100x dynamics. Hold-time tier perks reward longer holders. UI shows distribution warnings if top 5 wallets own > 50%. |
| **Negative press cycle**: "nonprofits launch shitcoins" headline | high reputational | Aggressive narrative work — never use words "launch" or "memecoin" in copy. Always: "transparent participatory giving rail." Frame in pitch as "the next evolution after Patreon for cause-aligned communities." Pre-brief 2-3 nonprofit-friendly journalists before launch. |
| **State-by-state regulation**: some states require registration of token sales as securities offerings | medium | Geo-block US states that flag tokens as securities (NY, FL, CA pending) at the front-end. Holders from those states must self-attest. Long term: register where required. |
| **AML / OFAC**: holders from sanctioned wallets | medium | TRM Labs hook on every buy → reject if flagged. Same as x402 spec — shared compliance layer. |
| **Tax docs for traders**: a trader profitable on $RVRT owes capital gains; will the nonprofit be tax-reporter? | low (US: IRS treats as crypto, trader self-reports) | Disclaim. Provide a 1099-style download for buyers if they request, but no obligation to report. |
| **Liquidity death after graduation** — coin trades on AMM but volume dries up, treasury fee accrual stops | medium | Locked LP for 12 months ensures tradability. Kali platform reserve provides backstop liquidity if pool drains. Incentivize ongoing market-making via small grants from community fund. |
| **Smart contract risk** — Meteora DBC bug drains funds | low (audited) | Use only audited Meteora pools. Insurance via Nexus Mutual or similar (post-v1). |
| **Wash trading by nonprofit to inflate fees** — bad actor nonprofit creates volume to siphon kali platform fees | low | Detect via wallet clustering analysis. Auto-flag suspicious patterns. Suspend platform privileges if confirmed. |

---

## 7. Pricing implications

Two revenue streams for Kali:

1. **Launch fee**: $500-2,000 per cause coin deploy, charged to nonprofit at launch. Covers KYC, legal review, ongoing infra
2. **UI trading fee**: 0.5% of trades made through Kali-hosted UI (separate from the 1% bonding curve fee that goes 100% to nonprofit). RPC-direct trades or via 3rd party UIs incur no Kali fee. This incentivizes us to keep the UI great.

For the nonprofit:
- **Cumulative fee revenue** depends on volume. At $50K/day volume × 1% fee = **$182K/year passive**. At $5K/day × 1% = $18K/year. Numbers depend on cause traction.
- **Plus**: bonding curve liquidity at graduation belongs to the locked LP, but ongoing trading fees on the post-graduation Meteora pool continue routing 1% to treasury for the locked-LP duration.

For Kali:
- 100 cause coin launches in year 1 × avg $1K launch fee = $100K
- Plus 0.5% on $X total volume — wide range, but if half of nonprofits hit $20K/day avg = $40M annual volume → $200K Kali UI fees
- At meaningful scale ($100M+ trading volume across all causes), Kali takes $500K+/yr just from the UI fee. Plus the platform subscription on top.

**This becomes a non-trivial line of revenue separate from saas subscriptions.**

---

## 8. UX requirements

Critical UX rules (these are non-negotiable):

1. **Coin pages and donation pages are visually distinct.** Different color, different CTA, different copy. A user must NEVER confuse the two flows.
2. **Disclosure layer everywhere.** Every coin page header has a banner. Every buy modal has a re-confirmation. Every receipt email reminds.
3. **Live "fees to treasury" counter on every coin page.** This is the magic moment — visible, ticking, undeniable proof that trades = revenue for the cause.
4. **Holder dashboard for buyers.** "You've contributed $X.XX to Rivertown by holding through Y trades." Makes holders feel like supporters, not speculators.
5. **No "moon" / "pump" / "ape" language anywhere on Kali-hosted surfaces.** These are governance + membership tokens, marketed as such.
6. **Cause page (the marketing page) leads with the cause, NOT the chart.** Mission, programs, impact metrics, holder list, fees-to-date, then chart.
7. **Default order: research → buy.** The buy CTA shouldn't be visible above the fold on mobile.

---

## 9. Open questions

1. **Is the 20% community-fund routing viable?** Splitting fees adds complexity but is the strongest legal moat. Decision pending counsel review.
2. **Should we restrict launches to verified 501(c)(3)s only?** Yes for v2 (real KYC + IRS lookup). For v1 demo, mock verification is fine.
3. **Mainnet deploy timeline.** Recommend devnet only until Phase 2 legal review complete (~3 months). Demo on devnet is fine.
4. **Coin deploy permission model.** Tenant admin only? Multi-sig from board? Single-button or workflow with approvals? Default to "single button + 24h cooling-off period for irreversibility" — gives time to back out if launched in error.
5. **Failure path for low-volume coins.** If a coin gets <$1K volume in 30 days, what happens? Auto-archive the page? Allow nonprofit to relaunch?
6. **Cross-coin governance.** Could a cause coin holder vote on something that affects the broader Kali platform? Probably no — keep governance scoped to that nonprofit's community fund only. Avoids platform-token regulatory issues.
7. **Should holders get tax receipts for the community-fund portion?** I.e. when the holder votes to disburse community fund $1,000 to a program, did they "donate"? Probably not (they didn't put fresh dollars in, they redirected accumulated fees), but worth counsel review.

---

## 10. Decision points (what we're asking the team)

1. **Approve the spec for hackathon scope.** Phase 1 only (~8 hrs of build, devnet only).
2. **Decide framing.** "Cause Coins" is my placeholder. Could also be: "Community Tokens", "Cause Tokens", "Patron Coins", "Mission Tokens". My pref: **"Cause Coins"** — punchy, memorable, descriptive, no SEC trigger words.
3. **Pick the cause coin namespace.** Is it `coin.kalilabs.ai/<tenant>` or `kalilabs.ai/cause/<tenant>` or `<tenant>.kalilabs.ai/coin`? Recommend subdomain: `coin.kalilabs.ai/<tenant-slug>` for clean isolation.
4. **Decide community fund split.** 20% is my recommendation. 0% (all fees to treasury) is simpler legally but weaker product. 50% would be more democratic but cuts treasury revenue. Discuss.
5. **Allocate eng owner.** Best owner: Stephen (knows Solana primitives) + matty pairing (knows the connector framework + the legal/securities considerations).
6. **Confirm the Meteora DBC dependency** is acceptable. Alternatives: roll our own bonding curve (++3 weeks build, --less battle-tested), use Raydium LaunchLab (similar to Meteora, slightly less customization), pump.fun fork (DON'T — reputational disaster).
7. **Mainnet timeline.** Recommend NEVER deploy mainnet without securities counsel opinion in hand. Are we ok shipping devnet-only for v1 + first 90 days? Yes from me.

---

## 11. Cohesion with the rest of Kali

This works because it sits **inside the existing platform thesis**:

- **Same agent** orchestrates queries across coins + donations + grants + finance
- **Same context layer** entity-resolves coin holders against Bloomerang/Salesforce
- **Same Solana connector** handles treasury balances + payouts
- **Same audit log** records all coin-related activity
- **Same compliance plumbing** (TRM, Privy) shared with x402 + onchain payouts
- **Same UI design system** at `coin.kalilabs.ai/<slug>` — consistent with `kalilabs.ai/<tenant>`

Cause Coin is **a 12th connector**, not a separate product. The agent's wow query — _"cross-reference $RVRT holders with Bloomerang donors and Salesforce board members"_ — is what makes it unmistakably a Kali feature, not a standalone token launchpad.

If the financial-OS pivot lands (per the recent thread), Cause Coins fit the narrative perfectly: **Kali is the financial brain for nonprofits — fiat AND onchain, traditional AND community-issued, donation-based AND speculation-funded — all unified under one agent, one context layer, one audit trail.**

---

## 12. References

- [Meteora Dynamic Bonding Curve docs](https://docs.meteora.ag/product-overview/dynamic-bonding-curve-dbc-overview/bonding-curve-formula)
- [@meteora-ag/dynamic-bonding-curve-sdk on npm](https://www.npmjs.com/package/@meteora-ag/dynamic-bonding-curve-sdk)
- [Meteora DBC GitHub](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk)
- [Meteora Fun Launch scaffold](https://docs.meteora.ag/developer-guide/invent/scaffolds/fun-launch)
- [Raydium LaunchLab](https://raydium.io/launchpad) (alternative bonding curve primitive)
- [Solana SPL Token program](https://spl.solana.com/token)
- [Streamflow vesting (for locked LP)](https://streamflow.finance/)
- [Squads multi-sig (post-v1 treasury management)](https://squads.so/)
- [TRM Labs (compliance hooks)](https://www.trmlabs.com/)
- [SEC Howey test reference](https://www.sec.gov/about/laws/secregga.htm)
- Sister doc: [x402-nonprofit-donations.md](./x402-nonprofit-donations.md)

---

_This spec is a working document. Edit freely. Decisions move into kali-info/decisions.md once made._
