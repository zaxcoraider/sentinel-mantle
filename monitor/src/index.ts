// Sentinel Monitor — entry point (Phase 3.4: full pipeline).
//
// Flow: EventListener decodes chain events -> StateStore updates per-agent state
// -> on each agent action, AnomalyEngine evaluates against cached SafetyRules ->
// a `critical` result fires the on-chain circuit breaker via Trigger.
//
// Live end-to-end today: tx-rate, protocol-allowlist, and off-hours detection
// (they need only event data + on-chain rules). Drawdown / oracle / volume need
// a portfolio valuation feed (balances x Pyth) — StateStore exposes the hooks
// (recordValuation / recordVolume); wiring that data source is the next step.

import type { Address } from "viem";
import { agentRegistryEvents, dexV2SwapEvent, sentinelGuardEvents } from "./abis.js";
import { makePublicClient, viemClientFactory } from "./chain.js";
import { loadConfig } from "./config.js";
import { openDb, type Database } from "./db.js";
import { createHealthServer, type HealthServer } from "./health.js";
import { EventListener } from "./listener.js";
import { createLogger, type LogLevel } from "./log.js";
import { AnomalyEngine } from "./anomaly.js";
import { createViemRulesReader, RulesCache } from "./rules-cache.js";
import { StateStore } from "./state.js";
import { createViemGuardWriter, Trigger } from "./trigger.js";
import type {
  AgentDeregisteredPayload,
  AgentRegisteredPayload,
  AgentTxPayload,
  ListenerErrorPayload,
  PriceUpdatePayload,
} from "./types.js";
import { Watchlist } from "./watchlist.js";

const STATE_PERSIST_MS = 60_000;

const main = (): void => {
  const network = process.env.MONITOR_NETWORK ?? "sepolia";
  const logLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";
  const config = loadConfig(network);
  const logger = createLogger(logLevel, "monitor");
  const startedAt = Date.now();
  let lastBlock = 0n;

  logger.info("starting Sentinel monitor", {
    network: config.network,
    chainId: config.chainId,
    rpc: config.rpcUrl,
    guard: config.addresses.sentinelGuard,
    registry: config.addresses.agentRegistry,
  });

  const db: Database = openDb(config.dbPath);
  const watchlist = new Watchlist(db);
  const stateStore = new StateStore();
  stateStore.loadAll(db);
  logger.info("loaded state from disk", { activeAgents: watchlist.activeAgents().length });

  const rulesCache = new RulesCache(
    createViemRulesReader(makePublicClient(config.rpcUrl, config.chainId)),
  );
  const engine = new AnomalyEngine();

  // Trigger is only built when a hot-wallet key is configured; otherwise the
  // monitor runs in detect-only mode (logs criticals, never sends a tx).
  const trigger = config.monitorPrivateKey
    ? new Trigger(
        createViemGuardWriter({
          privateKey: config.monitorPrivateKey,
          rpcUrl: config.rpcUrl,
          chainId: config.chainId,
          guardAddress: config.addresses.sentinelGuard,
        }),
        {
          auditLogPath: config.dbPath.replace(/agents\.db$/, "triggers.log.jsonl"),
          webhookUrl: config.alertWebhookUrl,
          logger,
        },
      )
    : undefined;
  if (!trigger) logger.warn("no MONITOR_PRIVATE_KEY — running in detect-only mode");

  const listener = new EventListener(config.rpcUrl, config.fallbackRpcUrl, {
    factory: viemClientFactory(config.chainId, { logger }),
    logger,
  });

  const noteBlock = (block: bigint | null): void => {
    if (block !== null && block > lastBlock) lastBlock = block;
  };

  // ---- Core anomaly evaluation on each agent action ------------------------

  const handleAgentTx = async (p: AgentTxPayload): Promise<void> => {
    noteBlock(p.blockNumber);
    const watched = watchlist.get(p.agent);
    if (!watched || !watched.active) return; // not a guarded agent

    const tsSec = Math.floor(Date.now() / 1000);
    stateStore.recordTx(p.agent, tsSec);

    let rules;
    try {
      rules = await rulesCache.get(watched.rules);
    } catch (err) {
      logger.warn("failed to read SafetyRules", {
        agent: p.agent,
        rules: watched.rules,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const state = stateStore.get(p.agent);
    const results = engine.evaluateAll(p.agent, state, rules, {
      txTarget: p.target,
      timestamp: tsSec,
    });

    for (const r of results) {
      if (r.severity === "warn") {
        logger.warn("anomaly (warn)", { agent: p.agent, type: r.type, message: r.message });
      }
    }

    const critical = results.find((r) => r.severity === "critical");
    if (!critical) return;

    logger.error("CRITICAL anomaly", {
      agent: p.agent,
      type: critical.type,
      message: critical.message,
    });
    if (!trigger) return; // detect-only mode

    try {
      const outcome = await trigger.fire(p.agent, critical.reasonHash, critical.message);
      logger.info("trigger outcome", { agent: p.agent, status: outcome.status });
    } catch (err) {
      logger.error("trigger failed", {
        agent: p.agent,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // ---- Domain event consumers ---------------------------------------------

  listener.on("error", (p: ListenerErrorPayload) =>
    logger.error("listener error", { error: p.error.message, usingFallback: p.usingFallback }),
  );

  listener.on("agentRegistered", (p: AgentRegisteredPayload) => {
    noteBlock(p.blockNumber);
    watchlist.upsert({
      agent: p.agent,
      tokenId: p.tokenId,
      rules: p.rules,
      guard: p.guard,
      active: true,
      registeredAtBlock: p.blockNumber ?? 0n,
      updatedAt: Date.now(),
    });
    logger.info("agent registered", { agent: p.agent, tokenId: p.tokenId, rules: p.rules });
  });

  listener.on("agentDeregistered", (p: AgentDeregisteredPayload) => {
    noteBlock(p.blockNumber);
    watchlist.deactivate(p.agent);
    logger.info("agent deregistered", { agent: p.agent, tokenId: p.tokenId });
  });

  listener.on("agentTx", (p: AgentTxPayload) => {
    void handleAgentTx(p);
  });

  listener.on("priceUpdate", (p: PriceUpdatePayload) => {
    noteBlock(p.blockNumber);
    logger.debug("dex swap", { source: p.source, pool: p.pool });
  });

  // ---- Subscriptions -------------------------------------------------------

  listener.subscribe(
    config.addresses.agentRegistry,
    agentRegistryEvents,
    "AgentGuarded",
    (logs) => {
      for (const log of logs) {
        const a = log.args;
        listener.emit("agentRegistered", {
          agent: a.agent as Address,
          tokenId: a.tokenId as bigint,
          rules: a.rulesContract as Address,
          guard: a.guardContract as Address,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        } satisfies AgentRegisteredPayload);
      }
    },
  );

  listener.subscribe(
    config.addresses.agentRegistry,
    agentRegistryEvents,
    "AgentDeregistered",
    (logs) => {
      for (const log of logs) {
        const a = log.args;
        listener.emit("agentDeregistered", {
          agent: a.agent as Address,
          tokenId: a.tokenId as bigint,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        } satisfies AgentDeregisteredPayload);
      }
    },
  );

  listener.subscribe(
    config.addresses.sentinelGuard,
    sentinelGuardEvents,
    "AgentExecuted",
    (logs) => {
      for (const log of logs) {
        const a = log.args;
        listener.emit("agentTx", {
          agent: a.agent as Address,
          target: a.target as Address,
          value: a.value as bigint,
          selector: a.selector as `0x${string}`,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        } satisfies AgentTxPayload);
      }
    },
  );

  for (const pool of config.dexPools) {
    listener.subscribe(pool.address, dexV2SwapEvent, "Swap", (logs) => {
      for (const log of logs) {
        listener.emit("priceUpdate", {
          source: pool.name,
          pool: pool.address,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        } satisfies PriceUpdatePayload);
      }
    });
  }

  logger.info("subscriptions registered", {
    registry: 2,
    guard: 1,
    dexPools: config.dexPools.length,
    mode: trigger ? "active" : "detect-only",
  });

  listener.start();

  // ---- Periodic state snapshot + health endpoint --------------------------

  const persistTimer = setInterval(() => stateStore.persistAll(db), STATE_PERSIST_MS);

  const health: HealthServer = createHealthServer(
    config.healthPort,
    () => ({
      status: "ok",
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      lastBlock: lastBlock.toString(),
      agentsWatched: watchlist.activeAgents().length,
      usingFallback: listener.onFallback,
    }),
    logger,
  );

  // ---- Graceful shutdown ---------------------------------------------------

  const shutdown = (signal: string): void => {
    logger.info("shutting down", { signal });
    clearInterval(persistTimer);
    listener.stop();
    health.close();
    stateStore.persistAll(db);
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

main();
