import { describe, expect, it } from "vitest";
import { ValuationReader, tokensForChain, type ValuationChain } from "../src/valuation";
import { PythClient, PYTH_FEEDS } from "../src/pyth";

const E18 = 10n ** 18n;
const AGENT = "0x000000000000000000000000000000000000aAaA" as const;
const NATIVE = "0x0000000000000000000000000000000000000000";

const feedResponse = (feedId: string, price: string, expo: number) =>
  JSON.stringify([
    { id: feedId.replace(/^0x/, ""), price: { price, conf: "0", expo, publish_time: 1 } },
  ]);

describe("ValuationReader", () => {
  it("values native MNT balance at the Pyth price (USD 18dp)", async () => {
    // MNT = $1.50 (mantissa 150000000, expo -8 -> 1.5e18)
    const fetchImpl: typeof fetch = async () =>
      new Response(feedResponse(PYTH_FEEDS["MNT/USD"], "150000000", -8), { status: 200 });
    const pyth = new PythClient({ fetchImpl, now: () => 0 });

    const chain: ValuationChain = {
      balanceOf: async (_agent, token) => (token === NATIVE ? 2n * E18 : 0n),
      isPaused: async () => false,
    };
    const reader = new ValuationReader({ chain, pyth, tokens: tokensForChain(5003) });

    // 2 MNT * $1.50 = $3.00
    expect(await reader.valueAgent(AGENT)).toBe(3n * E18);
  });

  it("skips zero-balance tokens (never fetches a price for them)", async () => {
    let fetchCalls = 0;
    const fetchImpl: typeof fetch = async () => {
      fetchCalls += 1;
      return new Response(feedResponse(PYTH_FEEDS["MNT/USD"], "150000000", -8), { status: 200 });
    };
    const pyth = new PythClient({ fetchImpl, now: () => 0 });
    const chain: ValuationChain = { balanceOf: async () => 0n, isPaused: async () => false };
    const reader = new ValuationReader({ chain, pyth, tokens: tokensForChain(5003) });

    expect(await reader.valueAgent(AGENT)).toBe(0n);
    expect(fetchCalls).toBe(0);
  });

  it("reports pause state from the chain", async () => {
    const pyth = new PythClient({ fetchImpl: async () => new Response("[]"), now: () => 0 });
    const chain: ValuationChain = { balanceOf: async () => 0n, isPaused: async () => true };
    const reader = new ValuationReader({ chain, pyth, tokens: tokensForChain(5000) });
    expect(await reader.isPaused(AGENT)).toBe(true);
  });
});
