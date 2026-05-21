import { getAddress, keccak256, toBytes } from "viem";
import { describe, expect, it } from "vitest";
import {
  AnomalyEngine,
  detectDailyVolume,
  detectDrawdown,
  detectOffHours,
  detectOracleDeviation,
  detectProtocolViolation,
  detectTxRate,
  reasonHashFor,
} from "../src/anomaly";
import type { AgentState, SafetyRulesSnapshot } from "../src/types";

const E18 = 10n ** 18n;
const AGENT = getAddress("0x000000000000000000000000000000000000cccc");
const ALLOWED = getAddress("0x000000000000000000000000000000000000aaaa");
const NOTALLOWED = getAddress("0x000000000000000000000000000000000000bbbb");

const baseRules: SafetyRulesSnapshot = {
  maxDrawdownBps: 1000n, // 10%
  maxTxPerHour: 50n,
  oracleDeviationBps: 500n, // 5%
  dailyVolumeCapUsd: 10_000n * E18,
  timeOfDayMin: 9,
  timeOfDayMax: 21,
  allowedProtocols: new Set([ALLOWED]),
};

const baseState: AgentState = {
  agent: AGENT,
  currentValueUsd: 100n * E18,
  highWaterMarkUsd: 100n * E18,
  txCountThisHour: 0,
  volume24hUsd: 0n,
};

const hourTs = (hour: number): number => hour * 3600;

describe("detectDrawdown", () => {
  it("no anomaly below the warn threshold", () => {
    const r = detectDrawdown({ ...baseState, currentValueUsd: 95n * E18 }, baseRules); // 500bps
    expect(r.anomaly).toBe(false);
  });
  it("warns when nearing the limit", () => {
    const r = detectDrawdown({ ...baseState, currentValueUsd: 91n * E18 }, baseRules); // 900bps
    expect(r).toMatchObject({ anomaly: true, severity: "warn", type: "MAX_DRAWDOWN" });
  });
  it("critical when exceeding the limit", () => {
    const r = detectDrawdown({ ...baseState, currentValueUsd: 80n * E18 }, baseRules); // 2000bps
    expect(r).toMatchObject({ anomaly: true, severity: "critical", type: "MAX_DRAWDOWN" });
  });
  it("no anomaly when value is at/above the high-water mark", () => {
    const r = detectDrawdown({ ...baseState, currentValueUsd: 120n * E18 }, baseRules);
    expect(r.anomaly).toBe(false);
  });
});

describe("detectTxRate", () => {
  it("no anomaly well under the cap", () => {
    expect(detectTxRate({ ...baseState, txCountThisHour: 10 }, baseRules).anomaly).toBe(false);
  });
  it("warns when nearing the cap", () => {
    const r = detectTxRate({ ...baseState, txCountThisHour: 45 }, baseRules);
    expect(r).toMatchObject({ anomaly: true, severity: "warn", type: "MAX_TX_PER_HOUR" });
  });
  it("critical when over the cap", () => {
    const r = detectTxRate({ ...baseState, txCountThisHour: 60 }, baseRules);
    expect(r).toMatchObject({ anomaly: true, severity: "critical" });
  });
});

describe("detectProtocolViolation", () => {
  it("no anomaly for an allowlisted protocol", () => {
    expect(detectProtocolViolation(baseState, baseRules, ALLOWED).anomaly).toBe(false);
  });
  it("no anomaly when no protocol was called", () => {
    expect(detectProtocolViolation(baseState, baseRules, undefined).anomaly).toBe(false);
  });
  it("critical for a non-allowlisted protocol", () => {
    const r = detectProtocolViolation(baseState, baseRules, NOTALLOWED);
    expect(r).toMatchObject({ anomaly: true, severity: "critical", type: "ALLOWED_PROTOCOLS" });
  });
  it("matches allowlist regardless of address casing", () => {
    expect(detectProtocolViolation(baseState, baseRules, ALLOWED.toLowerCase() as `0x${string}`).anomaly).toBe(
      false,
    );
  });
});

describe("detectOracleDeviation", () => {
  it("no anomaly for a small deviation", () => {
    const r = detectOracleDeviation(baseState, baseRules, 100n * E18, 102n * E18); // ~196bps
    expect(r.anomaly).toBe(false);
  });
  it("warns when nearing the limit", () => {
    const r = detectOracleDeviation(baseState, baseRules, 100n * E18, 105n * E18); // ~476bps
    expect(r).toMatchObject({ anomaly: true, severity: "warn", type: "ORACLE_DEVIATION" });
  });
  it("critical for a large deviation", () => {
    const r = detectOracleDeviation(baseState, baseRules, 100n * E18, 110n * E18); // ~909bps
    expect(r).toMatchObject({ anomaly: true, severity: "critical" });
  });
  it("no anomaly when a price is missing", () => {
    expect(detectOracleDeviation(baseState, baseRules, undefined, 110n * E18).anomaly).toBe(false);
  });
});

describe("detectDailyVolume", () => {
  it("no anomaly under the cap", () => {
    expect(detectDailyVolume({ ...baseState, volume24hUsd: 5_000n * E18 }, baseRules).anomaly).toBe(false);
  });
  it("warns when nearing the cap", () => {
    const r = detectDailyVolume({ ...baseState, volume24hUsd: 9_000n * E18 }, baseRules);
    expect(r).toMatchObject({ anomaly: true, severity: "warn", type: "DAILY_VOLUME" });
  });
  it("critical when over the cap", () => {
    const r = detectDailyVolume({ ...baseState, volume24hUsd: 11_000n * E18 }, baseRules);
    expect(r).toMatchObject({ anomaly: true, severity: "critical" });
  });
});

describe("detectOffHours", () => {
  it("no anomaly inside the window", () => {
    expect(detectOffHours(baseState, baseRules, hourTs(12)).anomaly).toBe(false);
  });
  it("warns outside the window", () => {
    const r = detectOffHours(baseState, baseRules, hourTs(3));
    expect(r).toMatchObject({ anomaly: true, severity: "warn", type: "TIME_WINDOW" });
  });
  it("no anomaly when no timestamp is given", () => {
    expect(detectOffHours(baseState, baseRules, undefined).anomaly).toBe(false);
  });
  it("handles overnight windows (min > max)", () => {
    const overnight = { ...baseRules, timeOfDayMin: 22, timeOfDayMax: 6 };
    expect(detectOffHours(baseState, overnight, hourTs(2)).anomaly).toBe(false); // 02:00 allowed
    expect(detectOffHours(baseState, overnight, hourTs(12)).anomaly).toBe(true); // 12:00 not
  });
});

describe("reasonHashFor", () => {
  it("equals keccak256 of the UTF-8 rule name (matches on-chain RULE_* keys)", () => {
    expect(reasonHashFor("MAX_DRAWDOWN")).toBe(keccak256(toBytes("MAX_DRAWDOWN")));
    expect(reasonHashFor("ORACLE_DEVIATION")).toBe(keccak256(toBytes("ORACLE_DEVIATION")));
  });
});

describe("AnomalyEngine.evaluateAll", () => {
  const engine = new AnomalyEngine();

  it("returns only flagged anomalies across all detectors", () => {
    const state: AgentState = {
      ...baseState,
      currentValueUsd: 80n * E18, // drawdown critical
      volume24hUsd: 9_000n * E18, // volume warn
    };
    const results = engine.evaluateAll(AGENT, state, baseRules, {
      txTarget: NOTALLOWED, // protocol critical
      timestamp: hourTs(3), // off-hours warn
    });
    const types = results.map((r) => r.type).sort();
    expect(types).toEqual(["ALLOWED_PROTOCOLS", "DAILY_VOLUME", "MAX_DRAWDOWN", "TIME_WINDOW"]);
    const criticals = results.filter((r) => r.severity === "critical").map((r) => r.type).sort();
    expect(criticals).toEqual(["ALLOWED_PROTOCOLS", "MAX_DRAWDOWN"]);
  });

  it("returns an empty array when everything is within limits", () => {
    const results = engine.evaluateAll(AGENT, baseState, baseRules, {
      txTarget: ALLOWED,
      agentPrice: 100n * E18,
      pythPrice: 100n * E18,
      timestamp: hourTs(12),
    });
    expect(results).toEqual([]);
  });
});
