import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { StateStore } from "../src/state";

const AGENT = getAddress("0x000000000000000000000000000000000000c0de");
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const E18 = 10n ** 18n;

describe("StateStore tx-rate", () => {
  it("counts tx within the hour and resets in a new hour", () => {
    let clock = 10_000_000;
    const store = new StateStore({ now: () => clock });
    store.recordTx(AGENT);
    store.recordTx(AGENT);
    store.recordTx(AGENT);
    expect(store.get(AGENT).txCountThisHour).toBe(3);

    clock += HOUR_MS; // next hour bucket
    expect(store.get(AGENT).txCountThisHour).toBe(0);
    store.recordTx(AGENT);
    expect(store.get(AGENT).txCountThisHour).toBe(1);
  });
});

describe("StateStore volume", () => {
  it("accumulates volume within the day and resets next day", () => {
    let clock = 10_000_000;
    const store = new StateStore({ now: () => clock });
    store.recordVolume(AGENT, 100n * E18);
    store.recordVolume(AGENT, 50n * E18);
    expect(store.get(AGENT).volume24hUsd).toBe(150n * E18);

    clock += DAY_MS;
    expect(store.get(AGENT).volume24hUsd).toBe(0n);
  });
});

describe("StateStore valuation", () => {
  it("tracks current value and a monotonic high-water mark", () => {
    const store = new StateStore({ now: () => 0 });
    store.recordValuation(AGENT, 100n * E18);
    expect(store.get(AGENT)).toMatchObject({
      currentValueUsd: 100n * E18,
      highWaterMarkUsd: 100n * E18,
    });

    store.recordValuation(AGENT, 80n * E18); // drawdown
    expect(store.get(AGENT)).toMatchObject({
      currentValueUsd: 80n * E18,
      highWaterMarkUsd: 100n * E18,
    });

    store.recordValuation(AGENT, 120n * E18); // new high
    expect(store.get(AGENT)).toMatchObject({
      currentValueUsd: 120n * E18,
      highWaterMarkUsd: 120n * E18,
    });
  });
});

describe("StateStore persistence", () => {
  it("snapshots to SQLite and restores", () => {
    const clock = 10_000_000;
    const db = openDb(":memory:");

    const s1 = new StateStore({ now: () => clock });
    s1.recordTx(AGENT);
    s1.recordTx(AGENT);
    s1.recordVolume(AGENT, 250n * E18);
    s1.recordValuation(AGENT, 90n * E18);
    s1.persistAll(db);

    const s2 = new StateStore({ now: () => clock });
    s2.loadAll(db);
    expect(s2.get(AGENT)).toEqual(s1.get(AGENT));

    db.close();
  });
});
