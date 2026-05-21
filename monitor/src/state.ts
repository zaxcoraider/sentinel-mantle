// StateStore — per-agent runtime state the anomaly engine reads.
//
// Tracks tx rate (hourly), traded volume (daily), and portfolio valuation
// (current + high-water-mark). tx/volume use fixed UTC buckets rather than a
// true rolling window — simpler, persistable, and accurate enough for the
// guard's hour/day thresholds. `get()` always reports the *current* bucket, so a
// stale count from a previous hour/day reads as 0.
//
// State is snapshotted to SQLite so the monitor knows where it left off after a
// restart.

import { getAddress, type Address } from "viem";
import type { Database } from "./db.js";
import type { AgentState } from "./types.js";

const HOUR = 3600;
const DAY = 86_400;

interface InternalState {
  agent: Address;
  currentValueUsd: bigint;
  highWaterMarkUsd: bigint;
  hourBucket: number;
  txCount: number;
  dayBucket: number;
  volumeUsd: bigint;
}

export interface StateStoreOptions {
  now?: () => number;
}

export class StateStore {
  private readonly states = new Map<string, InternalState>();
  private readonly now: () => number;

  constructor(opts: StateStoreOptions = {}) {
    this.now = opts.now ?? Date.now;
  }

  private nowSec(): number {
    return Math.floor(this.now() / 1000);
  }

  private ensure(agent: Address): InternalState {
    const key = getAddress(agent);
    let s = this.states.get(key);
    if (!s) {
      const nowSec = this.nowSec();
      s = {
        agent: key,
        currentValueUsd: 0n,
        highWaterMarkUsd: 0n,
        hourBucket: Math.floor(nowSec / HOUR),
        txCount: 0,
        dayBucket: Math.floor(nowSec / DAY),
        volumeUsd: 0n,
      };
      this.states.set(key, s);
    }
    return s;
  }

  /** Current-bucket-accurate snapshot for the anomaly engine. */
  get(agent: Address): AgentState {
    const key = getAddress(agent);
    const s = this.states.get(key);
    const nowSec = this.nowSec();
    const hb = Math.floor(nowSec / HOUR);
    const db = Math.floor(nowSec / DAY);
    if (!s) {
      return { agent: key, currentValueUsd: 0n, highWaterMarkUsd: 0n, txCountThisHour: 0, volume24hUsd: 0n };
    }
    return {
      agent: key,
      currentValueUsd: s.currentValueUsd,
      highWaterMarkUsd: s.highWaterMarkUsd,
      txCountThisHour: s.hourBucket === hb ? s.txCount : 0,
      volume24hUsd: s.dayBucket === db ? s.volumeUsd : 0n,
    };
  }

  recordTx(agent: Address, tsSec: number = this.nowSec()): void {
    const s = this.ensure(agent);
    const hb = Math.floor(tsSec / HOUR);
    if (s.hourBucket !== hb) {
      s.hourBucket = hb;
      s.txCount = 0;
    }
    s.txCount += 1;
  }

  recordVolume(agent: Address, usd: bigint, tsSec: number = this.nowSec()): void {
    const s = this.ensure(agent);
    const db = Math.floor(tsSec / DAY);
    if (s.dayBucket !== db) {
      s.dayBucket = db;
      s.volumeUsd = 0n;
    }
    s.volumeUsd += usd;
  }

  recordValuation(agent: Address, currentValueUsd: bigint): void {
    const s = this.ensure(agent);
    s.currentValueUsd = currentValueUsd;
    if (currentValueUsd > s.highWaterMarkUsd) s.highWaterMarkUsd = currentValueUsd;
  }

  // ---- Persistence ----------------------------------------------------------

  private static ensureTable(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_state (
        agent       TEXT PRIMARY KEY,
        current_usd TEXT    NOT NULL,
        hwm_usd     TEXT    NOT NULL,
        hour_bucket INTEGER NOT NULL,
        tx_count    INTEGER NOT NULL,
        day_bucket  INTEGER NOT NULL,
        volume_usd  TEXT    NOT NULL
      );
    `);
  }

  loadAll(db: Database): void {
    StateStore.ensureTable(db);
    const rows = db.prepare(`SELECT * FROM agent_state`).all() as Record<string, unknown>[];
    for (const r of rows) {
      const key = getAddress(String(r.agent));
      this.states.set(key, {
        agent: key,
        currentValueUsd: BigInt(String(r.current_usd)),
        highWaterMarkUsd: BigInt(String(r.hwm_usd)),
        hourBucket: Number(r.hour_bucket),
        txCount: Number(r.tx_count),
        dayBucket: Number(r.day_bucket),
        volumeUsd: BigInt(String(r.volume_usd)),
      });
    }
  }

  persistAll(db: Database): void {
    StateStore.ensureTable(db);
    const stmt = db.prepare(
      `INSERT INTO agent_state (agent, current_usd, hwm_usd, hour_bucket, tx_count, day_bucket, volume_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(agent) DO UPDATE SET
         current_usd = excluded.current_usd,
         hwm_usd     = excluded.hwm_usd,
         hour_bucket = excluded.hour_bucket,
         tx_count    = excluded.tx_count,
         day_bucket  = excluded.day_bucket,
         volume_usd  = excluded.volume_usd`,
    );
    for (const s of this.states.values()) {
      stmt.run(
        s.agent,
        s.currentValueUsd.toString(),
        s.highWaterMarkUsd.toString(),
        s.hourBucket,
        s.txCount,
        s.dayBucket,
        s.volumeUsd.toString(),
      );
    }
  }
}
