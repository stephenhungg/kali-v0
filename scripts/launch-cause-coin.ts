/**
 * One-shot CLI to deploy a cause coin for a tenant. Mirrors what the agent
 * does via `causecoin.launch`. Usage:
 *
 *   bun scripts/launch-cause-coin.ts --tenant rivertown --symbol RVRT --name Rivertown
 */

import "@/lib/agent/registrations";
import { resolveTenant } from "@/lib/tenants";
import { launchCauseCoin } from "@/lib/causecoin/deploy";

interface Args {
  tenant: string;
  symbol: string;
  name: string;
  cause?: string;
  feeBps?: number;
  communityFundBps?: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    if (i === -1) return d;
    return argv[i + 1];
  };
  const tenant = get("tenant");
  const symbol = get("symbol");
  const name = get("name", `${symbol} Token`);
  if (!tenant || !symbol || !name) {
    console.error("usage: bun scripts/launch-cause-coin.ts --tenant <slug> --symbol <SYM> [--name <name>] [--cause <text>]");
    process.exit(1);
  }
  return {
    tenant,
    symbol,
    name,
    cause: get("cause"),
    feeBps: get("feeBps") ? Number(get("feeBps")) : undefined,
    communityFundBps: get("communityFundBps") ? Number(get("communityFundBps")) : undefined,
  };
}

async function main() {
  const args = parseArgs();
  const tenant = await resolveTenant(args.tenant);
  if (!tenant) {
    console.error(`tenant '${args.tenant}' not found`);
    process.exit(1);
  }
  console.log(`[launch] deploying $${args.symbol} for ${tenant.name}…`);
  const result = await launchCauseCoin(tenant, {
    symbol: args.symbol,
    name: args.name,
    cause: args.cause,
    feeBps: args.feeBps,
    communityFundBps: args.communityFundBps,
  });
  console.log("\n──── deployed ──────────────────────────────────────────────");
  console.log(`  symbol  $${result.coin.symbol}`);
  console.log(`  mint    ${result.coin.mint}`);
  console.log(`  pool    ${result.coin.bondingCurvePool}`);
  console.log(`  treasury ${result.coin.treasuryWallet}`);
  console.log(`  network ${result.coin.network}`);
  console.log(`  message ${result.message}`);
  console.log("\n  explorer urls");
  console.log(`    mint  ↗ ${result.explorerUrls.mint}`);
  console.log(`    pool  ↗ ${result.explorerUrls.pool}`);
  if (result.explorerUrls.deployTx) {
    console.log(`    deploy ↗ ${result.explorerUrls.deployTx}`);
  }
  console.log("\n  trade at  https://" + (process.env.KALI_COIN_HOST ?? "coin.kalilabs.ai") + "/" + tenant.slug);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
