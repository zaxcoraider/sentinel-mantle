// EventListener — resilient viem event subscription supervisor.
//
// Wraps a swappable "client" (the production one wraps a viem PublicClient; tests
// inject a fake) so the reconnect/backoff/failover logic is unit-testable without
// a chain. On a subscription error it reconnects with exponential backoff, and
// after a run of failures on the primary RPC it fails over to the fallback URL.
//
// Emits domain events for consumers: 'agentRegistered', 'agentDeregistered',
// 'agentTx', 'priceUpdate', plus 'connected' and 'error'.

import { EventEmitter } from "node:events";
import type { Abi, Address } from "viem";
import type { EventLog } from "./types.js";
import { silentLogger, type Logger } from "./log.js";

export type { EventLog } from "./types.js";

export type EventHandler = (logs: readonly EventLog[]) => void;

export interface WatchSubscription {
  address: Address;
  abi: Abi;
  eventName: string;
  onLogs: EventHandler;
  onError: (error: Error) => void;
}

/** The minimal client surface the listener needs — see chain.viemClientFactory. */
export interface WatchableClient {
  /** Start watching an event; returns an unwatch function. */
  watchContractEvent(sub: WatchSubscription): () => void;
}

export type ClientFactory = (url: string) => WatchableClient;

export interface BackoffConfig {
  baseMs: number;
  maxMs: number;
  jitter: boolean;
  /** Consecutive failed reconnects on the primary before switching to fallback. */
  fallbackAfter: number;
  /** How long a connection must stay up before the attempt counter resets. */
  stableAfterMs: number;
}

export const DEFAULT_BACKOFF: BackoffConfig = {
  baseMs: 1_000,
  maxMs: 30_000,
  jitter: true,
  fallbackAfter: 3,
  stableAfterMs: 60_000,
};

export interface EventListenerOptions {
  factory: ClientFactory;
  backoff?: Partial<BackoffConfig>;
  logger?: Logger;
}

interface Registration {
  address: Address;
  abi: Abi;
  eventName: string;
  handler: EventHandler;
  unwatch?: () => void;
}

/** Exponential backoff with optional full jitter. */
export const computeBackoff = (attempt: number, cfg: BackoffConfig): number => {
  const exp = Math.min(cfg.baseMs * 2 ** attempt, cfg.maxMs);
  if (!cfg.jitter) return exp;
  return Math.floor(cfg.baseMs + Math.random() * (exp - cfg.baseMs));
};

export class EventListener extends EventEmitter {
  private readonly primaryUrl: string;
  private readonly fallbackUrl: string;
  private readonly factory: ClientFactory;
  private readonly backoff: BackoffConfig;
  private readonly logger: Logger;

  private client: WatchableClient | null = null;
  private registrations: Registration[] = [];
  private usingFallback = false;
  private attempts = 0;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(primaryUrl: string, fallbackUrl: string, opts: EventListenerOptions) {
    super();
    this.primaryUrl = primaryUrl;
    this.fallbackUrl = fallbackUrl;
    this.factory = opts.factory;
    this.backoff = { ...DEFAULT_BACKOFF, ...opts.backoff };
    this.logger = opts.logger ?? silentLogger;
  }

  get currentUrl(): string {
    return this.usingFallback ? this.fallbackUrl : this.primaryUrl;
  }

  get onFallback(): boolean {
    return this.usingFallback;
  }

  /** Register an event subscription. Attaches immediately if already started. */
  subscribe(address: Address, abi: Abi, eventName: string, handler: EventHandler): void {
    const reg: Registration = { address, abi, eventName, handler };
    this.registrations.push(reg);
    if (this.client && !this.stopped) this.attach(reg);
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearReconnectTimer();
    this.clearStableTimer();
    this.detachAll();
    this.client = null;
  }

  private connect(): void {
    if (this.stopped) return;
    try {
      this.client = this.factory(this.currentUrl);
    } catch (err) {
      this.handleError(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    for (const reg of this.registrations) this.attach(reg);
    this.logger.info("listener connected", {
      url: this.currentUrl,
      usingFallback: this.usingFallback,
    });
    this.safeEmit("connected", {
      rpcUrl: this.currentUrl,
      usingFallback: this.usingFallback,
    });
    // Reset the attempt counter once a connection survives the grace window.
    this.clearStableTimer();
    this.stableTimer = setTimeout(() => {
      this.attempts = 0;
    }, this.backoff.stableAfterMs);
  }

  private attach(reg: Registration): void {
    if (!this.client) return;
    reg.unwatch = this.client.watchContractEvent({
      address: reg.address,
      abi: reg.abi,
      eventName: reg.eventName,
      onLogs: (logs) => {
        try {
          reg.handler(logs);
        } catch (err) {
          this.logger.error("subscription handler threw", {
            event: reg.eventName,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
      onError: (err) => this.handleError(err),
    });
  }

  private handleError(err: Error): void {
    if (this.stopped) return;
    this.logger.warn("listener error", {
      url: this.currentUrl,
      usingFallback: this.usingFallback,
      error: err.message,
    });
    this.safeEmit("error", {
      error: err,
      rpcUrl: this.currentUrl,
      usingFallback: this.usingFallback,
    });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.clearStableTimer();
    this.detachAll();

    const delay = computeBackoff(this.attempts, this.backoff);
    this.attempts += 1;

    if (!this.usingFallback && this.attempts >= this.backoff.fallbackAfter) {
      this.usingFallback = true;
      this.logger.warn("switching to fallback RPC", { fallback: this.fallbackUrl });
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private detachAll(): void {
    for (const reg of this.registrations) {
      reg.unwatch?.();
      reg.unwatch = undefined;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearStableTimer(): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
  }

  // Node throws on an unhandled 'error' event; guard so a missing listener can
  // never crash the monitor (the error is always logged regardless).
  private safeEmit(event: string, payload: unknown): void {
    if (event === "error" && this.listenerCount("error") === 0) return;
    this.emit(event, payload);
  }
}
