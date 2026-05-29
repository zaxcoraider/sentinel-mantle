// Manual circuit-breaker trigger — useful when you want to fire the breaker
// for the demo without waiting for the off-chain monitor (e.g. for YieldChaser
// whose drawdown isn't auto-detected yet).
//
// Usage:
//   tsx src/manual-trigger.ts <agentName> <reasonString>
//
// Example:
//   tsx src/manual-trigger.ts yieldchaser MAX_DRAWDOWN
//
// reasonString is the SafetyRules rule key, one of:
//   MAX_DRAWDOWN | MAX_TX_PER_HOUR | ALLOWED_PROTOCOLS |
//   ORACLE_DEVIATION | DAILY_VOLUME | TIME_WINDOW

import { keccak256, toBytes } from 'viem';
import {
  publicClient,
  walletFromKey,
  getMonitorKey,
  loadConfig,
  DEPLOYMENTS,
  AGENT_NAMES,
  type AgentName,
} from './shared.js';
import { SentinelGuardAbi } from './abis.js';
import chalk from 'chalk';

const main = async (): Promise<void> => {
  const [, , agentName, reason] = process.argv;
  if (!agentName || !reason) {
    console.error('Usage: tsx src/manual-trigger.ts <agentName> <reasonString>');
    process.exit(1);
  }
  if (!AGENT_NAMES.includes(agentName as AgentName)) {
    console.error(`Unknown agent: ${agentName}. One of: ${AGENT_NAMES.join(', ')}`);
    process.exit(1);
  }

  const cfg = loadConfig();
  const agent = cfg[agentName as AgentName].address;
  const reasonHash = keccak256(toBytes(reason));

  const monitorKey = getMonitorKey();
  const { account: monitor, client } = walletFromKey(monitorKey);

  console.log(chalk.bold('SENTINEL · manual circuit-breaker trigger'));
  console.log(chalk.gray(`  agent   ${agent}`));
  console.log(chalk.gray(`  reason  "${reason}" → ${reasonHash}`));
  console.log(chalk.gray(`  monitor ${monitor.address}`));

  const paused = (await publicClient.readContract({
    address: DEPLOYMENTS.SentinelGuard,
    abi: SentinelGuardAbi,
    functionName: 'isPaused',
    args: [agent],
  })) as boolean;
  if (paused) {
    console.log(chalk.yellow('⚠ already paused — nothing to do.'));
    return;
  }

  const hash = await client.writeContract({
    address: DEPLOYMENTS.SentinelGuard,
    abi: SentinelGuardAbi,
    functionName: 'triggerCircuitBreaker',
    args: [agent, reasonHash],
    account: monitor,
    chain: client.chain,
  });
  console.log(chalk.cyan(`tx ${hash}`));
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'success') {
    console.log(chalk.green.bold(`✓ CIRCUIT BREAKER TRIGGERED for ${agentName}`));
  } else {
    console.log(chalk.red('✗ tx reverted'));
    process.exit(1);
  }
};

main().catch((e) => {
  console.error(chalk.red('TRIGGER FAILED'));
  console.error(e);
  process.exit(1);
});
