// ProtocolHopper — allowlist victim.
//
// Strategy: scans Mantle DEXes for best swap rates, executes on allowlisted
// targets (in this demo, the deployer EOA acts as the stand-in DEX). After
// ~10 successful swaps, "discovers" a fake DEX (a random fresh address NOT
// in the allowlist) and tries to trade there.
//
// On-chain check (SafetyRules.evaluate) reverts the bad-path tx with
// RuleCheckFailed(RULE_ALLOWED_PROTOCOLS). The off-chain monitor's
// protocol-allowlist detector can independently fire the breaker if it
// catches the attempt via reverted-tx tracking.

import { parseEther, type Hex } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  loadKeys,
  walletFromKey,
  banner,
  story,
  ok,
  warn,
  fail,
} from './shared.js';
import { execAsAgent, guardBalance, agentAddressOf } from './agent-runtime.js';

const NAME = 'protocolhopper' as const;
const SWAPS_BEFORE_FAKE_DEX = 10;
const SWAP_AMOUNT = parseEther('0.0001');
const TICK_MS = 45_000;

// Random EOA generated at startup — represents the "fake DEX" the agent
// foolishly discovers. It's not in the allowlist so executeAsAgent will
// revert with RULE_ALLOWED_PROTOCOLS.
const fakeDex = privateKeyToAccount(generatePrivateKey()).address;

const main = async (): Promise<void> => {
  const keys = loadKeys();
  const { account } = walletFromKey(keys[NAME]);
  console.log(banner(NAME, account.address));

  const allowedTarget = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY! as Hex).address;

  let swaps = 0;
  let attemptedFake = false;

  story(NAME, 'wake. scanning DEXes for arb opportunities.');

  const tick = async (): Promise<void> => {
    const bal = await guardBalance(account.address);
    if (bal === 0n) {
      warn(NAME, 'guard balance is 0 — refund via `pnpm agents:reset`.');
      return;
    }

    if (!attemptedFake && swaps >= SWAPS_BEFORE_FAKE_DEX) {
      attemptedFake = true;
      story(NAME, `🦄 found new DEX at ${fakeDex.slice(0, 10)}… looks profitable!`);
      story(NAME, `attempting swap on unknown protocol…`);
      const r = await execAsAgent(NAME, fakeDex, SWAP_AMOUNT);
      if (r.ok) {
        warn(NAME, 'unexpected: bad-path tx succeeded. allowlist may be misconfigured.');
      } else {
        warn(NAME, `tx blocked by SafetyRules: ${r.reason}`);
        warn(NAME, 'monitor should observe the attempt and may trigger the breaker.');
      }
      return;
    }

    story(NAME, `swap #${swaps + 1} on ${allowedTarget.slice(0, 10)}… (allowlisted)`);
    const r = await execAsAgent(NAME, allowedTarget, SWAP_AMOUNT);
    if (r.paused) {
      warn(NAME, 'circuit breaker tripped — agent paused. exiting.');
      process.exit(0);
    }
    if (r.ok) {
      swaps++;
      ok(NAME, `tx ${r.hash?.slice(0, 12)}…`);
    } else {
      fail(NAME, r.reason ?? 'unknown');
    }
  };

  await tick();
  setInterval(() => { void tick(); }, TICK_MS);
};

void agentAddressOf(NAME);
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
