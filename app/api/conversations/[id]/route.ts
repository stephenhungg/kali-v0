/**
 * /api/conversations/:id
 *
 *   GET    → return conversation + full message history
 *   DELETE → remove the conversation (404 if missing)
 *
 * Messages include their toolCalls + citations so the chat UI can
 * re-render an old session with the same source-pulse + citation chips
 * as the original turn.
 */

import { NextResponse } from "next/server";
import {
  deleteConversation,
  getConversation,
} from "@/lib/agent/conversations";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const c = await getConversation(id);
  if (!c) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation: c });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const ok = await deleteConversation(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: id });
}
