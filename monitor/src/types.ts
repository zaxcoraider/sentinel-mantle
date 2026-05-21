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
