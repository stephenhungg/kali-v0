/**
 * GET /api/coin/<mint>/fees-stream
 *
 * Server-Sent Events stream of cumulative fees to treasury. The cause-coin
 * page subscribes to this so the headline counter ticks up live whenever
 * a buyer's tx is recorded.
 *
 * Polls every 1.5s and emits `data: { treasury, communityFund, total }` —
 * the tickers are the demo's emotional centerpiece (cspec §5 demo line 2).
 */

import { cumulativeFees, loadCoin, loadCoinBySymbol } from "@/lib/causecoin/trading";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ mint: string }> },
) {
  const { mint } = await params;
  const coin = loadCoin(mint) ?? loadCoinBySymbol(mint);
  if (!coin) {
    return new Response(JSON.stringify({ error: "coin not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };
      // Initial frame.
      send({ ...cumulativeFees(coin.id), at: Date.now() });

      const interval = setInterval(() => {
        try {
          send({ ...cumulativeFees(coin.id), at: Date.now() });
        } catch {
          clearInterval(interval);
        }
      }, 1500);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
