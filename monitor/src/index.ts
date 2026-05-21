// Sentinel Monitor — entry point (Phase 3.2: event listener).
//
// Wires the resilient EventListener to the deployed contracts, decodes raw logs
// into domain events, and persists the agent watch list to SQLite. The anomaly
// engine (3.3) and trigger pipeline (3.4) hook into the same domain events.

import type { Address } from "viem";
import { agentRegistryEvents, dexV2SwapEvent, sentinelGuardEvents } from "./abis.js";
import { viemClientFactory } from "./chain.js";
import { loadConfig } from "./config.js";
import { openDb, type Database } from "./db.js";
import { EventListener } from "./listener.js";
import { createLogger, type LogLevel } from "./log.js";
import type {
  AgentDeregisteredPayload,
  AgentRegisteredPayload,
  AgentTxPayload,
  ListenerErrorPayload,
  PriceUpdatePayload,
} from "./types.js";
import { Watchlist } from "./watchlist.js";

const main = (): void => {
  const network = process.env.MONITOR_NETWORK ?? "sepolia";
  const logLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";
  const config = loadConfig(network);
  const logger = createLogger(logLevel, "listener");

  logger.info("starting Sentinel monitor", {
    network: config.network,
    chainId: config.chainId,
    rpc: config.rpcUrl,
    guard: config.addresses.sentinelGuard,
    registry: config.addresses.agentRegistry,
  });

  const db: Database = openDb(config.dbPath);
  const watchlist = new Watchlist(db);
  const known = watchlist.activeAgents();
  logger.info("loaded watch list from disk", { activeAgents: known.length });

  const listener = new EventListener(config.rpcUrl, config.fallbackRpcUrl, {
    factory: viemClientFactory(config.chainId, { logger }),
    logger,
  });

  // ---- Domain event consumers ---------------------------------------------

  listener.on("error", (p: ListenerErrorPayload) => {
    logger.error("listener error", {
      error: p.error.message,
      usingFallback: p.usingFallback,
    });
  });

  listener.on("agentRegistered", (p: AgentRegisteredPayload) => {
    watchlist.upsert({
      agent: p.agent,
      tokenId: p.tokenId,
      rules: p.rules,
      guard: p.guard,
      active: true,
      registeredAtBlock: p.blockNumber ?? 0n,
      updatedAt: Date.now(),
    });
    logger.info("agent registered", {
      agent: p.agent,
      tokenId: p.tokenId,
      rules: p.rules,
    });
  });

  listener.on("agentDeregistered", (p: AgentDeregisteredPayload) => {
    watchlist.deactivate(p.agent);
    logger.info("agent deregistered", { agent: p.agent, tokenId: p.tokenId });
  });

  listener.on("agentTx", (p: AgentTxPayload) => {
    // Phase 3.3: feed state store + anomaly engine here.
    logger.info("agent tx", {
      agent: p.agent,
      target: p.target,
      value: p.value,
      selector: p.selector,
    });
  });

  listener.on("priceUpdate", (p: PriceUpdatePayload) => {
    // Phase 3.3: feed oracle-deviation detection here.
    logger.debug("dex swap", { source: p.source, pool: p.pool });
  });

  // ---- Raw log -> domain event subscriptions ------------------------------

  // AgentRegistry.AgentGuarded -> agentRegistered
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

  // AgentRegistry.AgentDeregistered -> agentDeregistered
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

  // SentinelGuard.AgentExecuted -> agentTx (covers all agents; agent is indexed)
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

  // DEX Swap events -> priceUpdate (config-driven pools; empty by default)
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
  });

  listener.start();

  // ---- Graceful shutdown ---------------------------------------------------

  const shutdown = (signal: string): void => {
    logger.info("shutting down", { signal });
    listener.stop();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

main();
