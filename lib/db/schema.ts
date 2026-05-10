/**
 * Drizzle schema for the kali multi-tenant database.
 *
 * Every row except `tenants` carries `tenant_id`. Row-level isolation is
 * enforced at the application layer — every query in `lib/db/client.ts`
 * scopes by tenant from the request context.
 *
 * Postgres + pgvector. The `vector` column type comes from `pgvector` and is
 * defined separately from drizzle's core columns; we declare it as a custom
 * type below.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tenantId = () => uuid("tenant_id").notNull();

/* ─── tenants ─────────────────────────────────────────────────────────── */

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("trial"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ─── users ───────────────────────────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("users_tenant_idx").on(t.tenantId)],
);

/* ─── connectors (per-tenant integration config) ──────────────────────── */

export const connectors = pgTable(
  "connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    type: text("type").notNull(), // matches ConnectorId in lib/connectors/base.ts
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
    syncState: jsonb("sync_state").$type<{ lastSyncAt: string | null; status: string }>(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("connectors_tenant_idx").on(t.tenantId)],
);

/* ─── canonical entities (output of entity resolution) ────────────────── */

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    canonicalName: text("canonical_name").notNull(),
    type: text("type").notNull(), // donor, staff, vendor, board_member, partner_org, ...
    attrs: jsonb("attrs").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("entities_tenant_idx").on(t.tenantId)],
);

export const entityLinks = pgTable(
  "entity_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    entityId: uuid("entity_id")
      .references(() => entities.id, { onDelete: "cascade" })
      .notNull(),
    sourceType: text("source_type").notNull(), // ConnectorId
    sourceRecordId: text("source_record_id").notNull(),
    confidence: integer("confidence").notNull().default(100), // 0..100
  },
  (t) => [
    index("entity_links_tenant_idx").on(t.tenantId),
    index("entity_links_entity_idx").on(t.entityId),
  ],
);

/* ─── records (raw connector data, embedded for retrieval) ────────────── */

export const records = pgTable(
  "records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    connectorId: uuid("connector_id")
      .references(() => connectors.id, { onDelete: "cascade" })
      .notNull(),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    sourceType: text("source_type").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull(),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("records_tenant_idx").on(t.tenantId),
    index("records_connector_idx").on(t.connectorId),
    index("records_entity_idx").on(t.entityId),
  ],
);

/* ─── conversations & messages ────────────────────────────────────────── */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("conversations_tenant_idx").on(t.tenantId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull(), // user | assistant | tool
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls").$type<Array<Record<string, unknown>>>(),
    citations: jsonb("citations").$type<Array<{ source: string; recordId: string }>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("messages_tenant_idx").on(t.tenantId),
    index("messages_conversation_idx").on(t.conversationId),
  ],
);

/* ─── audit log (immutable, append-only) ──────────────────────────────── */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    userId: uuid("user_id"),
    action: text("action").notNull(),
    source: text("source"), // ConnectorId | null
    paramsHash: text("params_hash"),
    resultRecordIds: jsonb("result_record_ids").$type<string[]>(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_tenant_idx").on(t.tenantId),
    index("audit_log_action_idx").on(t.action),
  ],
);

/* ─── agent runs (one per assistant message that called tools) ────────── */

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    messageId: uuid("message_id")
      .references(() => messages.id, { onDelete: "cascade" })
      .notNull(),
    toolsCalled: jsonb("tools_called").$type<string[]>(),
    durationMs: integer("duration_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cachedTokens: integer("cached_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("agent_runs_tenant_idx").on(t.tenantId)],
);

/* ─── tenant wallets (Privy-managed, per kind) ────────────────────────── */

export const tenantWallets = pgTable(
  "tenant_wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    network: text("network").notNull(), // solana-devnet | solana-mainnet
    pubkey: text("pubkey").notNull(),
    privyWalletId: text("privy_wallet_id"),
    kind: text("kind").notNull(), // treasury | community_fund | platform_reserve
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tenant_wallets_tenant_idx").on(t.tenantId),
    uniqueIndex("tenant_wallets_unique").on(t.tenantId, t.network, t.kind),
  ],
);

/* ─── x402 receipts (every donation, real or seed) ────────────────────── */

export const x402Receipts = pgTable(
  "x402_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    txSignature: text("tx_signature").notNull(),
    network: text("network").notNull(),
    amountUsdc: numeric("amount_usdc", { precision: 18, scale: 6 }).notNull(),
    payerWallet: text("payer_wallet").notNull(),
    attribution: text("attribution").notNull(), // human | autonomous | unknown
    attributionProof: jsonb("attribution_proof").$type<Record<string, unknown>>(),
    taxDeductible: boolean("tax_deductible").notNull().default(false),
    taxReceiptUrl: text("tax_receipt_url"),
    memo: text("memo"),
    programDesignation: text("program_designation"),
    subscriptionId: uuid("subscription_id"),
    syncedToCrm: boolean("synced_to_crm").notNull().default(false),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    seedFlag: boolean("seed_flag").notNull().default(false),
  },
  (t) => [
    index("x402_receipts_tenant_idx").on(t.tenantId),
    uniqueIndex("x402_receipts_signature_unique").on(t.txSignature),
    index("x402_receipts_attribution_idx").on(t.attribution),
    index("x402_receipts_received_at_idx").on(t.receivedAt),
  ],
);

/* ─── x402 recurring subscriptions ────────────────────────────────────── */

export const x402Subscriptions = pgTable(
  "x402_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    payerWallet: text("payer_wallet").notNull(),
    amountUsdc: numeric("amount_usdc", { precision: 18, scale: 6 }).notNull(),
    period: text("period").notNull(), // weekly | monthly
    nextChargeAt: timestamp("next_charge_at", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    delegationProof: jsonb("delegation_proof").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("active"), // active | paused | canceled | failed
    retryCount: integer("retry_count").notNull().default(0),
    lastReceiptId: uuid("last_receipt_id"),
    memo: text("memo"),
    programDesignation: text("program_designation"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("x402_subscriptions_tenant_idx").on(t.tenantId),
    index("x402_subscriptions_next_charge_idx").on(t.nextChargeAt),
    index("x402_subscriptions_status_idx").on(t.status),
  ],
);

/* ─── cause coins (one per tenant, optional) ──────────────────────────── */

export const causeCoins = pgTable(
  "cause_coins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    mint: text("mint").notNull(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    decimals: integer("decimals").notNull().default(9),
    bondingCurvePool: text("bonding_curve_pool").notNull(),
    treasuryWallet: text("treasury_wallet").notNull(),
    communityFundWallet: text("community_fund_wallet").notNull(),
    platformReserveWallet: text("platform_reserve_wallet").notNull(),
    feeBps: integer("fee_bps").notNull().default(100),
    communityFundBps: integer("community_fund_bps").notNull().default(2000),
    graduationThresholdUsd: numeric("graduation_threshold_usd", {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default("69000"),
    graduationStatus: text("graduation_status").notNull().default("bonding"),
    ammPool: text("amm_pool"),
    lpLockStreamflowId: text("lp_lock_streamflow_id"),
    metadata: jsonb("metadata").$type<{
      ein?: string;
      irs_status?: string;
      cause?: string;
      launch_disclaimer?: string;
      kali_tenant_id?: string;
      uri?: string;
    }>().notNull().default({}),
    network: text("network").notNull().default("solana-devnet"),
    launchedAt: timestamp("launched_at", { withTimezone: true }).defaultNow().notNull(),
    launchTxSig: text("launch_tx_sig"),
    lastIndexedSig: text("last_indexed_sig"),
  },
  (t) => [
    index("cause_coins_tenant_idx").on(t.tenantId),
    uniqueIndex("cause_coins_tenant_unique").on(t.tenantId),
    uniqueIndex("cause_coins_mint_unique").on(t.mint),
  ],
);

/* ─── cause coin holders (balances + cumulative contribution) ─────────── */

export const causeCoinHolders = pgTable(
  "cause_coin_holders",
  {
    coinId: uuid("coin_id")
      .references(() => causeCoins.id, { onDelete: "cascade" })
      .notNull(),
    wallet: text("wallet").notNull(),
    balance: numeric("balance", { precision: 28, scale: 9 }).notNull().default("0"),
    firstAcquiredAt: timestamp("first_acquired_at", { withTimezone: true }).defaultNow().notNull(),
    lastTradeAt: timestamp("last_trade_at", { withTimezone: true }),
    cumulativeContributedUsd: numeric("cumulative_contributed_usd", {
      precision: 18,
      scale: 6,
    })
      .notNull()
      .default("0"),
  },
  (t) => [
    primaryKey({ columns: [t.coinId, t.wallet] }),
    index("cause_coin_holders_balance_idx").on(t.balance),
  ],
);

/* ─── cause coin trades (indexer output) ──────────────────────────────── */

export const causeCoinTrades = pgTable(
  "cause_coin_trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coinId: uuid("coin_id")
      .references(() => causeCoins.id, { onDelete: "cascade" })
      .notNull(),
    txSignature: text("tx_signature").notNull(),
    wallet: text("wallet").notNull(),
    side: text("side").notNull(), // buy | sell
    usdcAmount: numeric("usdc_amount", { precision: 18, scale: 6 }).notNull(),
    tokenAmount: numeric("token_amount", { precision: 28, scale: 9 }).notNull(),
    feeUsdc: numeric("fee_usdc", { precision: 18, scale: 6 }).notNull(),
    treasuryFeeUsdc: numeric("treasury_fee_usdc", { precision: 18, scale: 6 }).notNull(),
    communityFundFeeUsdc: numeric("community_fund_fee_usdc", {
      precision: 18,
      scale: 6,
    }).notNull(),
    priceAfter: numeric("price_after", { precision: 28, scale: 12 }).notNull(),
    blockTime: integer("block_time").notNull(),
    seedFlag: boolean("seed_flag").notNull().default(false),
  },
  (t) => [
    index("cause_coin_trades_coin_idx").on(t.coinId),
    uniqueIndex("cause_coin_trades_signature_unique").on(t.txSignature),
    index("cause_coin_trades_block_time_idx").on(t.blockTime),
  ],
);

/* ─── cause coin governance proposals + votes ─────────────────────────── */

export const causeCoinProposals = pgTable(
  "cause_coin_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coinId: uuid("coin_id")
      .references(() => causeCoins.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    recipientWallet: text("recipient_wallet").notNull(),
    amountUsdc: numeric("amount_usdc", { precision: 18, scale: 6 }).notNull(),
    snapshotBlock: integer("snapshot_block").notNull(),
    voteStart: timestamp("vote_start", { withTimezone: true }).defaultNow().notNull(),
    voteEnd: timestamp("vote_end", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("open"), // open | passed | rejected | executed
    executionTxSig: text("execution_tx_sig"),
  },
  (t) => [
    index("cause_coin_proposals_coin_idx").on(t.coinId),
    index("cause_coin_proposals_status_idx").on(t.status),
  ],
);

export const causeCoinVotes = pgTable(
  "cause_coin_votes",
  {
    proposalId: uuid("proposal_id")
      .references(() => causeCoinProposals.id, { onDelete: "cascade" })
      .notNull(),
    wallet: text("wallet").notNull(),
    voteWeight: numeric("vote_weight", { precision: 28, scale: 9 }).notNull(),
    direction: text("direction").notNull(), // for | against | abstain
    signedMessage: text("signed_message").notNull(),
    castAt: timestamp("cast_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.proposalId, t.wallet] }),
    index("cause_coin_votes_proposal_idx").on(t.proposalId),
  ],
);

/* embeddings table is declared in lib/db/embeddings.ts because it depends
 * on the pgvector custom type which is loaded dynamically. */

// Re-export a discriminator object so the migration generator can find every
// table by traversing `schema`.
export const schema = {
  tenants,
  users,
  connectors,
  entities,
  entityLinks,
  records,
  conversations,
  messages,
  auditLog,
  agentRuns,
  tenantWallets,
  x402Receipts,
  x402Subscriptions,
  causeCoins,
  causeCoinHolders,
  causeCoinTrades,
  causeCoinProposals,
  causeCoinVotes,
};
