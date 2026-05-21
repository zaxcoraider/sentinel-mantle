// Debug CLI: simulate a specific anomaly and run it through the AnomalyEngine.
//
//   pnpm monitor:debug --agent=0x... --simulate=drawdown
//
// Simulations are purely local (no chain) — they prove the detection logic and,
// once Phase 3.4 lands, the same critical result is what fires the on-chain
// circuit breaker. Supported --simulate values: drawdown, txrate, protocol,
// oracle, volume, offhours.

import { getAddress, type Address } from "viem";
import { AnomalyEngine } from "./anomaly.js";
import { createLogger } from "./log.js";
import type { AgentState, AnomalyContext, SafetyRulesSnapshot } from "./types.js";

const E18 = 10n ** 18n;
type Simulation = "drawdown" | "txrate" | "protocol" | "oracle" | "volume" | "offhours";

const parseArg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const baseRules: SafetyRulesSnapshot = {
  maxDrawdownBps: 1000n,
  maxTxPerHour: 50n,
  oracleDeviationBps: 500n,
  dailyVolumeCapUsd: 10_000n * E18,
  timeOfDayMin: 9,
  timeOfDayMax: 21,
  allowedProtocols: new Set([getAddress("0x000000000000000000000000000000000000aaaa")]),
};

const baseState = (agent: Address): AgentState => ({
  agent,
  currentValueUsd: 100n * E18,
  highWaterMarkUsd: 100n * E18,
  txCountThisHour: 0,
  volume24hUsd: 0n,
});

// Each simulation returns a (state, context) pair that forces a critical breach.
const simulate = (
  agent: Address,
  kind: Simulation,
): { state: AgentState; context: AnomalyContext } => {
  const state = baseState(agent);
  switch (kind) {
    case "drawdown":
      return { state: { ...state, currentValueUsd: 70n * E18 }, context: {} };
    case "txrate":
      return { state: { ...state, txCountThisHour: 75 }, context: {} };
    case "volume":
      return { state: { ...state, volume24hUsd: 12_000n * E18 }, context: {} };
    case "protocol":
      return {
        state,
        context: { txTarget: getAddress("0x000000000000000000000000000000000000dead") },
      };
    case "oracle":
      return { state, context: { agentPrice: 100n * E18, pythPrice: 120n * E18 } };
    case "offhours":
      return { state, context: { timestamp: 3 * 3600 } };
  }
};

const main = (): void => {
  const logger = createLogger("info", "debug");
  const agentArg = parseArg("agent");
  const kind = (parseArg("simulate") ?? "drawdown") as Simulation;

  const valid: Simulation[] = ["drawdown", "txrate", "protocol", "oracle", "volume", "offhours"];
  if (!valid.includes(kind)) {
    logger.error("unknown --simulate value", { got: kind, valid });
    process.exit(1);
  }

  const agent = getAddress(agentArg ?? "0x000000000000000000000000000000000000c0de");
  const { state, context } = simulate(agent, kind);
  const results = new AnomalyEngine().evaluateAll(agent, state, baseRules, context);

  logger.info("simulation result", {
    agent,
    simulate: kind,
    anomalies: results.length,
    results: results.map((r) => ({
      type: r.type,
      severity: r.severity,
      reasonHash: r.reasonHash,
      message: r.message,
    })),
  });

  const critical = results.find((r) => r.severity === "critical");
  if (critical) {
    logger.warn("would trip circuit breaker (Phase 3.4)", {
      agent,
      reason: critical.type,
      reasonHash: critical.reasonHash,
    });
  }
};

main();
