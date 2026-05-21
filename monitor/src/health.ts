// Minimal HTTP health endpoint. GET /health -> 200 with a liveness snapshot the
// deploy platform (Railway/Fly) can probe. Everything else -> 404.

import { createServer, type Server } from "node:http";
import type { Logger } from "./log.js";
import { silentLogger } from "./log.js";

export interface HealthSnapshot {
  status: "ok";
  uptimeSec: number;
  lastBlock: string;
  agentsWatched: number;
  usingFallback: boolean;
}

export interface HealthServer {
  close(): void;
}

export const createHealthServer = (
  port: number,
  snapshot: () => HealthSnapshot,
  logger: Logger = silentLogger,
): HealthServer => {
  const server: Server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(snapshot()));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(port, () => logger.info("health endpoint listening", { port }));
  server.on("error", (err) => logger.error("health server error", { error: err.message }));

  return { close: () => server.close() };
};
