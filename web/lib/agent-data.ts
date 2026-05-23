// Server-side data fetching for agent detail and leaderboard pages.
// All reads are via the viem public client (chain.ts) — no browser APIs here.

import { unstable_cache } from 'next/cache';
import { getAddress, type Address } from 'viem';
import { publicClient } from './chain';
import {
  DEPLOYMENTS,
  NATIVE_TOKEN,
  AgentRegistryAbi,
  SentinelGuardAbi,
  SafetyRulesAbi,
  ReputationOracleAbi,
} from './contracts';

const SEP = DEPLOYMENTS.sepolia;

// ---- Types -----------------------------------------------------------------

export interface GuardConfig {
  erc8004TokenId: bigint;
  rulesContract: Address;
  guardContract: Address;
  registeredAt: bigint;
  active: boolean;
}

export interface SafetyRulesConfig {
  maxDrawdownBps: bigint;
  maxTxPerHour: bigint;
  oracleDeviationBps: bigint;
  dailyVolumeCapUsd: bigint;
  timeOfDayMin: number;
  timeOfDayMax: number;
  allowedProtocolCount: bigint;
}

export interface RepHistory {
  eventType: number;
  timestamp: bigint;
  delta: number;
  scoreAfter: number;
}

export interface AgentReputation {
  score: bigint;
  lastUpdated: bigint;
  eventCount: bigint;
  history: RepHistory[];
}

export interface AgentDetail {
  agent: Address;
  isGuarded: boolean;
  isPaused: boolean;
  config: GuardConfig | null;
  rules: SafetyRulesConfig | null;
  reputation: AgentReputation | null;
  nativeMntBalance: bigint;
  daysGuarded: number;
  owner: Address | null;
}

export interface LeaderboardEntry {
  rank: number;
  agent: Address;
  score: bigint;
  eventCount: bigint;
  daysGuarded: number;
  isPaused: boolean;
  registeredAt: bigint;
}

// ---- Agent detail ----------------------------------------------------------

const fetchAgentDetail = async (agent: Address): Promise<AgentDetail> => {
  const EMPTY: AgentDetail = {
    agent,
    isGuarded: false,
    isPaused: false,
    config: null,
    rules: null,
    reputation: null,
    nativeMntBalance: BigInt(0),
    daysGuarded: 0,
    owner: null,
  };

  try {
    const isGuarded = await publicClient.readContract({
      address: SEP.AgentRegistry,
      abi: AgentRegistryAbi,
      functionName: 'isGuarded',
      args: [agent],
    });

    if (!isGuarded) return EMPTY;

    const [config, isPaused, repResult, mntBalance, owner] = await Promise.allSettled([
      publicClient.readContract({
        address: SEP.AgentRegistry,
        abi: AgentRegistryAbi,
        functionName: 'getGuardConfig',
        args: [agent],
      }),
      publicClient.readContract({
        address: SEP.SentinelGuard,
        abi: SentinelGuardAbi,
        functionName: 'isPaused',
        args: [agent],
      }),
      publicClient.readContract({
        address: SEP.ReputationOracle,
        abi: ReputationOracleAbi,
        functionName: 'getReputation',
        args: [agent],
      }),
      publicClient.readContract({
        address: SEP.SentinelGuard,
        abi: SentinelGuardAbi,
        functionName: 'balanceOf',
        args: [agent, NATIVE_TOKEN],
      }),
      publicClient.readContract({
        address: SEP.AgentRegistry,
        abi: AgentRegistryAbi,
        functionName: 'getAgentOwner',
        args: [agent],
      }),
    ]);

    const guardConfig =
      config.status === 'fulfilled'
        ? (config.value as { erc8004TokenId: bigint; rulesContract: Address; guardContract: Address; registeredAt: bigint; active: boolean })
        : null;

    let rulesConfig: SafetyRulesConfig | null = null;
    if (guardConfig?.rulesContract) {
      const rulesAddr = guardConfig.rulesContract;
      const [drawdown, txph, oracle, volume, min, max, count] = await Promise.allSettled([
        publicClient.readContract({ address: rulesAddr, abi: SafetyRulesAbi, functionName: 'maxDrawdownBps' }),
        publicClient.readContract({ address: rulesAddr, abi: SafetyRulesAbi, functionName: 'maxTxPerHour' }),
        publicClient.readContract({ address: rulesAddr, abi: SafetyRulesAbi, functionName: 'oracleDeviationBps' }),
        publicClient.readContract({ address: rulesAddr, abi: SafetyRulesAbi, functionName: 'dailyVolumeCapUsd' }),
        publicClient.readContract({ address: rulesAddr, abi: SafetyRulesAbi, functionName: 'timeOfDayMin' }),
        publicClient.readContract({ address: rulesAddr, abi: SafetyRulesAbi, functionName: 'timeOfDayMax' }),
        publicClient.readContract({ address: rulesAddr, abi: SafetyRulesAbi, functionName: 'allowedProtocolCount' }),
      ]);
      rulesConfig = {
        maxDrawdownBps: drawdown.status === 'fulfilled' ? (drawdown.value as bigint) : BigInt(0),
        maxTxPerHour: txph.status === 'fulfilled' ? (txph.value as bigint) : BigInt(0),
        oracleDeviationBps: oracle.status === 'fulfilled' ? (oracle.value as bigint) : BigInt(0),
        dailyVolumeCapUsd: volume.status === 'fulfilled' ? (volume.value as bigint) : BigInt(0),
        timeOfDayMin: min.status === 'fulfilled' ? Number(min.value) : 0,
        timeOfDayMax: max.status === 'fulfilled' ? Number(max.value) : 24,
        allowedProtocolCount: count.status === 'fulfilled' ? (count.value as bigint) : BigInt(0),
      };
    }

    let historyItems: RepHistory[] = [];
    const rep =
      repResult.status === 'fulfilled'
        ? (repResult.value as [bigint, bigint, bigint])
        : null;
    if (rep) {
      const hist = await publicClient.readContract({
        address: SEP.ReputationOracle,
        abi: ReputationOracleAbi,
        functionName: 'getAgentHistory',
        args: [agent, BigInt(0), BigInt(20)],
      }).catch(() => []);
      historyItems = (hist as { eventType: number; timestamp: bigint; delta: number; scoreAfter: number }[]).map(
        (h) => ({
          eventType: h.eventType,
          timestamp: h.timestamp,
          delta: h.delta,
          scoreAfter: h.scoreAfter,
        }),
      );
    }

    const registeredAt = guardConfig?.registeredAt ?? BigInt(0);
    const nowSec = Math.floor(Date.now() / 1000);
    const daysGuarded =
      registeredAt > 0
        ? Math.floor((nowSec - Number(registeredAt)) / 86400)
        : 0;

    return {
      agent,
      isGuarded: true,
      isPaused: isPaused.status === 'fulfilled' ? (isPaused.value as boolean) : false,
      config: guardConfig
        ? {
            erc8004TokenId: guardConfig.erc8004TokenId,
            rulesContract: guardConfig.rulesContract,
            guardContract: guardConfig.guardContract,
            registeredAt: guardConfig.registeredAt,
            active: guardConfig.active,
          }
        : null,
      rules: rulesConfig,
      reputation: rep
        ? {
            score: rep[0],
            lastUpdated: rep[1],
            eventCount: rep[2],
            history: historyItems,
          }
        : null,
      nativeMntBalance:
        mntBalance.status === 'fulfilled' ? (mntBalance.value as bigint) : BigInt(0),
      daysGuarded,
      owner: owner.status === 'fulfilled' ? (owner.value as Address) : null,
    };
  } catch {
    return EMPTY;
  }
};

export const getAgentDetail = unstable_cache(
  fetchAgentDetail,
  ['agent-detail'],
  { revalidate: 30 },
);

// ---- Leaderboard -----------------------------------------------------------

const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    // Get all AgentGuarded events to find all registered agents
    const logs = await publicClient.getLogs({
      address: SEP.AgentRegistry,
      event: {
        type: 'event',
        name: 'AgentGuarded',
        inputs: [
          { name: 'agent', type: 'address', indexed: true },
          { name: 'tokenId', type: 'uint256', indexed: true },
          { name: 'rulesContract', type: 'address', indexed: false },
          { name: 'guardContract', type: 'address', indexed: false },
        ],
      },
      fromBlock: BigInt(0),
      toBlock: 'latest',
    });

    // Deduplicate (re-registrations possible)
    const agents = [...new Set(logs.map((l) => getAddress(l.args.agent as string)))];
    if (agents.length === 0) return [];

    const results = await Promise.allSettled(
      agents.slice(0, 100).map(async (agent) => {
        const [isGuardedRes, repRes, pausedRes, configRes] = await Promise.allSettled([
          publicClient.readContract({
            address: SEP.AgentRegistry,
            abi: AgentRegistryAbi,
            functionName: 'isGuarded',
            args: [agent],
          }),
          publicClient.readContract({
            address: SEP.ReputationOracle,
            abi: ReputationOracleAbi,
            functionName: 'getReputation',
            args: [agent],
          }),
          publicClient.readContract({
            address: SEP.SentinelGuard,
            abi: SentinelGuardAbi,
            functionName: 'isPaused',
            args: [agent],
          }),
          publicClient.readContract({
            address: SEP.AgentRegistry,
            abi: AgentRegistryAbi,
            functionName: 'getGuardConfig',
            args: [agent],
          }),
        ]);

        const isGuarded =
          isGuardedRes.status === 'fulfilled' ? (isGuardedRes.value as boolean) : false;
        if (!isGuarded) return null;

        const rep =
          repRes.status === 'fulfilled'
            ? (repRes.value as [bigint, bigint, bigint])
            : ([BigInt(500), BigInt(0), BigInt(0)] as const);

        const config =
          configRes.status === 'fulfilled'
            ? (configRes.value as { registeredAt: bigint })
            : null;

        const registeredAt = config?.registeredAt ?? BigInt(0);
        const nowSec = Math.floor(Date.now() / 1000);
        const daysGuarded =
          registeredAt > 0
            ? Math.floor((nowSec - Number(registeredAt)) / 86400)
            : 0;

        return {
          agent,
          score: rep[0],
          eventCount: rep[2],
          daysGuarded,
          isPaused:
            pausedRes.status === 'fulfilled' ? (pausedRes.value as boolean) : false,
          registeredAt,
        } satisfies Omit<LeaderboardEntry, 'rank'>;
      }),
    );

    const entries = results
      .filter(
        (r): r is PromiseFulfilledResult<Omit<LeaderboardEntry, 'rank'> | null> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value as Omit<LeaderboardEntry, 'rank'>)
      .sort((a, b) => Number(b.score - a.score))
      .slice(0, 100)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    return entries;
  } catch {
    return [];
  }
};

export const getLeaderboard = unstable_cache(fetchLeaderboard, ['leaderboard'], {
  revalidate: 60,
});
