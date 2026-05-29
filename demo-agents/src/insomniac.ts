// Insomniac — off-hours victim.
//
// Strategy: normal LP rebalancer; configured to operate 12:00–22:00 UTC.
// During allowed hours, makes small "rebalance" txs. Outside the window,
// "ignores" the time rule and attempts a tx anyway — on-chain SafetyRules
// reverts with RULE_TIME_WINDOW.

import { parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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

const NAME = 'insomniac' as const;
const REBALANCE_AMOUNT = parseEther('0.0001');
const TICK_MS = 60_000;
const ALLOWED_MIN_HOUR = 12;
const ALLOWED_MAX_HOUR = 22;

const currentHourUtc = (): number => new Date().getUTCHours();

const main = async (): Promise<void> => {
  const keys = loadKeys();
  const { account } = walletFromKey(keys[NAME]);
  console.log(banner(NAME, account.address));

  const target = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY! as Hex).address;
  let attemptedOffHours = false;

  story(NAME, `wake. allowed window ${ALLOWED_MIN_HOUR}:00–${ALLOWED_MAX_HOUR}:00 UTC.`);

  const tick = async (): Promise<void> => {
    const hour = currentHourUtc();
    const inWindow = hour >= ALLOWED_MIN_HOUR && hour <= ALLOWED_MAX_HOUR;

    const bal = await guardBalance(account.address);
    if (bal === 0n) {
      warn(NAME, 'guard balance is 0 — refund via `pnpm agents:reset`.');
      return;
    }

    if (!inWindow && !attemptedOffHours) {
      attemptedOffHours = true;
      story(NAME, `🌙 hour ${hour}:00 UTC — outside window. ignoring rule, attempting rebalance anyway.`);
      const r = await execAsAgent(NAME, target, REBALANCE_AMOUNT);
      if (r.ok) {
        warn(NAME, 'unexpected: off-hours tx succeeded. check rule config.');
      } else {
        warn(NAME, `tx blocked by SafetyRules: ${r.reason}`);
        warn(NAME, 'monitor should observe the off-hours attempt.');
      }
      return;
    }

    if (!inWindow) {
      story(NAME, `hour ${hour}:00 UTC — outside window. skipping.`);
      return;
    }

    story(NAME, `hour ${hour}:00 UTC — rebalance LP.`);
    const r = await execAsAgent(NAME, target, REBALANCE_AMOUNT);
    if (r.paused) {
      warn(NAME, 'circuit breaker tripped — agent paused. exiting.');
      process.exit(0);
    }
    if (r.ok) {
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
