// Server-side data fetching for the landing page.
// All functions run in RSC / Route Handlers only — not in client components.
import { unstable_cache } from 'next/cache';
import { formatUnits, parseAbiItem } from 'viem';
import type { Address, Hex } from 'viem';
import { publicClient } from './chain';
import { DEPLOYMENTS } from './contracts';

export interface WallEvent {
  type: 'GUARDED' | 'EXEC' | 'CIRCUIT_BREAKER' | 'RESCUED' | 'PAUSED';
  agent: Address;
  txHash: Hex | null;
  blockNumber: bigint;
  label: string;
  meta?: string;
}

const REGISTRY = DEPLOYMENTS.sepolia.AgentRegistry;
const GUARD = DEPLOYMENTS.sepolia.SentinelGuard;

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

async function fetchMntPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=mantle&vs_currencies=usd',
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) },
    );
    const data = (await res.json()) as { mantle?: { usd?: number } };
    return data?.mantle?.usd ?? 0.5;
  } catch {
    return 0.5; // fallback price
  }
}

const EMPTY = { agentCount: 0, breakerCount: 0, tvlUsd: 0, recentEvents: [] as WallEvent[] };

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
    mntPriceResult,
  ] = await Promise.allSettled([
    publicClient.getLogs({ address: REGISTRY, event: EVT_AGENT_GUARDED, fromBlock: BigInt(0) }),
    publicClient.getLogs({ address: REGISTRY, event: EVT_AGENT_DEREGISTERED, fromBlock: BigInt(0) }),
    publicClient.getLogs({ address: GUARD, event: EVT_CIRCUIT_BREAKER, fromBlock: BigInt(0) }),
    publicClient.getBalance({ address: GUARD }),
    publicClient.getLogs({ address: GUARD, event: EVT_AGENT_EXECUTED, fromBlock: BigInt(0) }),
    publicClient.getLogs({ address: REGISTRY, event: EVT_AGENT_GUARDED, fromBlock: BigInt(0) }),
    publicClient.getLogs({ address: GUARD, event: EVT_CIRCUIT_BREAKER, fromBlock: BigInt(0) }),
    publicClient.getLogs({ address: GUARD, event: EVT_FUNDS_RESCUED, fromBlock: BigInt(0) }),
    publicClient.getLogs({ address: GUARD, event: EVT_AGENT_PAUSED, fromBlock: BigInt(0) }),
    fetchMntPrice(),
  ]);

  const guarded = guardedResult.status === 'fulfilled' ? guardedResult.value : [];
  const dereg = deregResult.status === 'fulfilled' ? deregResult.value : [];
  const breakers = breakerResult.status === 'fulfilled' ? breakerResult.value : [];
  const nativeBal = nativeBalResult.status === 'fulfilled' ? nativeBalResult.value : BigInt(0);
  const mntPrice = mntPriceResult.status === 'fulfilled' ? mntPriceResult.value : 0.5;

  const agentCount = Math.max(0, guarded.length - dereg.length);
  const breakerCount = breakers.length;
  const tvlUsd = Math.round(Number(formatUnits(nativeBal, 18)) * mntPrice);

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
      tvlUsd,
      recentEvents: allEvents.slice(0, 3),
    };
  } catch {
    return EMPTY;
  }
}

export const getLandingData = unstable_cache(fetchLandingStats, ['landing-stats'], {
  revalidate: 30,
});
