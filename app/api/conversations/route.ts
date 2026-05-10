/**
 * /api/conversations
 *
 *   GET  ?tenantId=…&userId=…&limit=…  → list conversations (newest first)
 *   POST { tenantId?, userId?, title? }  → create a new conversation
 *
 * The persistence store is in-memory for v1 (`lib/agent/conversations.ts`).
 * Production swaps to the Drizzle `conversations` + `messages` tables.
 */

import { NextResponse } from "next/server";
import {
  createConversation,
  listConversations,
} from "@/lib/agent/conversations";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const userId = url.searchParams.get("userId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 200) : 50;

  const conversations = listConversations({ tenantId, userId, limit });
  return NextResponse.json({
    count: conversations.length,
    // Strip messages for the list view — keeps the response small.
    conversations: conversations.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      userId: c.userId,
      title: c.title ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    })),
  });
}

interface CreateBody {
  tenantId?: string;
  userId?: string;
  title?: string;
}

export async function POST(req: Request) {
  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    // Empty body is fine — defaults apply.
  }
  const c = createConversation({
    tenantId: body.tenantId,
    userId: body.userId,
    title: body.title,
  });
  return NextResponse.json(
    {
      id: c.id,
      tenantId: c.tenantId,
      userId: c.userId,
      title: c.title ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: 0,
    },
    { status: 201 },
  );
}
