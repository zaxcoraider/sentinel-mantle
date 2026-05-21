import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import type { WatchedAgent } from "../src/types";
import { Watchlist } from "../src/watchlist";

const sample: WatchedAgent = {
  agent: "0x1111111111111111111111111111111111111111",
  tokenId: 42n,
  rules: "0x2222222222222222222222222222222222222222",
  guard: "0x3333333333333333333333333333333333333333",
  active: true,
  registeredAtBlock: 123456789n,
  updatedAt: 1000,
};

describe("Watchlist (in-memory)", () => {
  it("upsert + get roundtrips and preserves bigints", () => {
    const wl = new Watchlist(openDb(":memory:"));
    wl.upsert(sample);
    const got = wl.get(sample.agent);
    expect(got).toEqual(sample);
    expect(typeof got?.tokenId).toBe("bigint");
    expect(typeof got?.registeredAtBlock).toBe("bigint");
  });

  it("deactivate drops from activeAgents but keeps the row", () => {
    const wl = new Watchlist(openDb(":memory:"));
    wl.upsert(sample);
    expect(wl.activeAgents()).toHaveLength(1);

    wl.deactivate(sample.agent, 2000);
    expect(wl.activeAgents()).toHaveLength(0);
    expect(wl.get(sample.agent)?.active).toBe(false);
    expect(wl.get(sample.agent)?.updatedAt).toBe(2000);
  });

  it("upsert updates an existing agent in place", () => {
    const wl = new Watchlist(openDb(":memory:"));
    wl.upsert(sample);
    wl.upsert({ ...sample, tokenId: 99n, updatedAt: 3000 });
    expect(wl.all()).toHaveLength(1);
    expect(wl.get(sample.agent)?.tokenId).toBe(99n);
  });

  it("returns undefined for an unknown agent", () => {
    const wl = new Watchlist(openDb(":memory:"));
    expect(wl.get(sample.agent)).toBeUndefined();
  });
});

describe("Watchlist (persistent)", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("survives a close + reopen (restart-safety)", () => {
    dir = mkdtempSync(join(tmpdir(), "sentinel-wl-"));
    const path = join(dir, "agents.db");

    const db1 = openDb(path);
    new Watchlist(db1).upsert(sample);
    db1.close();

    const db2 = openDb(path);
    const got = new Watchlist(db2).get(sample.agent);
    db2.close();

    expect(got).toEqual(sample);
  });
});
