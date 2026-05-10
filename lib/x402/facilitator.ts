/**
 * Facilitator adapters. The x402 spec defines the protocol but lets each
 * implementation pick how it actually settles the payment onchain. Three
 * options:
 *
 *   - **self-hosted** (default in dev): we deserialize the inner tx, send
 *     it to devnet via `connection.sendRawTransaction`, wait for confirm.
 *     Fully under our control. Good enough for the demo + most tenants.
 *
 *   - **payai**: PayAI Network's facilitator API. Generous free tier on
 *     devnet, takes a small fee on mainnet. Recommended for v1 tenants.
 *
 *   - **coinbase**: Coinbase CDP facilitator. 1,000 free txs/month.
 *     Multi-chain. Brand recognition wins for foundation funders.
 *
 * Per-tenant override at `tenants.config.facilitator`. Falls back to the
 * `KALI_X402_FACILITATOR` env var.
 */

import {
  Connection,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { getConnection } from "@/lib/wallets/privy";

export type FacilitatorKind = "self-hosted" | "payai" | "coinbase";

export interface SettleResult {
  ok: boolean;
  txSignature: string;
  network: string;
  confirmedInMs: number;
  reason?: string;
}

export interface Facilitator {
  kind: FacilitatorKind;
  settle(opts: {
    signedTx: Transaction | VersionedTransaction;
    network: string;
  }): Promise<SettleResult>;
}

/* ─── self-hosted ────────────────────────────────────────────────────── */

class SelfHostedFacilitator implements Facilitator {
  kind: FacilitatorKind = "self-hosted";

  async settle(opts: {
    signedTx: Transaction | VersionedTransaction;
    network: string;
  }): Promise<SettleResult> {
    const t0 = Date.now();
    const conn = getConnection(opts.network as "solana-devnet" | "solana-mainnet");
    try {
      const raw =
        "serialize" in opts.signedTx
          ? opts.signedTx.serialize()
          : (opts.signedTx as Transaction).serialize();
      const sig = await conn.sendRawTransaction(raw, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 5,
      });
      await conn.confirmTransaction(sig, "confirmed");
      return {
        ok: true,
        txSignature: sig,
        network: opts.network,
        confirmedInMs: Date.now() - t0,
      };
    } catch (e) {
      return {
        ok: false,
        txSignature: "",
        network: opts.network,
        confirmedInMs: Date.now() - t0,
        reason: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

/* ─── PayAI ──────────────────────────────────────────────────────────── */

class PayAIFacilitator implements Facilitator {
  kind: FacilitatorKind = "payai";
  private readonly base = "https://facilitator.payai.network";

  async settle(opts: {
    signedTx: Transaction | VersionedTransaction;
    network: string;
  }): Promise<SettleResult> {
    const t0 = Date.now();
    const apiKey = process.env.PAYAI_API_KEY;
    const raw =
      "serialize" in opts.signedTx
        ? opts.signedTx.serialize()
        : (opts.signedTx as Transaction).serialize();
    try {
      const res = await fetch(`${this.base}/v1/settle`, {
        method: "POST",
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          network: opts.network,
          serializedTransaction: Buffer.from(raw).toString("base64"),
        }),
      });
      if (!res.ok) {
        return {
          ok: false,
          txSignature: "",
          network: opts.network,
          confirmedInMs: Date.now() - t0,
          reason: `payai ${res.status}: ${await res.text()}`,
        };
      }
      const data = (await res.json()) as { signature: string };
      return {
        ok: true,
        txSignature: data.signature,
        network: opts.network,
        confirmedInMs: Date.now() - t0,
      };
    } catch (e) {
      return {
        ok: false,
        txSignature: "",
        network: opts.network,
        confirmedInMs: Date.now() - t0,
        reason: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

/* ─── Coinbase CDP ───────────────────────────────────────────────────── */

class CoinbaseFacilitator implements Facilitator {
  kind: FacilitatorKind = "coinbase";
  private readonly base = "https://api.cdp.coinbase.com/x402";

  async settle(opts: {
    signedTx: Transaction | VersionedTransaction;
    network: string;
  }): Promise<SettleResult> {
    const t0 = Date.now();
    const key = process.env.COINBASE_CDP_KEY;
    if (!key) {
      return {
        ok: false,
        txSignature: "",
        network: opts.network,
        confirmedInMs: 0,
        reason: "COINBASE_CDP_KEY not configured",
      };
    }
    const raw =
      "serialize" in opts.signedTx
        ? opts.signedTx.serialize()
        : (opts.signedTx as Transaction).serialize();
    try {
      const res = await fetch(`${this.base}/v1/settle`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          network: opts.network,
          serializedTransaction: Buffer.from(raw).toString("base64"),
        }),
      });
      if (!res.ok) {
        return {
          ok: false,
          txSignature: "",
          network: opts.network,
          confirmedInMs: Date.now() - t0,
          reason: `coinbase ${res.status}: ${await res.text()}`,
        };
      }
      const data = (await res.json()) as { signature: string };
      return {
        ok: true,
        txSignature: data.signature,
        network: opts.network,
        confirmedInMs: Date.now() - t0,
      };
    } catch (e) {
      return {
        ok: false,
        txSignature: "",
        network: opts.network,
        confirmedInMs: Date.now() - t0,
        reason: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

/* ─── factory ────────────────────────────────────────────────────────── */

export function getFacilitator(kind?: FacilitatorKind): Facilitator {
  const resolved =
    kind ??
    (process.env.KALI_X402_FACILITATOR as FacilitatorKind | undefined) ??
    "self-hosted";
  switch (resolved) {
    case "payai":
      return new PayAIFacilitator();
    case "coinbase":
      return new CoinbaseFacilitator();
    case "self-hosted":
    default:
      return new SelfHostedFacilitator();
  }
}

void Connection;
