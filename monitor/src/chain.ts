// viem clients for Mantle, plus the production ClientFactory used by EventListener.
//
// Transport is chosen from the URL scheme: ws(s):// uses a WebSocket transport,
// anything else uses HTTP. The two transports need different event-watching
// strategies:
//   - WebSocket: viem's native watchContractEvent (eth_subscribe) — push, no polling.
//   - HTTP:      eth_getLogs polling. Public Mantle RPCs are load-balanced and
//                drop eth_newFilter filters between polls ("filter not found"),
//                so filter-based watching is unusable; getLogs over a block range
//                is stateless and robust.
//
// RPC URLs are always passed in from config — never hardcoded (CLAUDE.md #5).

import {
  createPublicClient,
  http,
  webSocket,
  type Address,
  type PublicClient,
} from "viem";
import { mantle, mantleSepoliaTestnet } from "viem/chains";
import type { ClientFactory, EventLog, WatchableClient, WatchSubscription } from "./listener.js";
import { silentLogger, type Logger } from "./log.js";

const chainFor = (chainId: number) =>
  chainId === mantle.id ? mantle : mantleSepoliaTestnet;

const isWs = (url: string): boolean => url.startsWith("ws");

export const makePublicClient = (url: string, chainId: number): PublicClient =>
  createPublicClient({
    chain: chainFor(chainId),
    transport: isWs(url) ? webSocket(url) : http(url),
  });

const toRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};

// viem decodes log args, but with a generic `abi: Abi` it can't infer the shape,
// so `args` is read structurally and normalized.
const toEventLog = (l: {
  args?: unknown;
  blockNumber: bigint | null;
  transactionHash: `0x${string}` | null;
  address: Address;
}): EventLog => ({
  args: toRecord(l.args),
  blockNumber: l.blockNumber,
  transactionHash: l.transactionHash,
  address: l.address,
});

// Native eth_subscribe watcher for WebSocket transports.
const watchViaSubscription = (
  client: PublicClient,
  { address, abi, eventName, onLogs, onError }: WatchSubscription,
): (() => void) =>
  client.watchContractEvent({
    address,
    abi,
    eventName,
    onError,
    onLogs: (logs) => onLogs(logs.map(toEventLog)),
  });

// eth_getLogs poller for HTTP transports.
//
// Public Mantle RPCs are load-balanced over nodes at *different* heights, so a
// `getBlockNumber` (ahead node) followed by `getLogs` (behind node) races into
// "invalid block range" / "filter not found". Two defenses:
//   1. Confirmation lag — never query within `confirmations` of the head, so the
//      requested range exists on the widest set of nodes.
//   2. Soft retries — a failed poll doesn't advance `fromBlock` and isn't fatal;
//      the next tick re-routes through the LB and usually lands on a good node.
//      Only after `maxConsecutiveErrors` in a row do we escalate to onError,
//      letting EventListener reconnect / fail over.
// `fromBlock` advances only after a *successful* read of that exact range, so no
// logs are skipped when individual polls fail.
const watchViaGetLogs = (
  client: PublicClient,
  cfg: { pollMs: number; confirmations: bigint; maxConsecutiveErrors: number; logger: Logger },
  { address, abi, eventName, onLogs, onError }: WatchSubscription,
): (() => void) => {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fromBlock: bigint | undefined;
  let consecutiveErrors = 0;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const head = await client.getBlockNumber();
      const latest = head > cfg.confirmations ? head - cfg.confirmations : 0n;
      if (fromBlock === undefined) fromBlock = latest; // start at the (lagged) tip
      if (latest >= fromBlock) {
        const logs = await client.getContractEvents({
          address,
          abi,
          eventName,
          fromBlock,
          toBlock: latest,
        });
        if (logs.length > 0) onLogs(logs.map(toEventLog));
        fromBlock = latest + 1n;
      }
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors += 1;
      const error = err instanceof Error ? err : new Error(String(err));
      if (consecutiveErrors >= cfg.maxConsecutiveErrors) {
        onError(error); // sustained failure — EventListener reconnects / fails over
        return;
      }
      cfg.logger.debug("transient poll error, will retry", {
        event: eventName,
        attempt: consecutiveErrors,
        error: error.message.split("\n")[0],
      });
    }
    if (!stopped) {
      timer = setTimeout(() => void tick(), cfg.pollMs);
    }
  };

  timer = setTimeout(() => void tick(), 0);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
};

export interface ViemFactoryOptions {
  /** HTTP poll interval in ms (ignored for WebSocket transports). */
  pollMs?: number;
  /** Blocks to stay behind the head, to dodge load-balancer height skew. */
  confirmations?: number;
  /** Consecutive poll failures before escalating to a reconnect. */
  maxConsecutiveErrors?: number;
  logger?: Logger;
}

/**
 * Production ClientFactory: wraps a real viem PublicClient so EventListener stays
 * decoupled from viem (and unit-testable with a fake factory).
 */
export const viemClientFactory =
  (chainId: number, opts: ViemFactoryOptions = {}): ClientFactory =>
  (url: string): WatchableClient => {
    const client = makePublicClient(url, chainId);
    const cfg = {
      pollMs: opts.pollMs ?? 4_000,
      confirmations: BigInt(opts.confirmations ?? 5),
      maxConsecutiveErrors: opts.maxConsecutiveErrors ?? 5,
      logger: opts.logger ?? silentLogger,
    };
    return {
      watchContractEvent: (sub) =>
        isWs(url) ? watchViaSubscription(client, sub) : watchViaGetLogs(client, cfg, sub),
    };
  };
