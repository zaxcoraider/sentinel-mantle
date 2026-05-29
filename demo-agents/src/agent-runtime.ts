// Shared agent runtime: a function that calls SentinelGuard.executeAsAgent
// from a given agent EOA, against a target with given value+data. Handles
// gas estimation, awaiting confirmation, and friendly revert decoding.

import { type Address, type Hex } from 'viem';
import {
  publicClient,
  walletFromKey,
  loadKeys,
  loadConfig,
  DEPLOYMENTS,
  NATIVE_TOKEN,
  friendlyRevert,
  type AgentName,
} from './shared.js';
import { SentinelGuardAbi } from './abis.js';

export interface ExecResult {
  ok: boolean;
  hash?: Hex;
  reason?: string;
  paused?: boolean;
}

export const execAsAgent = async (
  name: AgentName,
  target: Address,
  value: bigint,
  data: Hex = '0x',
): Promise<ExecResult> => {
  const keys = loadKeys();
  const { account, client } = walletFromKey(keys[name]);

  // Pre-flight: skip if circuit breaker tripped
  const paused = (await publicClient.readContract({
    address: DEPLOYMENTS.SentinelGuard,
    abi: SentinelGuardAbi,
    functionName: 'isPaused',
    args: [account.address],
  })) as boolean;
  if (paused) return { ok: false, reason: 'AgentIsPaused', paused: true };

  try {
    const hash = await client.writeContract({
      address: DEPLOYMENTS.SentinelGuard,
      abi: SentinelGuardAbi,
      functionName: 'executeAsAgent',
      args: [target, data, value],
      account,
      chain: client.chain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') return { ok: false, hash, reason: 'tx reverted' };
    return { ok: true, hash };
  } catch (e) {
    return { ok: false, reason: friendlyRevert(e) };
  }
};

export const guardBalance = async (agent: Address): Promise<bigint> => {
  return (await publicClient.readContract({
    address: DEPLOYMENTS.SentinelGuard,
    abi: SentinelGuardAbi,
    functionName: 'balanceOf',
    args: [agent, NATIVE_TOKEN],
  })) as bigint;
};

export const agentAddressOf = (name: AgentName): Address => {
  const cfg = loadConfig();
  return cfg[name].address;
};
