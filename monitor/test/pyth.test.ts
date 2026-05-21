import { describe, expect, it } from "vitest";
import { normalizeTo18dp, PythClient, PythError } from "../src/pyth";

const E18 = 10n ** 18n;
const FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as const;

const feedResponse = (price: string, expo: number, publishTime = 1000) =>
  JSON.stringify([{ id: FEED.slice(2), price: { price, conf: "0", expo, publish_time: publishTime } }]);

describe("normalizeTo18dp", () => {
  it("scales a negative-exponent price to 18 decimals", () => {
    expect(normalizeTo18dp("300000000000", -8)).toBe(3000n * E18); // 3000.00
    expect(normalizeTo18dp("12345678", -8)).toBe(123456780000000000n); // 0.12345678
  });
  it("handles an exponent that overshoots 18 dp", () => {
    // expo -20 -> shift -2 -> divide by 100
    expect(normalizeTo18dp("500000000000000000000", -20)).toBe(5n * E18);
  });
});

describe("PythClient", () => {
  it("fetches and normalizes a price to 18dp", async () => {
    const fetchImpl: typeof fetch = async () => new Response(feedResponse("300000000000", -8, 1234), { status: 200 });
    const client = new PythClient({ fetchImpl, now: () => 0 });
    const price = await client.getPrice(FEED);
    expect(price).toEqual({ feedId: FEED, priceUsd: 3000n * E18, publishTime: 1234 });
  });

  it("caches within the TTL (one fetch for two reads)", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(feedResponse("300000000000", -8), { status: 200 });
    };
    const client = new PythClient({ fetchImpl, ttlMs: 30_000, now: () => 1000 });
    await client.getPrice(FEED);
    await client.getPrice(FEED);
    expect(calls).toBe(1);
  });

  it("refetches after the TTL expires", async () => {
    let calls = 0;
    let clock = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(feedResponse("300000000000", -8), { status: 200 });
    };
    const client = new PythClient({ fetchImpl, ttlMs: 30_000, now: () => clock });
    await client.getPrice(FEED);
    clock = 31_000;
    await client.getPrice(FEED);
    expect(calls).toBe(2);
  });

  it("throws PythError on a non-OK response", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 500 });
    const client = new PythClient({ fetchImpl });
    await expect(client.getPrice(FEED)).rejects.toBeInstanceOf(PythError);
  });
});
