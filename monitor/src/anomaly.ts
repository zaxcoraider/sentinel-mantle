// AnomalyEngine — the detection brain.
//
// Six pure detectors, each mirroring the on-chain math in SafetyRules.evaluate()
// (contracts/src/SafetyRules.sol) so off-chain and on-chain agree on what counts
// as a violation. The difference is *visibility*: on-chain, value/price/volume
// are 0 at exec time, so drawdown/oracle/volume are detectable only here.
//
// Two-tier severity: a hard breach is `critical` (trips the breaker); nearing a
// limit (>= warn ratio) is `warn` (logged only). Time-window breaches are `warn`
// — operating off-hours alone rarely warrants freezing funds.
//
// reasonHash = keccak256(utf8(type)); since each AnomalyType string equals the
// SafetyRules RULE_* name, this matches the on-chain bytes32 rule key exactly,
// so CircuitBreakerTriggered.reason decodes to the same enum the UI shows.

import { getAddress, keccak256, toBytes, type Address, type Hex } from "viem";
import type {
  AgentState,
  AnomalyContext,
  AnomalyResult,
  AnomalyType,
  SafetyRulesSnapshot,
} from "./types.js";

const BPS = 10_000n;

/** Warn when a metric reaches this percent of its limit (but hasn't breached). */
export const DEFAULT_WARN_PERCENT = 80n;

export const reasonHashFor = (type: AnomalyType): Hex => keccak256(toBytes(type));

const ok = (type: AnomalyType): AnomalyResult => ({
  anomaly: false,
  type,
  reasonHash: reasonHashFor(type),
  severity: "warn",
  message: "ok",
});

const warn = (type: AnomalyType, message: string): AnomalyResult => ({
  anomaly: true,
  type,
  reasonHash: reasonHashFor(type),
  severity: "warn",
  message,
});

const critical = (type: AnomalyType, message: string): AnomalyResult => ({
  anomaly: true,
  type,
  reasonHash: reasonHashFor(type),
  severity: "critical",
  message,
});

// value >= (limit * warnPercent / 100), used to decide the warn tier.
const nearing = (value: bigint, limit: bigint, warnPercent: bigint): boolean =>
  value * 100n >= limit * warnPercent;

export const detectDrawdown = (
  state: AgentState,
  rules: SafetyRulesSnapshot,
  warnPercent: bigint = DEFAULT_WARN_PERCENT,
): AnomalyResult => {
  const { highWaterMarkUsd: hwm, currentValueUsd: cur } = state;
  if (hwm === 0n || cur >= hwm) return ok("MAX_DRAWDOWN");
  const drawdownBps = ((hwm - cur) * BPS) / hwm;
  if (drawdownBps > rules.maxDrawdownBps) {
    return critical(
      "MAX_DRAWDOWN",
      `drawdown ${drawdownBps}bps exceeds limit ${rules.maxDrawdownBps}bps`,
    );
  }
  if (nearing(drawdownBps, rules.maxDrawdownBps, warnPercent)) {
    return warn(
      "MAX_DRAWDOWN",
      `drawdown ${drawdownBps}bps nearing limit ${rules.maxDrawdownBps}bps`,
    );
  }
  return ok("MAX_DRAWDOWN");
};

export const detectTxRate = (
  state: AgentState,
  rules: SafetyRulesSnapshot,
  warnPercent: bigint = DEFAULT_WARN_PERCENT,
): AnomalyResult => {
  const count = BigInt(state.txCountThisHour);
  if (count > rules.maxTxPerHour) {
    return critical("MAX_TX_PER_HOUR", `${count} tx/hr exceeds limit ${rules.maxTxPerHour}`);
  }
  if (nearing(count, rules.maxTxPerHour, warnPercent)) {
    return warn("MAX_TX_PER_HOUR", `${count} tx/hr nearing limit ${rules.maxTxPerHour}`);
  }
  return ok("MAX_TX_PER_HOUR");
};

export const detectProtocolViolation = (
  _state: AgentState,
  rules: SafetyRulesSnapshot,
  txTarget?: Address,
): AnomalyResult => {
  if (!txTarget) return ok("ALLOWED_PROTOCOLS");
  const target = getAddress(txTarget);
  if (rules.allowedProtocols.has(target)) return ok("ALLOWED_PROTOCOLS");
  return critical("ALLOWED_PROTOCOLS", `called non-allowlisted protocol ${target}`);
};

export const detectOracleDeviation = (
  _state: AgentState,
  rules: SafetyRulesSnapshot,
  agentPrice?: bigint,
  pythPrice?: bigint,
  warnPercent: bigint = DEFAULT_WARN_PERCENT,
): AnomalyResult => {
  if (agentPrice === undefined || pythPrice === undefined) return ok("ORACLE_DEVIATION");
  if (agentPrice <= 0n || pythPrice <= 0n) return ok("ORACLE_DEVIATION");
  const diff = agentPrice > pythPrice ? agentPrice - pythPrice : pythPrice - agentPrice;
  const denom = agentPrice > pythPrice ? agentPrice : pythPrice;
  const deviationBps = (diff * BPS) / denom;
  if (deviationBps > rules.oracleDeviationBps) {
    return critical(
      "ORACLE_DEVIATION",
      `price deviation ${deviationBps}bps exceeds limit ${rules.oracleDeviationBps}bps`,
    );
  }
  if (nearing(deviationBps, rules.oracleDeviationBps, warnPercent)) {
    return warn(
      "ORACLE_DEVIATION",
      `price deviation ${deviationBps}bps nearing limit ${rules.oracleDeviationBps}bps`,
    );
  }
  return ok("ORACLE_DEVIATION");
};

export const detectDailyVolume = (
  state: AgentState,
  rules: SafetyRulesSnapshot,
  warnPercent: bigint = DEFAULT_WARN_PERCENT,
): AnomalyResult => {
  if (state.volume24hUsd > rules.dailyVolumeCapUsd) {
    return critical(
      "DAILY_VOLUME",
      `24h volume ${state.volume24hUsd} exceeds cap ${rules.dailyVolumeCapUsd}`,
    );
  }
  if (nearing(state.volume24hUsd, rules.dailyVolumeCapUsd, warnPercent)) {
    return warn(
      "DAILY_VOLUME",
      `24h volume ${state.volume24hUsd} nearing cap ${rules.dailyVolumeCapUsd}`,
    );
  }
  return ok("DAILY_VOLUME");
};

// Mirrors SafetyRules._isHourAllowed, including overnight windows (min > max).
const isHourAllowed = (hour: number, min: number, max: number): boolean =>
  min <= max ? hour >= min && hour <= max : hour >= min || hour <= max;

export const detectOffHours = (
  _state: AgentState,
  rules: SafetyRulesSnapshot,
  timestamp?: number,
): AnomalyResult => {
  if (timestamp === undefined) return ok("TIME_WINDOW");
  const hour = Math.floor(timestamp / 3600) % 24; // UTC hour
  if (isHourAllowed(hour, rules.timeOfDayMin, rules.timeOfDayMax)) return ok("TIME_WINDOW");
  return warn(
    "TIME_WINDOW",
    `operating at ${hour}:00 UTC, outside [${rules.timeOfDayMin}-${rules.timeOfDayMax}]`,
  );
};

export interface AnomalyEngineOptions {
  /** Warn tier threshold as a percent of each limit (default 80). */
  warnPercent?: bigint;
}

export class AnomalyEngine {
  private readonly warnPercent: bigint;

  constructor(opts: AnomalyEngineOptions = {}) {
    this.warnPercent = opts.warnPercent ?? DEFAULT_WARN_PERCENT;
  }

  /** Run every detector and return only the results that flagged an anomaly. */
  evaluateAll(
    _agent: Address,
    state: AgentState,
    rules: SafetyRulesSnapshot,
    context: AnomalyContext = {},
  ): AnomalyResult[] {
    const results = [
      detectDrawdown(state, rules, this.warnPercent),
      detectTxRate(state, rules, this.warnPercent),
      detectProtocolViolation(state, rules, context.txTarget),
      detectOracleDeviation(state, rules, context.agentPrice, context.pythPrice, this.warnPercent),
      detectDailyVolume(state, rules, this.warnPercent),
      detectOffHours(state, rules, context.timestamp),
    ];
    return results.filter((r) => r.anomaly);
  }
}
