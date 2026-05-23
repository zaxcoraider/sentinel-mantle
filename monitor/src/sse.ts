// SSE (Server-Sent Events) hub. Keeps a set of connected HTTP response streams
// and fans out typed events to all of them. Zero external dependencies.

import type { ServerResponse } from "node:http";

export class SseHub {
  private readonly clients = new Set<ServerResponse>();
  private counter = 0;

  addClient(res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
    });
    res.flushHeaders();
    res.write(":ok\n\n");
    this.clients.add(res);
    const drop = (): void => {
      this.clients.delete(res);
    };
    res.on("close", drop);
    res.on("error", drop);
  }

  broadcast(event: string, data: Record<string, unknown>): void {
    if (this.clients.size === 0) return;
    const id = String(++this.counter);
    const json = JSON.stringify({ ...data, ts: Date.now() });
    const payload = `id:${id}\nevent:${event}\ndata:${json}\n\n`;
    for (const res of this.clients) {
      try {
        res.write(payload);
      } catch {
        this.clients.delete(res);
      }
    }
  }

  ping(): void {
    const payload = ":ping\n\n";
    for (const res of this.clients) {
      try {
        res.write(payload);
      } catch {
        this.clients.delete(res);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
