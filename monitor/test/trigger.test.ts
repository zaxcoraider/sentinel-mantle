import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAddress, type Address, type Hex } from "viem";
import { afterEach, describe, expect, it } from "vitest";
import { Trigger, type GuardWriter, type TxResult } from "../src/trigger";

const AGENT = getAddress("0x000000000000000000000000000000000000c0de");
const MONITOR = getAddress("0x000000000000000000000000000000000000a0a0");
const REASON = `0x${"ab".repeat(32)}` as Hex;

const TX: TxResult = { txHash: "0xtx", blockNumber: 100n, gasUsed: 50_000n, costWei: 1234n };

const makeFakeWriter = (paused = false) => {
  const calls: { agent: Address; reasonHash: Hex }[] = [];
  let isPausedValue = paused;
  const writer: GuardWriter = {
    monitorAddress: () => MONITOR,
    isPaused: async () => isPausedValue,
    trigger: async (agent, reasonHash) => {
      calls.push({ agent, reasonHash });
      return TX;
    },
  };
  return { writer, calls, setPaused: (v: boolean) => (isPausedValue = v) };
};

describe("Trigger", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  it("fires, writes an audit line, and posts to the webhook", async () => {
    const { writer, calls } = makeFakeWriter();
    dir = mkdtempSync(join(tmpdir(), "sentinel-trig-"));
    const auditPath = join(dir, "triggers.log.jsonl");
    let posted: { url: string; body: string } | null = null;
    const fetchImpl: typeof fetch = async (url, init) => {
      posted = { url: String(url), body: String(init?.body) };
      return new Response("ok", { status: 200 });
    };

    const trigger = new Trigger(writer, {
      auditLogPath: auditPath,
      webhookUrl: "http://hook.test",
      fetchImpl,
      now: () => 1_000,
    });
    const outcome = await trigger.fire(AGENT, REASON, "drawdown 2000bps");

    expect(outcome).toEqual({ status: "fired", result: TX });
    expect(calls).toHaveLength(1);

    const entry = JSON.parse(readFileSync(auditPath, "utf8").trim());
    expect(entry).toMatchObject({
      agent: AGENT,
      reasonHash: REASON,
      reasonText: "drawdown 2000bps",
      txHash: "0xtx",
      monitor: MONITOR,
    });

    expect(posted).not.toBeNull();
    expect(posted!.url).toBe("http://hook.test");
    expect(posted!.body).toContain("drawdown 2000bps");
  });

  it("is idempotent within the window, then fires again after it", async () => {
    const { writer, calls } = makeFakeWriter();
    let clock = 1_000;
    const trigger = new Trigger(writer, { idempotencyMs: 300_000, now: () => clock });

    expect((await trigger.fire(AGENT, REASON, "x")).status).toBe("fired");

    clock = 1_000 + 299_999; // still inside the window
    expect(await trigger.fire(AGENT, REASON, "x")).toEqual({
      status: "skipped",
      reason: "idempotent",
    });
    expect(calls).toHaveLength(1);

    clock = 1_000 + 300_001; // window elapsed
    expect((await trigger.fire(AGENT, REASON, "x")).status).toBe("fired");
    expect(calls).toHaveLength(2);
  });

  it("skips when the agent is already paused on-chain", async () => {
    const { writer, calls } = makeFakeWriter(true);
    const trigger = new Trigger(writer, {});
    expect(await trigger.fire(AGENT, REASON, "x")).toEqual({
      status: "skipped",
      reason: "already-paused",
    });
    expect(calls).toHaveLength(0);
  });

  it("still reports fired when the webhook throws", async () => {
    const { writer } = makeFakeWriter();
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network down");
    };
    const trigger = new Trigger(writer, { webhookUrl: "http://hook.test", fetchImpl, now: () => 1 });
    expect((await trigger.fire(AGENT, REASON, "x")).status).toBe("fired");
  });
});
