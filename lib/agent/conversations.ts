/**
 * Conversation persistence — Supabase-backed for authed users, in-memory
 * fallback for the demo / unauthenticated flow.
 *
 * Public API is async. Each entry-point checks for a Supabase session: if
 * present, it goes to the `kali_conversations` + `kali_messages` tables
 * (RLS-protected — users can only see their own). If no session OR Supabase
 * isn't configured, we use a process-local Map. The map is volatile (lost
 * on restart), but that's fine for the demo escape hatch.
 *
 * Schema migration: `scripts/supabase-schema.sql` — run once in your
 * Supabase SQL editor.
 */

import { getSupabaseServerClient } from "../supabase/server";

export type ConversationRole = "user" | "assistant" | "tool";

export interface ConversationToolCall {
  name: string;
  input: unknown;
  result: unknown;
  isError: boolean;
  durationMs: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationRole;
  content: string;
  toolCalls?: ConversationToolCall[];
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

export interface CreateOptions {
  tenantId?: string;
  userId?: string;
  title?: string;
  id?: string;
}

export interface AppendMessageOpts {
  conversationId: string;
  role: ConversationRole;
  content: string;
  toolCalls?: ConversationToolCall[];
  citations?: string[];
}

export interface UpdateMessageOpts {
  conversationId: string;
  messageId: string;
  content?: string;
  toolCalls?: ConversationToolCall[];
  citations?: string[];
}

/* ─── id generation ─────────────────────────────────────────────────────── */

let __seq = 0;
function nextId(prefix: string): string {
  __seq++;
  return `${prefix}_${Date.now().toString(36)}_${__seq.toString(36)}`;
}

/* ─── in-memory store (fallback) ────────────────────────────────────────── */

const __byId = new Map<string, Conversation>();

function memCreate(opts: CreateOptions): Conversation {
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

function memGet(id: string): Conversation | null {
  return __byId.get(id) ?? null;
}

function memList(args: { tenantId?: string; userId?: string; limit?: number }): Conversation[] {
  let out = Array.from(__byId.values());
  if (args.tenantId) out = out.filter(c => c.tenantId === args.tenantId);
  if (args.userId) out = out.filter(c => c.userId === args.userId);
  out = out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out.slice(0, args.limit ?? 50);
}

function memAppend(opts: AppendMessageOpts): ConversationMessage {
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
  if (!c.title && opts.role === "user" && c.messages.length === 1) {
    c.title = opts.content.slice(0, 80);
  }
  return msg;
}

function memUpdate(opts: UpdateMessageOpts): ConversationMessage | null {
  const c = __byId.get(opts.conversationId);
  if (!c) return null;
  const msg = c.messages.find(m => m.id === opts.messageId);
  if (!msg) return null;
  if (opts.content !== undefined) msg.content = opts.content;
  if (opts.toolCalls !== undefined) msg.toolCalls = opts.toolCalls;
  if (opts.citations !== undefined) msg.citations = opts.citations;
  c.updatedAt = new Date().toISOString();
  return msg;
}

function memDelete(id: string): boolean {
  return __byId.delete(id);
}

export function __resetConversations(): void {
  __byId.clear();
}

export function __conversationsCount(): number {
  return __byId.size;
}

/* ─── supabase-backed (when session present) ────────────────────────────── */

interface SupaCtx {
  supa: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>;
  userId: string;
}

async function resolveSupa(): Promise<SupaCtx | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  try {
    const supa = await getSupabaseServerClient();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return null;
    return { supa, userId: user.id };
  } catch {
    return null;
  }
}

interface DbConvRow {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface DbMsgRow {
  id: string;
  conversation_id: string;
  role: ConversationRole;
  content: string;
  tool_calls: ConversationToolCall[] | null;
  citations: string[] | null;
  created_at: string;
}

function rowToConversation(c: DbConvRow, messages: ConversationMessage[] = []): Conversation {
  return {
    id: c.id,
    tenantId: c.tenant_id,
    userId: c.user_id,
    title: c.title ?? undefined,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    messages,
  };
}

function rowToMessage(m: DbMsgRow): ConversationMessage {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    role: m.role,
    content: m.content,
    toolCalls: m.tool_calls ?? undefined,
    citations: m.citations ?? undefined,
    createdAt: m.created_at,
  };
}

/* ─── public async API ──────────────────────────────────────────────────── */

export async function createConversation(opts: CreateOptions = {}): Promise<Conversation> {
  const ctx = await resolveSupa();
  if (!ctx) return memCreate(opts);

  const insert: Record<string, unknown> = {
    tenant_id: opts.tenantId ?? "rivertown",
    user_id: ctx.userId,
    title: opts.title ?? null,
  };
  if (opts.id) insert.id = opts.id;

  const { data, error } = await ctx.supa
    .from("kali_conversations")
    .insert(insert)
    .select("*")
    .single();
  if (error || !data) throw new Error(`createConversation: ${error?.message ?? "no row"}`);
  return rowToConversation(data as DbConvRow);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const ctx = await resolveSupa();
  if (!ctx) return memGet(id);

  const { data: convRow, error: convErr } = await ctx.supa
    .from("kali_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (convErr) throw new Error(`getConversation: ${convErr.message}`);
  if (!convRow) return null;

  const { data: msgRows, error: msgErr } = await ctx.supa
    .from("kali_messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (msgErr) throw new Error(`getConversation messages: ${msgErr.message}`);

  return rowToConversation(
    convRow as DbConvRow,
    ((msgRows ?? []) as DbMsgRow[]).map(rowToMessage),
  );
}

/** Get-or-create. Async equivalent of the old sync helper. */
export async function getOrCreateConversation(
  id: string | undefined,
  opts: CreateOptions = {},
): Promise<{ conversation: Conversation; created: boolean }> {
  if (id && id.length > 0) {
    const existing = await getConversation(id);
    if (existing) return { conversation: existing, created: false };
    return { conversation: await createConversation({ ...opts, id }), created: true };
  }
  const { id: _drop, ...rest } = opts;
  void _drop;
  return { conversation: await createConversation(rest), created: true };
}

export async function appendMessage(opts: AppendMessageOpts): Promise<ConversationMessage> {
  const ctx = await resolveSupa();
  if (!ctx) return memAppend(opts);

  const insert = {
    conversation_id: opts.conversationId,
    role: opts.role,
    content: opts.content,
    tool_calls: opts.toolCalls ?? null,
    citations: opts.citations ?? null,
  };
  const { data, error } = await ctx.supa
    .from("kali_messages")
    .insert(insert)
    .select("*")
    .single();
  if (error || !data) throw new Error(`appendMessage: ${error?.message ?? "no row"}`);

  // Auto-title from the first user message if none set yet.
  if (opts.role === "user") {
    const { data: convRow } = await ctx.supa
      .from("kali_conversations")
      .select("title")
      .eq("id", opts.conversationId)
      .maybeSingle();
    if (convRow && !convRow.title) {
      const title = opts.content.replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled";
      await ctx.supa.from("kali_conversations").update({ title }).eq("id", opts.conversationId);
    }
  }

  return rowToMessage(data as DbMsgRow);
}

export async function updateMessage(opts: UpdateMessageOpts): Promise<ConversationMessage | null> {
  const ctx = await resolveSupa();
  if (!ctx) return memUpdate(opts);

  const patch: Record<string, unknown> = {};
  if (opts.content !== undefined) patch.content = opts.content;
  if (opts.toolCalls !== undefined) patch.tool_calls = opts.toolCalls;
  if (opts.citations !== undefined) patch.citations = opts.citations;
  if (Object.keys(patch).length === 0) {
    // Nothing to update — fetch + return current row.
    const { data } = await ctx.supa
      .from("kali_messages")
      .select("*")
      .eq("id", opts.messageId)
      .maybeSingle();
    return data ? rowToMessage(data as DbMsgRow) : null;
  }

  const { data, error } = await ctx.supa
    .from("kali_messages")
    .update(patch)
    .eq("id", opts.messageId)
    .eq("conversation_id", opts.conversationId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`updateMessage: ${error.message}`);
  return data ? rowToMessage(data as DbMsgRow) : null;
}

export async function listConversations(args: {
  tenantId?: string;
  userId?: string;
  limit?: number;
} = {}): Promise<Conversation[]> {
  const ctx = await resolveSupa();
  if (!ctx) return memList(args);

  let q = ctx.supa
    .from("kali_conversations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (args.tenantId) q = q.eq("tenant_id", args.tenantId);
  q = q.limit(Math.min(Math.max(args.limit ?? 50, 1), 200));

  const { data, error } = await q;
  if (error) throw new Error(`listConversations: ${error.message}`);
  // Return shallow conversations (no messages) — matches the previous
  // memory behavior where `messages: []` came along but most callers don't
  // need them in a list view.
  return ((data ?? []) as DbConvRow[]).map(c => rowToConversation(c, []));
}

export async function deleteConversation(id: string): Promise<boolean> {
  const ctx = await resolveSupa();
  if (!ctx) return memDelete(id);

  const { error, count } = await ctx.supa
    .from("kali_conversations")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw new Error(`deleteConversation: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function setConversationTitle(id: string, title: string): Promise<void> {
  const ctx = await resolveSupa();
  if (!ctx) {
    const c = __byId.get(id);
    if (c) c.title = title;
    return;
  }
  const { error } = await ctx.supa
    .from("kali_conversations")
    .update({ title: title.slice(0, 200) })
    .eq("id", id);
  if (error) throw new Error(`setConversationTitle: ${error.message}`);
}
