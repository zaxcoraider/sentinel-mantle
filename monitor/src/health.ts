// Minimal HTTP server exposing:
//   GET /health  — liveness snapshot (probed by Railway/Fly)
//   GET /events  — SSE stream of monitor events (consumed by /watch page)
//   GET /agents  — JSON snapshot of active agents + their status

import { createServer, type Server } from "node:http";
import type { Logger } from "./log.js";
import { silentLogger } from "./log.js";
import type { SseHub } from "./sse.js";

export interface HealthSnapshot {
  status: "ok";
  uptimeSec: number;
  lastBlock: string;
  agentsWatched: number;
  usingFallback: boolean;
}

export interface AgentStatusEntry {
  agent: string;
  status: "guarded" | "warn" | "tripped";
  tokenId: string;
  lastSeenMs: number;
}

export interface HealthServerOptions {
  hub?: SseHub;
  agents?: () => AgentStatusEntry[];
}

export interface HealthServer {
  close(): void;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
} as const;

export const createHealthServer = (
  port: number,
  snapshot: () => HealthSnapshot,
  logger: Logger = silentLogger,
  options?: HealthServerOptions,
): HealthServer => {
  const server: Server = createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json", ...CORS });
      res.end(JSON.stringify(snapshot()));
      return;
    }

    if (req.method === "GET" && req.url === "/events") {
      if (!options?.hub) {
        res.writeHead(503, { "content-type": "application/json", ...CORS });
        res.end(JSON.stringify({ error: "SSE hub not configured" }));
        return;
      }
      options.hub.addClient(res);
      return;
    }

    if (req.method === "GET" && req.url === "/agents") {
      const list = options?.agents?.() ?? [];
      res.writeHead(200, { "content-type": "application/json", ...CORS });
      res.end(JSON.stringify(list));
      return;
    }

    res.writeHead(404, { "content-type": "application/json", ...CORS });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(port, () => logger.info("health endpoint listening", { port }));
  server.on("error", (err) => logger.error("health server error", { error: err.message }));

  return { close: () => server.close() };
};
