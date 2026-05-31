// One-shot watchlist seeder for the dry-run.
//
// Why this exists: the monitor's log poller starts at the current chain tip and
// only watches forward, so agents registered BEFORE the monitor started (e.g. by
// `demo-agents pnpm run setup`) are never seen and never enter the watchlist.
// This script reads demo-agents/agent-config.json and upserts those agents into
// the same SQLite watchlist the monitor loads on boot.
//
// Usage (stop the monitor first so SQLite isn't being written by two processes):
//   pnpm run seed:watchlist
// then restart `pnpm dev`.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAddress, type Address } from "viem";
import { loadConfig, PROJECT_ROOT } from "./config.js";
import { openDb } from "./db.js";
import { Watchlist } from "./watchlist.js";

interface AgentRecord {
  address: string;
  tokenId: string;
  rulesContract: string;
}

interface AgentConfig {
  yieldchaser: AgentRecord;
  protocolhopper: AgentRecord;
  insomniac: AgentRecord;
}

const main = (): void => {
  const network = process.env.MONITOR_NETWORK ?? "sepolia";
  const config = loadConfig(network);

  const cfgPath = join(PROJECT_ROOT, "demo-agents", "agent-config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as AgentConfig;

  const db = openDb(config.dbPath);
  const watchlist = new Watchlist(db);

  const guard = config.addresses.sentinelGuard;
  const names: (keyof AgentConfig)[] = ["yieldchaser", "protocolhopper", "insomniac"];

  for (const name of names) {
    const rec = cfg[name];
    const agent = getAddress(rec.address) as Address;
    watchlist.upsert({
      agent,
      tokenId: BigInt(rec.tokenId),
      rules: getAddress(rec.rulesContract) as Address,
      guard: getAddress(guard) as Address,
      active: true,
      registeredAtBlock: 0n,
      updatedAt: Date.now(),
    });
    // eslint-disable-next-line no-console
    console.log(`seeded ${name.padEnd(15)} ${agent}  rules=${rec.rulesContract}`);
  }

  const active = watchlist.activeAgents().length;
  // eslint-disable-next-line no-console
  console.log(`\nwatchlist now has ${active} agent(s). Restart the monitor (pnpm dev).`);
};

main();
