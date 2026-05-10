/**
 * Bonding curve math. The cause-coin spec calls for a *linear* curve
 * (cspec §2.1) for predictable price action vs the exponential curves that
 * make pump.fun feel like a casino.
 *
 * We model:
 *   reserve(s) = (initial_reserve_usd + slope * s)
 * where `s` is fraction-of-supply consumed (0..1). Buying USDC `q` advances
 * `s` until the cumulative cost integral equals `q`, minus the trading
 * fee (bps applied at the rim).
 *
 * The integral has a closed form:
 *   q = (1/2) * slope * (s2^2 - s1^2) + (initial_reserve - 0) * (s2 - s1)
 * Solving for s2 given s1 + q is a quadratic.
 *
 * For the v1 demo we work in USDC dollars (no decimals) and SUPPLY units
 * normalized to 1 (so the holder dashboard's "1.2% of supply" is
 * meaningful). 1B token supply on chain → 1.0 here.
 */

export interface CurveState {
  /** USDC market cap implied by the curve at progression `s`. */
  marketCapUsd: number;
  /** Implied price per token in USDC. */
  priceUsdc: number;
  /** Fraction of bonding-curve supply consumed (0..1). */
  progression: number;
  /** Cumulative USDC raised by the curve. */
  reserveUsdc: number;
}

export interface CurveConfig {
  /** Curve start price in USDC per token (e.g. 0.000005 → $5K market cap on 1B supply). */
  initialPriceUsdc: number;
  /** Slope: how fast price rises per fraction-of-supply consumed. */
  slope: number;
  /** Total supply allocated to the bonding curve (e.g. 800M of 1B = 0.8). */
  bondingSupplyFraction: number;
  /** Fee in basis points (100 = 1%). */
  feeBps: number;
  /** % of fee that goes to community fund (rest to treasury). 2000 = 20%. */
  communityFundShareBps: number;
  /** Graduation market cap in USD. Defaults to $69K per cspec. */
  graduationThresholdUsd: number;
  /** Total token supply on chain (e.g. 1_000_000_000). */
  totalSupply: number;
}

export const DEFAULT_CURVE: CurveConfig = {
  initialPriceUsdc: 0.000005, // $5K market cap on 1B supply
  slope: 0.0001, // ramps to ~$100K market cap at full bonding
  bondingSupplyFraction: 0.8,
  feeBps: 100,
  communityFundShareBps: 2000,
  graduationThresholdUsd: 69_000,
  totalSupply: 1_000_000_000,
};

export function priceAt(progression: number, cfg: CurveConfig = DEFAULT_CURVE): number {
  return cfg.initialPriceUsdc + cfg.slope * progression;
}

export function marketCapAt(
  progression: number,
  cfg: CurveConfig = DEFAULT_CURVE,
): number {
  return priceAt(progression, cfg) * cfg.totalSupply;
}

export function progressionFromMarketCap(
  marketCapUsd: number,
  cfg: CurveConfig = DEFAULT_CURVE,
): number {
  const priceTarget = marketCapUsd / cfg.totalSupply;
  return Math.max(0, Math.min(1, (priceTarget - cfg.initialPriceUsdc) / cfg.slope));
}

/** Reserve raised between progression s1 and s2 (s2 > s1). */
export function reserveBetween(
  s1: number,
  s2: number,
  cfg: CurveConfig = DEFAULT_CURVE,
): number {
  // ∫ (initial + slope * s) ds  from s1 to s2
  // = initial * (s2 - s1) + slope/2 * (s2^2 - s1^2)
  // Times totalSupply * bondingSupplyFraction (the actual tokens being sold).
  const tokens = cfg.totalSupply * cfg.bondingSupplyFraction;
  return (
    (cfg.initialPriceUsdc * (s2 - s1) + (cfg.slope / 2) * (s2 * s2 - s1 * s1)) *
    tokens
  );
}

/** Tokens released between progression s1 and s2 (s2 > s1). */
export function tokensBetween(
  s1: number,
  s2: number,
  cfg: CurveConfig = DEFAULT_CURVE,
): number {
  return cfg.totalSupply * cfg.bondingSupplyFraction * (s2 - s1);
}

/** Solve for s2 given s1 and a USDC notional q (excluding fee). */
export function progressionAfterBuy(
  s1: number,
  usdcNet: number,
  cfg: CurveConfig = DEFAULT_CURVE,
): number {
  const tokens = cfg.totalSupply * cfg.bondingSupplyFraction;
  // (slope/2) * s2^2 + initial * s2 - (q/tokens + (slope/2) * s1^2 + initial * s1) = 0
  const a = cfg.slope / 2;
  const b = cfg.initialPriceUsdc;
  const c = -(usdcNet / tokens + (cfg.slope / 2) * s1 * s1 + cfg.initialPriceUsdc * s1);
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return s1;
  const s2 = (-b + Math.sqrt(disc)) / (2 * a);
  return Math.max(s1, Math.min(1, s2));
}

export interface BuyQuote {
  tokensOut: number;
  priceBefore: number;
  priceAfter: number;
  feeUsdc: number;
  treasuryFeeUsdc: number;
  communityFundFeeUsdc: number;
  slippagePct: number;
  newProgression: number;
  newMarketCapUsd: number;
}

export function quoteBuy(
  currentProgression: number,
  usdcGross: number,
  cfg: CurveConfig = DEFAULT_CURVE,
): BuyQuote {
  const fee = (usdcGross * cfg.feeBps) / 10_000;
  const fundShare = (fee * cfg.communityFundShareBps) / 10_000;
  const treasuryShare = fee - fundShare;
  const net = usdcGross - fee;

  const s1 = currentProgression;
  const s2 = progressionAfterBuy(s1, net, cfg);
  const tokensOut = tokensBetween(s1, s2, cfg);
  const priceBefore = priceAt(s1, cfg);
  const priceAfter = priceAt(s2, cfg);
  const slippage = priceBefore > 0 ? (priceAfter - priceBefore) / priceBefore : 0;

  return {
    tokensOut,
    priceBefore,
    priceAfter,
    feeUsdc: fee,
    treasuryFeeUsdc: treasuryShare,
    communityFundFeeUsdc: fundShare,
    slippagePct: slippage * 100,
    newProgression: s2,
    newMarketCapUsd: marketCapAt(s2, cfg),
  };
}

/** Inverse: solve for s1 given (s2, USDC raised between). */
export function progressionAfterSell(
  s2: number,
  usdcNet: number,
  cfg: CurveConfig = DEFAULT_CURVE,
): number {
  const tokens = cfg.totalSupply * cfg.bondingSupplyFraction;
  // Same closed form, mirrored.
  const a = cfg.slope / 2;
  const b = cfg.initialPriceUsdc;
  const target = (cfg.slope / 2) * s2 * s2 + cfg.initialPriceUsdc * s2 - usdcNet / tokens;
  // a*s1^2 + b*s1 - target = 0
  const c = -target;
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return s2;
  const s1 = (-b + Math.sqrt(disc)) / (2 * a);
  return Math.max(0, Math.min(s2, s1));
}
