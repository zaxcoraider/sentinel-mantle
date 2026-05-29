// One-time setup for demo agents:
//   1. Generate (or load) 3 agent EOAs into .agent-keys.json.
//   2. Transfer gas from the deployer to each agent EOA (only if low).
//   3. For each agent (if not already guarded):
//        a. Mint an ERC-8004 NFT (owner = deployer, agentAddress = agent EOA).
//        b. Deploy a SafetyRules instance tuned for that agent's failure mode.
//        c. Register the agent with AgentRegistry.
//   4. Deposit MNT into each agent's guard balance (always — for repeated demos).
//   5. Persist agent-config.json so the agent loops can read addresses/tokenIds.

import { parseEther, encodeAbiParameters, getAddress, type Address, type Hex } from 'viem';
import {
  DEPLOYMENTS,
  publicClient,
  walletFromKey,
  getDeployerKey,
  loadOrCreateKeys,
  saveConfig,
  AGENT_NAMES,
  type AgentName,
  type AgentConfig,
  type AgentRecord,
} from './shared.js';
import {
  MockIdentityRegistryAbi,
  AgentRegistryAbi,
  SentinelGuardAbi,
  SafetyRulesAbi,
} from './abis.js';
import { SafetyRulesBytecode, SafetyRulesConstructorAbi } from './bytecode.js';
import chalk from 'chalk';

const GAS_BUDGET = parseEther('0.005');           // each agent EOA's gas float
const GUARD_DEPOSIT = parseEther('0.005');        // each agent's bankroll inside the guard
const MIN_AGENT_BALANCE = parseEther('0.002');    // top-up threshold

interface RulesProfile {
  maxDrawdownBps: bigint;
  maxTxPerHour: bigint;
  oracleDeviationBps: bigint;
  dailyVolumeCapUsd: bigint;
  timeOfDayMin: number;
  timeOfDayMax: number;
  allowedProtocols: Address[];
}

const log = (msg: string): void => console.log(chalk.gray(new Date().toISOString().slice(11, 19)) + ' ' + msg);
const ok = (msg: string): void => log(chalk.green('  ✓ ') + msg);
const info = (msg: string): void => log(chalk.cyan('  · ') + msg);

const rulesProfile = (
  name: AgentName,
  deployerAddress: Address,
): RulesProfile => {
  if (name === 'yieldchaser') {
    // Drawdown victim. Off-chain monitor's concern; on-chain evaluate sees value=0
    // and never fires for drawdown today. Still set a tight bps for when the
    // valuation feed lands.
    return {
      maxDrawdownBps: 1000n,            // 10%
      maxTxPerHour: 50n,
      oracleDeviationBps: 500n,
      dailyVolumeCapUsd: 100_000n * 10n ** 18n,
      timeOfDayMin: 0,
      timeOfDayMax: 23,
      allowedProtocols: [deployerAddress],
    };
  }
  if (name === 'protocolhopper') {
    // Allowlist victim. Allow the deployer as a "swap target"; the agent's
    // bad-path call hits a fresh address that is NOT in the allowlist.
    return {
      maxDrawdownBps: 5000n,            // permissive
      maxTxPerHour: 100n,
      oracleDeviationBps: 500n,
      dailyVolumeCapUsd: 100_000n * 10n ** 18n,
      timeOfDayMin: 0,
      timeOfDayMax: 23,
      allowedProtocols: [deployerAddress],
    };
  }
  // insomniac — operates noon to 10pm UTC; off-hours tx reverts on-chain.
  return {
    maxDrawdownBps: 5000n,
    maxTxPerHour: 100n,
    oracleDeviationBps: 500n,
    dailyVolumeCapUsd: 100_000n * 10n ** 18n,
    timeOfDayMin: 12,
    timeOfDayMax: 22,
    allowedProtocols: [deployerAddress],
  };
};

const deploySafetyRules = async (
  deployerKey: Hex,
  profile: RulesProfile,
): Promise<Address> => {
  const { account, client } = walletFromKey(deployerKey);
  const constructorArgs = encodeAbiParameters(SafetyRulesConstructorAbi, [
    account.address,
    profile.maxDrawdownBps,
    profile.maxTxPerHour,
    profile.oracleDeviationBps,
    profile.dailyVolumeCapUsd,
    profile.timeOfDayMin,
    profile.timeOfDayMax,
  ]);
  const initCode = (SafetyRulesBytecode + constructorArgs.slice(2)) as Hex;

  const hash = await client.deployContract({
    abi: [],
    account,
    chain: client.chain,
    bytecode: initCode,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error('SafetyRules deploy: no contractAddress in receipt');
  return getAddress(receipt.contractAddress);
};

const allowlistProtocols = async (
  deployerKey: Hex,
  rulesContract: Address,
  protocols: Address[],
): Promise<void> => {
  if (protocols.length === 0) return;
  const { account, client } = walletFromKey(deployerKey);
  const hash = await client.writeContract({
    address: rulesContract,
    abi: SafetyRulesAbi,
    functionName: 'allowProtocolsBatch',
    args: [protocols],
    account,
    chain: client.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
};

const mintIdentity = async (
  deployerKey: Hex,
  agentEoa: Address,
): Promise<bigint> => {
  const { account, client } = walletFromKey(deployerKey);
  const uri = `data:application/json;base64,${Buffer.from(
    JSON.stringify({
      name: `Sentinel Demo Agent ${agentEoa.slice(0, 8)}`,
      description: 'Intentionally misbehaving demo agent for Sentinel.',
      image: '',
    }),
  ).toString('base64')}`;

  const hash = await client.writeContract({
    address: DEPLOYMENTS.MockIdentityRegistry,
    abi: MockIdentityRegistryAbi,
    functionName: 'mint',
    args: [account.address, agentEoa, uri],
    account,
    chain: client.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Find Transfer(from=0x0, to=deployer, tokenId) — ERC-721 standard event.
  // topics[0] = keccak256("Transfer(address,address,uint256)"),
  // topics[3] = indexed tokenId.
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() === DEPLOYMENTS.MockIdentityRegistry.toLowerCase() &&
      log.topics[0] === TRANSFER_TOPIC &&
      log.topics[3]
    ) {
      return BigInt(log.topics[3]);
    }
  }
  throw new Error('mint: Transfer event not found in receipt');
};

const registerAgent = async (
  deployerKey: Hex,
  tokenId: bigint,
  rulesContract: Address,
): Promise<void> => {
  const { account, client } = walletFromKey(deployerKey);
  const hash = await client.writeContract({
    address: DEPLOYMENTS.AgentRegistry,
    abi: AgentRegistryAbi,
    functionName: 'register',
    args: [tokenId, rulesContract, DEPLOYMENTS.SentinelGuard],
    account,
    chain: client.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
};

const fundGuard = async (
  deployerKey: Hex,
  agent: Address,
  amount: bigint,
): Promise<void> => {
  const { account, client } = walletFromKey(deployerKey);
  const hash = await client.writeContract({
    address: DEPLOYMENTS.SentinelGuard,
    abi: SentinelGuardAbi,
    functionName: 'depositNativeForAgent',
    args: [agent],
    value: amount,
    account,
    chain: client.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
};

const topUpAgentEoa = async (
  deployerKey: Hex,
  agent: Address,
  budget: bigint,
): Promise<bigint> => {
  const balance = await publicClient.getBalance({ address: agent });
  if (balance >= MIN_AGENT_BALANCE) return balance;
  const { account, client } = walletFromKey(deployerKey);
  const hash = await client.sendTransaction({
    to: agent,
    value: budget,
    account,
    chain: client.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return budget;
};

const main = async (): Promise<void> => {
  const deployerKey = getDeployerKey();
  const { account: deployer } = walletFromKey(deployerKey);
  log(chalk.bold('SENTINEL · demo agent setup'));
  info(`Deployer ${deployer.address}`);

  const deployerBalance = await publicClient.getBalance({ address: deployer.address });
  info(`Deployer balance ${(Number(deployerBalance) / 1e18).toFixed(4)} MNT`);
  if (deployerBalance < parseEther('0.05')) {
    throw new Error('Deployer needs at least 0.05 MNT on Mantle Sepolia');
  }

  const keys = loadOrCreateKeys();
  const records: Partial<Record<AgentName, AgentRecord>> = {};

  for (const name of AGENT_NAMES) {
    log('');
    log(chalk.bold(`▸ ${name}`));
    const { account: agent } = walletFromKey(keys[name]);
    info(`EOA  ${agent.address}`);

    // 1. Top up the agent's gas wallet
    const agentBalance = await topUpAgentEoa(deployerKey, agent.address, GAS_BUDGET);
    info(`gas  ${(Number(agentBalance) / 1e18).toFixed(4)} MNT`);

    // 2. Skip mint+deploy+register if already guarded
    const guarded = (await publicClient.readContract({
      address: DEPLOYMENTS.AgentRegistry,
      abi: AgentRegistryAbi,
      functionName: 'isGuarded',
      args: [agent.address],
    })) as boolean;

    let rulesContract: Address;
    let tokenId: bigint;
    if (guarded) {
      info('already registered — skipping mint/deploy/register');
      // We can't recover tokenId/rulesContract from on-chain without a getter
      // call, so fall back to reading the config if present.
      // For simplicity assume re-setup means re-mint (would need a `pnpm reset`
      // to clear); here we just record placeholders the agent loops won't use.
      rulesContract = '0x0000000000000000000000000000000000000000';
      tokenId = 0n;
    } else {
      const profile = rulesProfile(name, deployer.address);

      info('deploying SafetyRules…');
      rulesContract = await deploySafetyRules(deployerKey, profile);
      ok(`SafetyRules ${rulesContract}`);

      if (profile.allowedProtocols.length > 0) {
        info(`allowlisting ${profile.allowedProtocols.length} protocol(s)…`);
        await allowlistProtocols(deployerKey, rulesContract, profile.allowedProtocols);
        ok('allowlist set');
      }

      info('minting ERC-8004 identity…');
      tokenId = await mintIdentity(deployerKey, agent.address);
      ok(`tokenId ${tokenId}`);

      info('registering with AgentRegistry…');
      await registerAgent(deployerKey, tokenId, rulesContract);
      ok('registered');
    }

    // 3. Fund the guard (always — repeated demos)
    info(`depositing ${(Number(GUARD_DEPOSIT) / 1e18).toFixed(4)} MNT into guard…`);
    await fundGuard(deployerKey, agent.address, GUARD_DEPOSIT);
    const guardBal = (await publicClient.readContract({
      address: DEPLOYMENTS.SentinelGuard,
      abi: SentinelGuardAbi,
      functionName: 'balanceOf',
      args: [agent.address, '0x0000000000000000000000000000000000000000'],
    })) as bigint;
    ok(`guard balance ${(Number(guardBal) / 1e18).toFixed(4)} MNT`);

    records[name] = {
      address: agent.address,
      tokenId: tokenId.toString(),
      rulesContract,
      registeredAt: Math.floor(Date.now() / 1000),
      fundedMnt: guardBal.toString(),
    };
  }

  const config: AgentConfig = {
    network: 'mantle-sepolia',
    chainId: 5003,
    setupAt: Math.floor(Date.now() / 1000),
    yieldchaser: records.yieldchaser!,
    protocolhopper: records.protocolhopper!,
    insomniac: records.insomniac!,
  };
  saveConfig(config);

  log('');
  log(chalk.green.bold('✓ SETUP COMPLETE'));
  info('agent-config.json written');
  info('next: pnpm agents:start');
};

main().catch((e) => {
  console.error(chalk.red('SETUP FAILED'));
  console.error(e);
  process.exit(1);
});
