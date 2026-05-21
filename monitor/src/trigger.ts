// Trigger — the on-chain circuit-breaker executor.
//
// fire() is the only thing that ever touches the chain with the monitor's hot
// wallet. Per the threat model the wallet can ONLY pause (never move funds), so
// the blast radius of a compromised monitor is a DoS at worst.
//
// The actual chain write is behind a GuardWriter interface so the orchestration
// (idempotency, audit log, alerting) is unit-testable without a chain;
// createViemGuardWriter is the production implementation.

import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { sentinelGuardFunctions } from "./abis.js";
import { chainFor } from "./chain.js";
import { silentLogger, type Logger } from "./log.js";

export interface TxResult {
  txHash: Hex;
  blockNumber: bigint;
  gasUsed: bigint;
  /** L2 execution cost (gasUsed * effectiveGasPrice), in wei of MNT. */
  costWei: bigint;
}

export type FireOutcome =
  | { status: "fired"; result: TxResult }
  | { status: "skipped"; reason: "idempotent" | "already-paused" };

/** Minimal chain surface the Trigger needs — see createViemGuardWriter. */
export interface GuardWriter {
  isPaused(agent: Address): Promise<boolean>;
  trigger(agent: Address, reasonHash: Hex): Promise<TxResult>;
  monitorAddress(): Address;
}

export interface TriggerOptions {
  /** Don't re-fire for the same agent within this window (default 5 min). */
  idempotencyMs?: number;
  /** Path to the JSONL audit log. If unset, audit entries are only logged. */
  auditLogPath?: string;
  /** Discord/Slack-compatible webhook for alerts. */
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
  logger?: Logger;
  now?: () => number;
}

const jsonReplacer = (_k: string, v: unknown): unknown =>
  typeof v === "bigint" ? v.toString() : v;

export class Trigger {
  private readonly writer: GuardWriter;
  private readonly idempotencyMs: number;
  private readonly auditLogPath?: string;
  private readonly webhookUrl?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Logger;
  private readonly now: () => number;
  private readonly lastFired = new Map<string, number>();

  constructor(writer: GuardWriter, opts: TriggerOptions = {}) {
    this.writer = writer;
    this.idempotencyMs = opts.idempotencyMs ?? 5 * 60_000;
    this.auditLogPath = opts.auditLogPath;
    this.webhookUrl = opts.webhookUrl;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.logger = opts.logger ?? silentLogger;
    this.now = opts.now ?? Date.now;
  }

  async fire(agent: Address, reasonHash: Hex, reasonText: string): Promise<FireOutcome> {
    const key = getAddress(agent);
    const now = this.now();

    const last = this.lastFired.get(key);
    if (last !== undefined && now - last < this.idempotencyMs) {
      this.logger.info("skip trigger (idempotent)", { agent: key, sinceMs: now - last });
      return { status: "skipped", reason: "idempotent" };
    }

    if (await this.writer.isPaused(key)) {
      // Already frozen (e.g. owner panic button) — record so we stop rechecking.
      this.lastFired.set(key, now);
      this.logger.info("skip trigger (already paused)", { agent: key });
      return { status: "skipped", reason: "already-paused" };
    }

    const result = await this.writer.trigger(key, reasonHash);
    this.lastFired.set(key, now);

    this.appendAudit({
      ts: new Date(now).toISOString(),
      agent: key,
      reasonHash,
      reasonText,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      gasUsed: result.gasUsed,
      costWei: result.costWei,
      monitor: this.writer.monitorAddress(),
    });

    await this.alert(key, reasonText, result);

    this.logger.warn("circuit breaker fired", {
      agent: key,
      reason: reasonText,
      tx: result.txHash,
      block: result.blockNumber,
    });
    return { status: "fired", result };
  }

  private appendAudit(entry: Record<string, unknown>): void {
    if (!this.auditLogPath) return;
    try {
      mkdirSync(dirname(this.auditLogPath), { recursive: true });
      appendFileSync(this.auditLogPath, `${JSON.stringify(entry, jsonReplacer)}\n`);
    } catch (err) {
      this.logger.error("failed to write audit log", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async alert(agent: Address, reasonText: string, result: TxResult): Promise<void> {
    if (!this.webhookUrl) return;
    const text = `🛑 Sentinel circuit breaker fired for ${agent}: ${reasonText} (tx ${result.txHash})`;
    try {
      const res = await this.fetchImpl(this.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `content` works for Discord, `text` for Slack.
        body: JSON.stringify(
          { content: text, text, agent, reason: reasonText, txHash: result.txHash },
          jsonReplacer,
        ),
      });
      if (!res.ok) this.logger.warn("alert webhook non-OK", { status: res.status });
    } catch (err) {
      // Never let alerting failure mask a successful trigger.
      this.logger.warn("alert webhook failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export interface ViemGuardWriterParams {
  privateKey: Hex;
  rpcUrl: string;
  chainId: number;
  guardAddress: Address;
  /** Percent to bump the priority fee by for fast inclusion (default 20). */
  priorityBumpPercent?: number;
}

/** Production GuardWriter backed by a viem wallet + public client. */
export const createViemGuardWriter = (p: ViemGuardWriterParams): GuardWriter => {
  const account = privateKeyToAccount(p.privateKey);
  const chain = chainFor(p.chainId);
  const transport = http(p.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const bump = BigInt(p.priorityBumpPercent ?? 20);

  return {
    monitorAddress: () => account.address,

    isPaused: (agent) =>
      publicClient.readContract({
        address: p.guardAddress,
        abi: sentinelGuardFunctions,
        functionName: "isPaused",
        args: [agent],
      }),

    trigger: async (agent, reasonHash) => {
      const fees = await publicClient.estimateFeesPerGas();
      const basePriority = fees.maxPriorityFeePerGas ?? 0n;
      const maxPriorityFeePerGas = (basePriority * (100n + bump)) / 100n;
      const maxFeePerGas = (fees.maxFeePerGas ?? 0n) + (maxPriorityFeePerGas - basePriority);

      const gas = await publicClient.estimateContractGas({
        address: p.guardAddress,
        abi: sentinelGuardFunctions,
        functionName: "triggerCircuitBreaker",
        args: [agent, reasonHash],
        account,
      });

      const txHash = await walletClient.writeContract({
        address: p.guardAddress,
        abi: sentinelGuardFunctions,
        functionName: "triggerCircuitBreaker",
        args: [agent, reasonHash],
        account,
        chain,
        gas,
        maxFeePerGas,
        maxPriorityFeePerGas,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      const costWei = receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n);
      return { txHash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, costWei };
    },
  };
};
