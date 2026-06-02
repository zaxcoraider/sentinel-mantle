// PythClient — fetches reference prices from Pyth's Hermes service and normalizes
// them to 18-decimal USD so they're directly comparable to agent prices and the
// SafetyRules oracle-deviation threshold. Prices are cached briefly (default 30s)
// to avoid hammering Hermes on every agent action.
//
// Per CLAUDE.md hard rule #8, a Pyth price must never be trusted blindly — it is
// only ever compared against the agent's actual traded price in the anomaly
// engine, never used as ground truth on its own.

import type { Hex } from "viem";
import type { PythPrice } from "./types.js";

export class PythError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythError";
  }
}

// Well-known Pyth price feed IDs. IDs below were pulled verbatim from Hermes
// (GET /v2/price_feeds?query=<symbol>&asset_type=crypto) on 2026-06-02 — the
// authoritative source. Verify / extend from:
//   https://pyth.network/developers/price-feed-ids
export const PYTH_FEEDS = {
  "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "BTC/USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  // Mantle-native guarded assets.
  "MNT/USD": "0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585",
  "METH/USD": "0xfbc9c3a716650b6e24ab22ab85b1c0ef4141b18f4590cc0b986e2f9064cf73d6",
  "USDY/USD": "0xe393449f6aff8a4b6d3e1165a7c9ebec103685f3b41e60db4277b5b6d10e7326",
  "USDE/USD": "0x6ec879b1e9963de5ee97e9c8710b742d6228252a5e2ca12d4ae81d7fe5ee8c5d",
} as const satisfies Record<string, Hex>;

interface HermesPriceFeed {
  id: string;
  price: { price: string; conf: string; expo: number; publish_time: number };
}

/** Convert Pyth's (mantissa, expo) price into 18-decimal fixed point USD. */
export const normalizeTo18dp = (mantissa: string, expo: number): bigint => {
  const base = BigInt(mantissa);
  const shift = 18 + expo;
  return shift >= 0 ? base * 10n ** BigInt(shift) : base / 10n ** BigInt(-shift);
};

const normalizeId = (id: string): string => `0x${id.replace(/^0x/, "").toLowerCase()}`;

interface CacheEntry {
  value: PythPrice;
  expires: number;
}

export interface PythClientOptions {
  endpoint?: string;
  ttlMs?: number;
  /** Injectable for testing. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export class PythClient {
  private readonly endpoint: string;
  private readonly ttlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(opts: PythClientOptions = {}) {
    this.endpoint = (opts.endpoint ?? "https://hermes.pyth.network").replace(/\/$/, "");
    this.ttlMs = opts.ttlMs ?? 30_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  async getPrice(feedId: Hex): Promise<PythPrice> {
    const key = normalizeId(feedId);
    const now = this.now();
    const cached = this.cache.get(key);
    if (cached && cached.expires > now) return cached.value;

    const url = `${this.endpoint}/api/latest_price_feeds?ids[]=${feedId}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url);
    } catch (err) {
      throw new PythError(
        `Hermes request failed for ${feedId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!res.ok) throw new PythError(`Hermes returned ${res.status} for ${feedId}`);

    const feeds = (await res.json()) as HermesPriceFeed[];
    const feed = feeds.find((f) => normalizeId(f.id) === key) ?? feeds[0];
    if (!feed) throw new PythError(`Hermes returned no feed for ${feedId}`);

    const value: PythPrice = {
      feedId,
      priceUsd: normalizeTo18dp(feed.price.price, feed.price.expo),
      publishTime: feed.price.publish_time,
    };
    this.cache.set(key, { value, expires: now + this.ttlMs });
    return value;
  }
}
