import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventListener,
  type ClientFactory,
  type EventLog,
  type WatchSubscription,
} from "../src/listener";

// A fake client factory that records every client it creates and lets a test
// drive logs/errors into the listener — no chain, fully deterministic.
interface FakeClient {
  url: string;
  subs: WatchSubscription[];
  unwatched: number;
}

const makeFakeFactory = (): { clients: FakeClient[]; factory: ClientFactory } => {
  const clients: FakeClient[] = [];
  const factory: ClientFactory = (url) => {
    const client: FakeClient = { url, subs: [], unwatched: 0 };
    clients.push(client);
    return {
      watchContractEvent: (sub) => {
        client.subs.push(sub);
        return () => {
          client.unwatched += 1;
        };
      },
    };
  };
  return { clients, factory };
};

const ADDR = "0x0000000000000000000000000000000000000001" as const;
const ABI = [{ type: "event", name: "Ping", inputs: [] }] as const;

describe("EventListener", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("forwards decoded logs to the subscription handler", () => {
    const { clients, factory } = makeFakeFactory();
    const listener = new EventListener("ws://primary", "ws://fallback", { factory });
    const received: EventLog[] = [];

    listener.subscribe(ADDR, ABI, "Ping", (logs) => received.push(...logs));
    listener.start();

    const log: EventLog = {
      args: { value: 7n },
      blockNumber: 5n,
      transactionHash: "0xabc",
      address: ADDR,
    };
    clients[0].subs[0].onLogs([log]);

    expect(received).toEqual([log]);
    listener.stop();
  });

  it("reconnects with exponential backoff after a subscription error", () => {
    const { clients, factory } = makeFakeFactory();
    const listener = new EventListener("ws://primary", "ws://fallback", {
      factory,
      backoff: { baseMs: 100, maxMs: 10_000, jitter: false, fallbackAfter: 99, stableAfterMs: 1e9 },
    });
    listener.on("error", () => {});
    listener.subscribe(ADDR, ABI, "Ping", () => {});
    listener.start();
    expect(clients).toHaveLength(1);

    // 1st error -> reconnect after base * 2^0 = 100ms
    clients[0].subs[0].onError(new Error("drop"));
    vi.advanceTimersByTime(99);
    expect(clients).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(clients).toHaveLength(2);

    // 2nd error -> reconnect after base * 2^1 = 200ms
    clients[1].subs[0].onError(new Error("drop"));
    vi.advanceTimersByTime(199);
    expect(clients).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(clients).toHaveLength(3);

    listener.stop();
  });

  it("fails over to the fallback URL after fallbackAfter failures", () => {
    const { clients, factory } = makeFakeFactory();
    const listener = new EventListener("ws://primary", "ws://fallback", {
      factory,
      backoff: { baseMs: 10, maxMs: 100, jitter: false, fallbackAfter: 2, stableAfterMs: 1e9 },
    });
    listener.on("error", () => {});
    listener.subscribe(ADDR, ABI, "Ping", () => {});
    listener.start();
    expect(clients[0].url).toBe("ws://primary");
    expect(listener.onFallback).toBe(false);

    clients[0].subs[0].onError(new Error("e1"));
    vi.advanceTimersByTime(10);
    expect(clients[1].url).toBe("ws://primary"); // still primary after 1 failure

    clients[1].subs[0].onError(new Error("e2"));
    expect(listener.onFallback).toBe(true);
    vi.advanceTimersByTime(20); // base * 2^1
    expect(clients[2].url).toBe("ws://fallback");

    listener.stop();
  });

  it("resets the attempt counter once a connection stays stable", () => {
    const { clients, factory } = makeFakeFactory();
    const listener = new EventListener("ws://primary", "ws://fallback", {
      factory,
      backoff: { baseMs: 10, maxMs: 100, jitter: false, fallbackAfter: 2, stableAfterMs: 500 },
    });
    listener.on("error", () => {});
    listener.subscribe(ADDR, ABI, "Ping", () => {});
    listener.start();

    clients[0].subs[0].onError(new Error("e1")); // attempts -> 1
    vi.advanceTimersByTime(10); // reconnect (clients[1]); stable timer armed
    vi.advanceTimersByTime(500); // connection stays stable -> attempts reset to 0

    // A fresh failure should not trip fallback (counter was reset).
    clients[1].subs[0].onError(new Error("e2"));
    expect(listener.onFallback).toBe(false);

    listener.stop();
  });

  it("stop() unwatches all subscriptions and prevents reconnects", () => {
    const { clients, factory } = makeFakeFactory();
    const listener = new EventListener("ws://primary", "ws://fallback", {
      factory,
      backoff: { baseMs: 10, maxMs: 100, jitter: false, fallbackAfter: 99, stableAfterMs: 1e9 },
    });
    listener.on("error", () => {});
    listener.subscribe(ADDR, ABI, "Ping", () => {});
    listener.start();
    listener.stop();
    expect(clients[0].unwatched).toBe(1);

    // An error arriving after stop must not schedule a reconnect.
    clients[0].subs[0].onError(new Error("late"));
    vi.advanceTimersByTime(10_000);
    expect(clients).toHaveLength(1);
  });
});
