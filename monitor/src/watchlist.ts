// The persisted set of agents the monitor watches. Survives restarts so the
// monitor knows who to watch the moment it comes back up (before backfilling
// events). bigint columns (tokenId, block) are stored as TEXT — SQLite INTEGER
// can't safely hold a 256-bit value.

import { getAddress, type Address } from "viem";
import type { Database } from "./db.js";
import type { WatchedAgent } from "./types.js";

/** A raw SQLite row; node:sqlite returns columns as a plain object. */
type Row = Record<string, unknown>;

export class Watchlist {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        agent            TEXT PRIMARY KEY,
        token_id         TEXT    NOT NULL,
        rules            TEXT    NOT NULL,
        guard            TEXT    NOT NULL,
        active           INTEGER NOT NULL DEFAULT 1,
        registered_block TEXT    NOT NULL,
        updated_at       INTEGER NOT NULL
      );
    `);
  }

  /** Insert or update an agent (AgentGuarded may re-fire on re-registration). */
  upsert(a: WatchedAgent): void {
    this.db
      .prepare(
        `INSERT INTO agents (agent, token_id, rules, guard, active, registered_block, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(agent) DO UPDATE SET
           token_id         = excluded.token_id,
           rules            = excluded.rules,
           guard            = excluded.guard,
           active           = excluded.active,
           registered_block = excluded.registered_block,
           updated_at       = excluded.updated_at`,
      )
      .run(
        getAddress(a.agent),
        a.tokenId.toString(),
        getAddress(a.rules),
        getAddress(a.guard),
        a.active ? 1 : 0,
        a.registeredAtBlock.toString(),
        a.updatedAt,
      );
  }

  /** Mark an agent inactive (AgentDeregistered) while retaining its history. */
  deactivate(agent: Address, updatedAt: number = Date.now()): void {
    this.db
      .prepare(`UPDATE agents SET active = 0, updated_at = ? WHERE agent = ?`)
      .run(updatedAt, getAddress(agent));
  }

  get(agent: Address): WatchedAgent | undefined {
    const row: Row | undefined = this.db
      .prepare(`SELECT * FROM agents WHERE agent = ?`)
      .get(getAddress(agent));
    return row ? toAgent(row) : undefined;
  }

  all(): WatchedAgent[] {
    const rows: Row[] = this.db.prepare(`SELECT * FROM agents`).all();
    return rows.map(toAgent);
  }

  /** Addresses of agents currently guarded — the live watch set. */
  activeAgents(): Address[] {
    const rows: Row[] = this.db
      .prepare(`SELECT agent FROM agents WHERE active = 1`)
      .all();
    return rows.map((r) => getAddress(String(r.agent)));
  }
}

const toAgent = (r: Row): WatchedAgent => ({
  agent: getAddress(String(r.agent)),
  tokenId: BigInt(String(r.token_id)),
  rules: getAddress(String(r.rules)),
  guard: getAddress(String(r.guard)),
  active: Number(r.active) === 1,
  registeredAtBlock: BigInt(String(r.registered_block)),
  updatedAt: Number(r.updated_at),
});
