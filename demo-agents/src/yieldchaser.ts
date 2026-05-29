// YieldChaser — drawdown victim.
//
// Strategy (per story): rotate between fake mETH/USDY targets based on
// "yield". After 5 successful rotations, miscalculates and yolos 50% of its
// guard balance into a single tx — the "drawdown event".
//
// IMPORTANT: drawdown detection currently runs only inside the off-chain
// monitor and requires a live valuation feed, which isn't wired up yet (see
// project memory caveats). So the YOLO tx will succeed on-chain — Sentinel
// won't auto-rescue. We trigger the breaker manually via manual-trigger.ts
// for the demo.

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

const NAME = 'yieldchaser' as const;
const ROTATIONS_BEFORE_YOLO = 5;
const ROTATION_AMOUNT = parseEther('0.0001');     // ~$0.05 of MNT
const YOLO_RATIO = 50n;                            // 50% of remaining guard balance
const TICK_MS = 60_000;                            // 60s between rotations

const main = async (): Promise<void> => {
  const keys = loadKeys();
  const { account } = walletFromKey(keys[NAME]);
  console.log(banner(NAME, account.address));

  // Targets are addresses we'll "swap with" — the allowlist only contains the
  // deployer EOA (per setup), so we use that. Real DeFi protocols would
  // require token approvals + calldata; demo is harmless wei transfers.
  const target = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY! as Hex).address;

  let rotations = 0;
  let yoloed = false;

  story(NAME, 'wake. yield-chasing loop start.');

  const tick = async (): Promise<void> => {
    const bal = await guardBalance(account.address);
    if (bal === 0n) {
      warn(NAME, 'guard balance is 0 — refund via `pnpm agents:reset`.');
      return;
    }

    if (!yoloed && rotations >= ROTATIONS_BEFORE_YOLO) {
      yoloed = true;
      const amount = (bal * YOLO_RATIO) / 100n;
      story(NAME, `📈 "discovered" alpha. YOLO ${(Number(amount) / 1e18).toFixed(4)} MNT (50% of guard) → ${target.slice(0, 10)}…`);
      const r = await execAsAgent(NAME, target, amount);
      if (r.ok) {
        warn(NAME, `YOLO tx landed ${r.hash?.slice(0, 12)}… drawdown reached. (await monitor or manual trigger)`);
      } else {
        fail(NAME, `YOLO failed: ${r.reason}`);
      }
      return;
    }

    story(NAME, `rotation #${rotations + 1} — swap ${(Number(ROTATION_AMOUNT) / 1e18).toFixed(5)} MNT`);
    const r = await execAsAgent(NAME, target, ROTATION_AMOUNT);
    if (r.paused) {
      warn(NAME, 'circuit breaker tripped — agent paused. exiting.');
      process.exit(0);
    }
    if (r.ok) {
      rotations++;
      ok(NAME, `tx ${r.hash?.slice(0, 12)}…  guard now ${(Number(bal - ROTATION_AMOUNT) / 1e18).toFixed(5)} MNT`);
    } else {
      fail(NAME, r.reason ?? 'unknown');
    }
  };

  await tick();
  setInterval(() => { void tick(); }, TICK_MS);
};

void agentAddressOf(NAME);   // assert config is present
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
