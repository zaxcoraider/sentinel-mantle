// Server-side data fetching for the landing page.
// All functions run in RSC / Route Handlers only — not in client components.
import { unstable_cache } from 'next/cache';
import { formatUnits, parseAbiItem } from 'viem';
import type { Address, Hex } from 'viem';
import { publicClient } from './chain';
import { NETWORK, DEPLOY_BLOCK } from './network';
import { collectLogs } from './logs';

export interface WallEvent {
  type: 'GUARDED' | 'EXEC' | 'CIRCUIT_BREAKER' | 'RESCUED' | 'PAUSED';
  agent: Address;
  txHash: Hex | null;
  blockNumber: bigint;
  label: string;
  meta?: string;
}

const REGISTRY = NETWORK.AgentRegistry;
const GUARD = NETWORK.SentinelGuard;

// ── Event ABIs (used only for getLogs, so parseAbiItem is cleaner than importing the full ABI) ──
const EVT_AGENT_GUARDED = parseAbiItem(
  'event AgentGuarded(address indexed agent, uint256 indexed tokenId, address rulesContract, address guardContract)',
);
const EVT_AGENT_DEREGISTERED = parseAbiItem(
  'event AgentDeregistered(address indexed agent, uint256 indexed tokenId)',
);
const EVT_CIRCUIT_BREAKER = parseAbiItem(
  'event CircuitBreakerTriggered(address indexed agent, bytes32 indexed reason, uint256 timestamp)',
);
const EVT_AGENT_EXECUTED = parseAbiItem(
  'event AgentExecuted(address indexed agent, address indexed target, uint256 value, bytes4 selector)',
);
const EVT_FUNDS_RESCUED = parseAbiItem(
  'event FundsRescued(address indexed agent, address indexed beneficiary, uint256 tokenCount)',
);
const EVT_AGENT_PAUSED = parseAbiItem(
  'event AgentPausedByOwner(address indexed agent, uint256 timestamp)',
);

const EMPTY = { agentCount: 0, breakerCount: 0, tvlMnt: 0, recentEvents: [] as WallEvent[] };

async function fetchLandingStats() {
  try {
  const [
    guardedResult,
    deregResult,
    breakerResult,
    nativeBalResult,
    recentExecResult,
    recentGuardedResult,
    recentBreakerResult,
    recentRescuedResult,
    recentPausedResult,
  ] = await Promise.allSettled([
    collectLogs(publicClient, DEPLOY_BLOCK, (f, t) => publicClient.getLogs({ address: REGISTRY, event: EVT_AGENT_GUARDED, fromBlock: f, toBlock: t })),
    collectLogs(publicClient, DEPLOY_BLOCK, (f, t) => publicClient.getLogs({ address: REGISTRY, event: EVT_AGENT_DEREGISTERED, fromBlock: f, toBlock: t })),
    collectLogs(publicClient, DEPLOY_BLOCK, (f, t) => publicClient.getLogs({ address: GUARD, event: EVT_CIRCUIT_BREAKER, fromBlock: f, toBlock: t })),
    publicClient.getBalance({ address: GUARD }),
    collectLogs(publicClient, DEPLOY_BLOCK, (f, t) => publicClient.getLogs({ address: GUARD, event: EVT_AGENT_EXECUTED, fromBlock: f, toBlock: t })),
    collectLogs(publicClient, DEPLOY_BLOCK, (f, t) => publicClient.getLogs({ address: REGISTRY, event: EVT_AGENT_GUARDED, fromBlock: f, toBlock: t })),
    collectLogs(publicClient, DEPLOY_BLOCK, (f, t) => publicClient.getLogs({ address: GUARD, event: EVT_CIRCUIT_BREAKER, fromBlock: f, toBlock: t })),
    collectLogs(publicClient, DEPLOY_BLOCK, (f, t) => publicClient.getLogs({ address: GUARD, event: EVT_FUNDS_RESCUED, fromBlock: f, toBlock: t })),
    collectLogs(publicClient, DEPLOY_BLOCK, (f, t) => publicClient.getLogs({ address: GUARD, event: EVT_AGENT_PAUSED, fromBlock: f, toBlock: t })),
  ]);

  const guarded = guardedResult.status === 'fulfilled' ? guardedResult.value : [];
  const dereg = deregResult.status === 'fulfilled' ? deregResult.value : [];
  const breakers = breakerResult.status === 'fulfilled' ? breakerResult.value : [];
  const nativeBal = nativeBalResult.status === 'fulfilled' ? nativeBalResult.value : BigInt(0);

  const agentCount = Math.max(0, guarded.length - dereg.length);
  const breakerCount = breakers.length;
  const tvlMnt = Number(formatUnits(nativeBal, 18));

  // Build recent events array from all log types, newest-first
  type AnyLog = { blockNumber: bigint | null; transactionHash: Hex | null; args: Record<string, unknown> };

  const execLogs: AnyLog[] = recentExecResult.status === 'fulfilled' ? recentExecResult.value : [];
  const guardedLogs: AnyLog[] = recentGuardedResult.status === 'fulfilled' ? recentGuardedResult.value : [];
  const breakerLogs: AnyLog[] = recentBreakerResult.status === 'fulfilled' ? recentBreakerResult.value : [];
  const rescuedLogs: AnyLog[] = recentRescuedResult.status === 'fulfilled' ? recentRescuedResult.value : [];
  const pausedLogs: AnyLog[] = recentPausedResult.status === 'fulfilled' ? recentPausedResult.value : [];

  const toWallEvent = (log: AnyLog, type: WallEvent['type'], label: string, meta?: string): WallEvent => ({
    type,
    agent: (log.args.agent as Address) ?? '0x',
    txHash: log.transactionHash,
    blockNumber: log.blockNumber ?? BigInt(0),
    label,
    meta,
  });

  const allEvents: WallEvent[] = [
    ...guardedLogs.map((l) => toWallEvent(l, 'GUARDED', 'guarded', 'rules set')),
    ...execLogs.map((l) => toWallEvent(l, 'EXEC', 'executed', l.args.target ? `→ ${String(l.args.target).slice(0, 10)}…` : undefined)),
    ...breakerLogs.map((l) => toWallEvent(l, 'CIRCUIT_BREAKER', 'CIRCUIT BREAKER')),
    ...rescuedLogs.map((l) => toWallEvent(l, 'RESCUED', 'rescued → vault')),
    ...pausedLogs.map((l) => toWallEvent(l, 'PAUSED', 'paused by owner')),
  ].sort((a, b) => {
    const diff = b.blockNumber - a.blockNumber;
    return diff > BigInt(0) ? 1 : diff < BigInt(0) ? -1 : 0;
  });

    return {
      agentCount,
      breakerCount,
      tvlMnt,
      recentEvents: allEvents.slice(0, 3),
    };
  } catch {
    return EMPTY;
  }
}

export const getLandingData = unstable_cache(fetchLandingStats, ['landing-stats'], {
  revalidate: 30,
});
