// ValuationReader — values each guarded agent's *protected capital* (the balance
// the SentinelGuard holds for it) in USD, using Pyth reference prices.
//
// This is what makes the drawdown/oracle/volume detectors live: nothing else
// calls StateStore.recordValuation. We value the on-chain guard balance (real,
// readable) rather than the agent's full cross-protocol P&L, which isn't
// tractable off-chain. If the guarded value falls from its high-water mark past
// the SafetyRules drawdown limit, the engine trips.
//
// Per CLAUDE.md rule #8, Pyth is never ground truth on its own — here it only
// converts a real on-chain token balance into a USD figure for the drawdown
// comparison; the *balance* is authoritative on-chain state.

import { getAddress, type Address, type Hex, type PublicClient } from "viem";
import { sentinelGuardFunctions } from "./abis.js";
import { PYTH_FEEDS } from "./pyth.js";
import type { PythClient } from "./pyth.js";

const ONE = 10n ** 18n;
const NATIVE: Address = "0x0000000000000000000000000000000000000000";

export interface ValuationToken {
  symbol: string;
  /** Guard balance key — address(0) for native MNT. */
  token: Address;
  feed: Hex;
  decimals: number;
}

// Mantle Mainnet guarded assets (token addresses per CLAUDE.md; all 18-decimal).
const MAINNET_TOKENS: ValuationToken[] = [
  { symbol: "MNT", token: NATIVE, feed: PYTH_FEEDS["MNT/USD"], decimals: 18 },
  {
    symbol: "mETH",
    token: getAddress("0xcDA86A272531e8640cD7F1a92c01839911B90bb0"),
    feed: PYTH_FEEDS["METH/USD"],
    decimals: 18,
  },
  {
    symbol: "USDY",
    token: getAddress("0x5bE26527e817998A7206475496fDE1E68957c5A6"),
    feed: PYTH_FEEDS["USDY/USD"],
    decimals: 18,
  },
  {
    symbol: "USDe",
    token: getAddress("0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34"),
    feed: PYTH_FEEDS["USDE/USD"],
    decimals: 18,
  },
];

// Sepolia: the ERC-20s aren't deployed there; only native MNT is guarded.
const SEPOLIA_TOKENS: ValuationToken[] = [
  { symbol: "MNT", token: NATIVE, feed: PYTH_FEEDS["MNT/USD"], decimals: 18 },
];

export const tokensForChain = (chainId: number): ValuationToken[] =>
  chainId === 5000 ? MAINNET_TOKENS : SEPOLIA_TOKENS;

/** Scale a raw token balance to 18 decimals. */
const to18 = (raw: bigint, decimals: number): bigint =>
  decimals === 18
    ? raw
    : decimals < 18
      ? raw * 10n ** BigInt(18 - decimals)
      : raw / 10n ** BigInt(decimals - 18);

// Minimal chain surface the reader needs — injectable so the reader is unit
// testable without a live RPC (mirrors createViemRulesReader / GuardWriter).
export interface ValuationChain {
  balanceOf(agent: Address, token: Address): Promise<bigint>;
  isPaused(agent: Address): Promise<boolean>;
}

export const createViemValuationChain = (
  client: PublicClient,
  guard: Address,
): ValuationChain => ({
  balanceOf: async (agent, token) =>
    (await client.readContract({
      address: guard,
      abi: sentinelGuardFunctions,
      functionName: "balanceOf",
      args: [agent, token],
    })) as bigint,
  isPaused: async (agent) =>
    (await client.readContract({
      address: guard,
      abi: sentinelGuardFunctions,
      functionName: "isPaused",
      args: [agent],
    })) as boolean,
});

export interface ValuationReaderDeps {
  chain: ValuationChain;
  pyth: PythClient;
  tokens: ValuationToken[];
}

export class ValuationReader {
  constructor(private readonly deps: ValuationReaderDeps) {}

  /** True if the guard has this agent paused (skip valuation/drawdown then). */
  isPaused(agent: Address): Promise<boolean> {
    return this.deps.chain.isPaused(agent);
  }

  /**
   * Total USD (18dp) the guard holds for `agent` across the configured tokens.
   * A token with a zero balance is skipped (no price fetch). Throws if a needed
   * Pyth price can't be fetched — caller decides to fail open.
   */
  async valueAgent(agent: Address): Promise<bigint> {
    let total = 0n;
    for (const t of this.deps.tokens) {
      const bal = await this.deps.chain.balanceOf(agent, t.token);
      if (bal === 0n) continue;
      const price = await this.deps.pyth.getPrice(t.feed);
      total += (to18(bal, t.decimals) * price.priceUsd) / ONE;
    }
    return total;
  }
}
