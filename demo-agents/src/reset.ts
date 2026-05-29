// Reset script — re-funds each agent's guard balance and tops up gas wallets
// so a demo can be re-run. Does NOT re-mint identities or re-deploy
// SafetyRules: those are one-time setup. To start over from scratch, delete
// .agent-keys.json + agent-config.json and re-run `pnpm setup`.

import { parseEther } from 'viem';
import {
  publicClient,
  walletFromKey,
  getDeployerKey,
  loadKeys,
  loadConfig,
  DEPLOYMENTS,
  AGENT_NAMES,
} from './shared.js';
import { SentinelGuardAbi } from './abis.js';
import chalk from 'chalk';

const REFUND = parseEther('0.005');
const TOPUP = parseEther('0.003');
const MIN_AGENT_BALANCE = parseEther('0.002');

const log = (msg: string): void => console.log(chalk.gray(new Date().toISOString().slice(11, 19)) + ' ' + msg);

const main = async (): Promise<void> => {
  const deployerKey = getDeployerKey();
  const { account: deployer, client } = walletFromKey(deployerKey);
  const keys = loadKeys();
  const cfg = loadConfig();

  log(chalk.bold('SENTINEL · resetting demo agents'));

  for (const name of AGENT_NAMES) {
    const agent = cfg[name].address;
    log(`▸ ${name} ${agent}`);

    // top-up agent EOA gas
    const eoaBalance = await publicClient.getBalance({ address: agent });
    if (eoaBalance < MIN_AGENT_BALANCE) {
      const hash = await client.sendTransaction({
        to: agent,
        value: TOPUP,
        account: deployer,
        chain: client.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      log(chalk.green(`  ✓ topped up gas (+${(Number(TOPUP) / 1e18).toFixed(4)} MNT)`));
    } else {
      log(chalk.gray(`  · gas ok (${(Number(eoaBalance) / 1e18).toFixed(4)} MNT)`));
    }

    // re-fund guard balance
    const hash = await client.writeContract({
      address: DEPLOYMENTS.SentinelGuard,
      abi: SentinelGuardAbi,
      functionName: 'depositNativeForAgent',
      args: [agent],
      value: REFUND,
      account: deployer,
      chain: client.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    const guardBal = (await publicClient.readContract({
      address: DEPLOYMENTS.SentinelGuard,
      abi: SentinelGuardAbi,
      functionName: 'balanceOf',
      args: [agent, '0x0000000000000000000000000000000000000000'],
    })) as bigint;
    log(chalk.green(`  ✓ guard balance ${(Number(guardBal) / 1e18).toFixed(4)} MNT`));

    // note paused status
    const paused = (await publicClient.readContract({
      address: DEPLOYMENTS.SentinelGuard,
      abi: SentinelGuardAbi,
      functionName: 'isPaused',
      args: [agent],
    })) as boolean;
    if (paused) {
      log(chalk.yellow(`  ⚠ agent is paused — owner must unpause via web UI or wait 1h cooldown.`));
    }
  }

  log(chalk.green.bold('\n✓ RESET COMPLETE'));
};

main().catch((e) => {
  console.error(chalk.red('RESET FAILED'));
  console.error(e);
  process.exit(1);
});
