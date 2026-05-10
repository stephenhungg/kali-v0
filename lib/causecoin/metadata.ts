/**
 * Token metadata builder. Cause coins use Token-2022 metadata pointer so
 * EIN, IRS status, and the speculative-purchase disclaimer are baked into
 * onchain metadata that wallets surface natively. Off-chain JSON URI
 * carries the long-form fields (cause description, attributes).
 */

import type { TenantRecord } from "@/lib/tenants";

export interface CauseCoinMetadata {
  name: string;
  symbol: string;
  description: string;
  image?: string;
  external_url?: string;
  attributes: Array<{ trait_type: string; value: string | number | boolean }>;
  properties: {
    ein: string;
    irs_status: string;
    cause: string;
    launch_disclaimer: string;
    kali_tenant_id: string;
  };
}

const DEFAULT_DISCLAIMER =
  "Speculative purchase. NOT a donation. NOT tax-deductible. Token grants governance over a community fund only — for tax-deductible giving, use the Kali x402 endpoint at pay.kalilabs.ai.";

export function buildTokenMetadata(opts: {
  tenant: TenantRecord;
  symbol: string;
  name: string;
  cause?: string;
  imageUrl?: string;
}): CauseCoinMetadata {
  return {
    name: `${opts.tenant.name} — ${opts.name}`,
    symbol: opts.symbol,
    description: `${opts.cause ?? opts.tenant.mission} — community-issued token. Trading fees route 100% to ${opts.tenant.name}'s treasury.`,
    image: opts.imageUrl,
    external_url: `https://${process.env.KALI_COIN_HOST ?? "coin.kalilabs.ai"}/${opts.tenant.slug}`,
    attributes: [
      { trait_type: "EIN", value: opts.tenant.ein },
      { trait_type: "IRS Status", value: opts.tenant.taxStatus },
      { trait_type: "Cause", value: opts.cause ?? "Community Foundation" },
      { trait_type: "Issuer", value: opts.tenant.name },
      { trait_type: "Issued by", value: "Kali Labs" },
      { trait_type: "Tax-deductible", value: false },
    ],
    properties: {
      ein: opts.tenant.ein,
      irs_status: opts.tenant.taxStatus,
      cause: opts.cause ?? opts.tenant.mission,
      launch_disclaimer: DEFAULT_DISCLAIMER,
      kali_tenant_id: opts.tenant.id,
    },
  };
}
