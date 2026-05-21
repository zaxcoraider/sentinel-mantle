// SQLite handle for the monitor's local state.
//
// Uses Node's built-in `node:sqlite` (DatabaseSync) instead of better-sqlite3:
// the native better-sqlite3 binary has no prebuild for Node 24 (module v137) and
// won't compile on this machine. node:sqlite is a real SQLite engine, writes the
// same on-disk format, and needs zero native build step. The API surface used
// here (exec/prepare/run/get/all) is the better-sqlite3 subset, so swapping back
// later — if the project pins Node 20 in prod — touches only this file.

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";

// Loaded via createRequire (not a static import) so bundlers/test runners that
// don't yet recognize the `node:sqlite` builtin don't try to resolve it at
// transform time — it's pulled straight from the Node runtime instead.
const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

export type Database = InstanceType<typeof DatabaseSync>;

/** Open (creating if needed) the SQLite DB at `path`. Use ":memory:" for tests. */
export const openDb = (path: string): Database => {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
};
