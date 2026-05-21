// Shared types for the Sentinel monitor. viem types only — never bare `string`
// for on-chain values (CLAUDE.md).

import type { Address, Hex } from "viem";

/** An agent the monitor is actively watching, persisted to the SQLite watch list. */
export interface WatchedAgent {
  agent: Address;
  tokenId: bigint;
  rules: Address;
  guard: Address;
  active: boolean;
  registeredAtBlock: bigint;
  updatedAt: number;
}

/** Listener event names exposed on the EventListener EventEmitter. */
export type ListenerEventName =
  | "agentRegistered"
  | "agentDeregistered"
  | "agentTx"
  | "priceUpdate"
  | "connected"
  | "error";

/** A decoded contract-event log handed to subscription handlers. */
export interface EventLog {
  args: Record<string, unknown>;
  blockNumber: bigint | null;
  transactionHash: Hex | null;
  address: Address;
}

/** Payload for the 'agentRegistered' event (AgentRegistry.AgentGuarded). */
export interface AgentRegisteredPayload {
  agent: Address;
  tokenId: bigint;
  rules: Address;
  guard: Address;
  blockNumber: bigint | null;
  txHash: Hex | null;
}

/** Payload for the 'agentDeregistered' event (AgentRegistry.AgentDeregistered). */
export interface AgentDeregisteredPayload {
  agent: Address;
  tokenId: bigint;
  blockNumber: bigint | null;
  txHash: Hex | null;
}

/** Payload for the 'agentTx' event (SentinelGuard.AgentExecuted). */
export interface AgentTxPayload {
  agent: Address;
  target: Address;
  value: bigint;
  selector: Hex;
  blockNumber: bigint | null;
  txHash: Hex | null;
}

/** Payload for the 'priceUpdate' event (DEX Swap → implied price). */
export interface PriceUpdatePayload {
  source: string;
  pool: Address;
  blockNumber: bigint | null;
  txHash: Hex | null;
}

/** Payload for the 'error' event. */
export interface ListenerErrorPayload {
  error: Error;
  rpcUrl: string;
  usingFallback: boolean;
}

/** Payload for the 'connected' event. */
export interface ConnectedPayload {
  rpcUrl: string;
  usingFallback: boolean;
}

// ============ Anomaly detection (Phase 3.3) ============

/**
 * Reconstructed runtime state for one agent. The off-chain monitor fills the
 * value/volume fields the on-chain rule check can't see (they are 0 at exec time).
 * All USD amounts are 18-decimal fixed point, matching SafetyRules.
 */
export interface AgentState {
  agent: Address;
  currentValueUsd: bigint;
  highWaterMarkUsd: bigint;
  txCountThisHour: number;
  volume24hUsd: bigint;
}

/** A snapshot of an agent's on-chain SafetyRules, cached by RulesCache. */
export interface SafetyRulesSnapshot {
  maxDrawdownBps: bigint;
  maxTxPerHour: bigint;
  oracleDeviationBps: bigint;
  dailyVolumeCapUsd: bigint;
  timeOfDayMin: number;
  timeOfDayMax: number;
  allowedProtocols: ReadonlySet<Address>;
}

/** Anomaly identifiers — string equals the SafetyRules RULE_* constant name. */
export type AnomalyType =
  | "MAX_DRAWDOWN"
  | "MAX_TX_PER_HOUR"
  | "ALLOWED_PROTOCOLS"
  | "ORACLE_DEVIATION"
  | "DAILY_VOLUME"
  | "TIME_WINDOW";

export type Severity = "warn" | "critical";

/** Result of one detector. Only `critical` trips the on-chain circuit breaker. */
export interface AnomalyResult {
  anomaly: boolean;
  type: AnomalyType;
  /** keccak256(utf8(type)) — equals the on-chain bytes32 rule key. */
  reasonHash: Hex;
  severity: Severity;
  message: string;
}

/** Per-evaluation context that isn't part of the persisted AgentState. */
export interface AnomalyContext {
  /** Protocol the agent just called (for allowlist check). */
  txTarget?: Address;
  /** Price the agent traded at, 18dp (for oracle deviation). */
  agentPrice?: bigint;
  /** Pyth reference price, 18dp (for oracle deviation). */
  pythPrice?: bigint;
  /** Unix timestamp in seconds (for off-hours check). */
  timestamp?: number;
}

/** A normalized Pyth price. */
export interface PythPrice {
  feedId: Hex;
  /** Price in USD, 18-decimal fixed point. */
  priceUsd: bigint;
  /** Pyth publish time (unix seconds). */
  publishTime: number;
}
