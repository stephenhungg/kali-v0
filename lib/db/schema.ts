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
  pgTable,
  text,
  timestamp,
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
};
