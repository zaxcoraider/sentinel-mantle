// RulesCache — per-agent SafetyRules snapshot with a short TTL (rules rarely
// change, so caching avoids a chain read on every agent action).
//
// The reader is injected (RulesReader) so the cache logic is testable without a
// chain; createViemRulesReader is the production implementation. The allowlist is
// an on-chain mapping (not enumerable), so it's reconstructed by folding the
// contract's ProtocolAllowlistChanged event history.

import { getAddress, type Address, type PublicClient } from "viem";
import { safetyRulesAbi } from "./abis.js";
import type { SafetyRulesSnapshot } from "./types.js";

/** The raw rule data a reader must supply; allowlist comes back as an address list. */
export interface RulesReader {
  readScalars(rules: Address): Promise<Omit<SafetyRulesSnapshot, "allowedProtocols">>;
  readAllowlist(rules: Address): Promise<Address[]>;
}

interface CacheEntry {
  value: SafetyRulesSnapshot;
  expires: number;
}

export interface RulesCacheOptions {
  ttlMs?: number;
  now?: () => number;
}

export class RulesCache {
  private readonly reader: RulesReader;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(reader: RulesReader, opts: RulesCacheOptions = {}) {
    this.reader = reader;
    this.ttlMs = opts.ttlMs ?? 60_000;
    this.now = opts.now ?? Date.now;
  }

  async get(rules: Address): Promise<SafetyRulesSnapshot> {
    const key = getAddress(rules);
    const now = this.now();
    const cached = this.cache.get(key);
    if (cached && cached.expires > now) return cached.value;

    const [scalars, allowlist] = await Promise.all([
      this.reader.readScalars(key),
      this.reader.readAllowlist(key),
    ]);
    const value: SafetyRulesSnapshot = {
      ...scalars,
      allowedProtocols: new Set(allowlist.map(getAddress)),
    };
    this.cache.set(key, { value, expires: now + this.ttlMs });
    return value;
  }

  invalidate(rules: Address): void {
    this.cache.delete(getAddress(rules));
  }
}

/** Production reader backed by a viem PublicClient. */
export const createViemRulesReader = (client: PublicClient): RulesReader => ({
  readScalars: async (rules) => {
    const [maxDrawdownBps, maxTxPerHour, oracleDeviationBps, dailyVolumeCapUsd, timeOfDayMin, timeOfDayMax] =
      await Promise.all([
        client.readContract({ address: rules, abi: safetyRulesAbi, functionName: "maxDrawdownBps" }),
        client.readContract({ address: rules, abi: safetyRulesAbi, functionName: "maxTxPerHour" }),
        client.readContract({ address: rules, abi: safetyRulesAbi, functionName: "oracleDeviationBps" }),
        client.readContract({ address: rules, abi: safetyRulesAbi, functionName: "dailyVolumeCapUsd" }),
        client.readContract({ address: rules, abi: safetyRulesAbi, functionName: "timeOfDayMin" }),
        client.readContract({ address: rules, abi: safetyRulesAbi, functionName: "timeOfDayMax" }),
      ]);
    return { maxDrawdownBps, maxTxPerHour, oracleDeviationBps, dailyVolumeCapUsd, timeOfDayMin, timeOfDayMax };
  },
  // Fold the full ProtocolAllowlistChanged history into the current allowed set.
  // fromBlock 0n is fine for these small per-agent contracts.
  readAllowlist: async (rules) => {
    const logs = await client.getContractEvents({
      address: rules,
      abi: safetyRulesAbi,
      eventName: "ProtocolAllowlistChanged",
      fromBlock: 0n,
      toBlock: "latest",
    });
    const state = new Map<Address, boolean>();
    for (const log of logs) {
      const { protocol, allowed } = log.args;
      if (protocol !== undefined && allowed !== undefined) {
        state.set(getAddress(protocol), allowed);
      }
    }
    return [...state.entries()].filter(([, allowed]) => allowed).map(([addr]) => addr);
  },
});
