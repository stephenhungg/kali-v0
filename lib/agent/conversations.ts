/**
 * In-memory conversation store for v1.
 *
 * Each conversation is an ordered list of role-tagged messages plus tool-
 * call traces and audit pointers. Production swaps the backing store for
 * the Drizzle `conversations` + `messages` tables (see `lib/db/schema.ts`).
 *
 * The store is keyed by conversationId. Concurrent appends are safe in
 * Bun/Node (single-threaded JS) — every mutation is an array `push`.
 */

export type ConversationRole = "user" | "assistant" | "tool";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationRole;
  content: string;
  /** Tool calls made by the assistant in this turn (for assistant role). */
  toolCalls?: Array<{
    name: string;
    input: unknown;
    result: unknown;
    isError: boolean;
    durationMs: number;
  }>;
  /** Citation list — kali_entity_id strings the assistant referenced. */
  citations?: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

let __seq = 0;
function nextId(prefix: string): string {
  __seq++;
  return `${prefix}_${Date.now().toString(36)}_${__seq.toString(36)}`;
}

const __byId = new Map<string, Conversation>();

export interface CreateOptions {
  tenantId?: string;
  userId?: string;
  title?: string;
  /** Pre-set the conversation id (e.g. for tests). */
  id?: string;
}

export function createConversation(opts: CreateOptions = {}): Conversation {
  // Reject empty-string ids — they collide and look like a "missing id" to
  // every other API surface. If the caller passed `""`, generate a fresh one.
  const id = opts.id && opts.id.length > 0 ? opts.id : nextId("conv");
  const now = new Date().toISOString();
  const c: Conversation = {
    id,
    tenantId: opts.tenantId ?? "rivertown",
    userId: opts.userId ?? "demo",
    title: opts.title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  __byId.set(id, c);
  return c;
}

export function getConversation(id: string): Conversation | null {
  return __byId.get(id) ?? null;
}

/**
 * Get-or-create. Behavior:
 *   - If `id` is non-empty AND present in the store: return existing.
 *   - If `id` is non-empty AND unknown: create with that id.
 *   - If `id` is empty/undefined: create with a freshly-generated id
 *     (never reuses the empty string — that would collide across callers).
 */
export function getOrCreateConversation(
  id: string | undefined,
  opts: CreateOptions = {},
): { conversation: Conversation; created: boolean } {
  if (id && id.length > 0) {
    const existing = __byId.get(id);
    if (existing) return { conversation: existing, created: false };
    return {
      conversation: createConversation({ ...opts, id }),
      created: true,
    };
  }
  // No id (or empty string) — generate a fresh one. Drop any stale id from opts.
  const { id: _drop, ...rest } = opts;
  void _drop;
  return { conversation: createConversation(rest), created: true };
}

export interface AppendMessageOpts {
  conversationId: string;
  role: ConversationRole;
  content: string;
  toolCalls?: ConversationMessage["toolCalls"];
  citations?: string[];
}

export function appendMessage(opts: AppendMessageOpts): ConversationMessage {
  const c = __byId.get(opts.conversationId);
  if (!c) throw new Error(`unknown conversation: ${opts.conversationId}`);
  const msg: ConversationMessage = {
    id: nextId("msg"),
    conversationId: c.id,
    role: opts.role,
    content: opts.content,
    toolCalls: opts.toolCalls,
    citations: opts.citations,
    createdAt: new Date().toISOString(),
  };
  c.messages.push(msg);
  c.updatedAt = msg.createdAt;
  // Auto-title from the first user message if none set.
  if (!c.title && opts.role === "user" && c.messages.length === 1) {
    c.title = opts.content.slice(0, 80);
  }
  return msg;
}

export interface UpdateMessageOpts {
  conversationId: string;
  messageId: string;
  content?: string;
  toolCalls?: ConversationMessage["toolCalls"];
  citations?: string[];
}

/**
 * Patch an existing message in place. Used by the streaming chat route to
 * persist the assistant turn on the `text` event (so a client disconnect
 * doesn't drop the answer) and then top up `citations` once the `done`
 * event arrives. Returns the updated message, or null if the conversation
 * or message id doesn't exist.
 */
export function updateMessage(opts: UpdateMessageOpts): ConversationMessage | null {
  const c = __byId.get(opts.conversationId);
  if (!c) return null;
  const msg = c.messages.find((m) => m.id === opts.messageId);
  if (!msg) return null;
  if (opts.content !== undefined) msg.content = opts.content;
  if (opts.toolCalls !== undefined) msg.toolCalls = opts.toolCalls;
  if (opts.citations !== undefined) msg.citations = opts.citations;
  c.updatedAt = new Date().toISOString();
  return msg;
}

export function listConversations(args: {
  tenantId?: string;
  userId?: string;
  limit?: number;
} = {}): Conversation[] {
  let out = Array.from(__byId.values());
  if (args.tenantId) out = out.filter((c) => c.tenantId === args.tenantId);
  if (args.userId) out = out.filter((c) => c.userId === args.userId);
  out = out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out.slice(0, args.limit ?? 50);
}

export function deleteConversation(id: string): boolean {
  return __byId.delete(id);
}

/** Test/dev-only: drop every conversation. */
export function __resetConversations(): void {
  __byId.clear();
}

/** Total count across all tenants — for sanity checks in tests. */
export function __conversationsCount(): number {
  return __byId.size;
}
