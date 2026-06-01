'use client';

import { useState } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import type { Address, Hex } from 'viem';
import {
  SafetyRulesAbi,
  SafetyRulesBytecode,
  AgentRegistryAbi,
  SentinelGuardAbi,
} from '@/lib/contracts';
import { NETWORKS } from '@/lib/networks';
import { useClientNet } from '@/lib/hooks/use-client-net';
import { useOnboardStore } from '@/lib/store/onboard-store';
import { friendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';

type TxPhase =
  | 'idle'
  | 'deploying-rules'
  | 'setting-protocols'
  | 'registering'
  | 'approving'
  | 'depositing'
  | 'done'
  | 'error';

function PhaseRow({ phase, current, label }: { phase: TxPhase; current: TxPhase; label: string }) {
  const phases: TxPhase[] = ['deploying-rules', 'setting-protocols', 'registering', 'approving', 'depositing', 'done'];
  const idx = phases.indexOf(phase);
  const curIdx = phases.indexOf(current);
  const done = curIdx > idx;
  const active = current === phase;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={cn(
        'font-mono text-xs w-4',
        done && 'text-emerald-400',
        active && 'text-sentinel-cyan glow-blue animate-pulse',
        !done && !active && 'text-sentinel-gray-1',
      )}>
        {done ? '✓' : active ? '●' : '○'}
      </span>
      <span className={cn(
        'font-mono text-xs',
        active ? 'text-sentinel-white' : done ? 'text-emerald-400' : 'text-sentinel-gray-1',
      )}>
        {label}
      </span>
    </div>
  );
}

export function Step5Confirm() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const store = useOnboardStore();
  const net = useClientNet();
  const NET = NETWORKS[net].deployments;

  const [phase, setPhase] = useState<TxPhase>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const { rules, deposit, selectedTokenId, selectedAgent } = store;

  const hasDeposit = !!deposit.amount && parseFloat(deposit.amount) > 0;
  const isERC20Deposit = hasDeposit && deposit.token !== 'NATIVE';

  const run = async () => {
    if (!walletClient || !publicClient || !address || !selectedAgent || !selectedTokenId) return;
    setErrorMsg('');

    try {
      // 1. Deploy SafetyRules
      setPhase('deploying-rules');
      const rulesHash = await walletClient.deployContract({
        abi: SafetyRulesAbi,
        bytecode: SafetyRulesBytecode as Hex,
        args: [
          address,
          BigInt(rules.maxDrawdownBps),
          BigInt(rules.maxTxPerHour),
          BigInt(rules.oracleDeviationBps),
          BigInt(rules.dailyVolumeCapUsd),
          rules.timeOfDayMin,
          rules.timeOfDayMax,
        ],
      });
      const rulesReceipt = await publicClient.waitForTransactionReceipt({ hash: rulesHash });
      const rulesAddress = rulesReceipt.contractAddress;
      if (!rulesAddress) throw new Error('SafetyRules deployment failed — no contract address.');
      store.setDeployedRules(rulesAddress);

      // 2. Set allowed protocols (if any)
      if (rules.allowedProtocols.length > 0) {
        setPhase('setting-protocols');
        const protoHash = await walletClient.writeContract({
          address: rulesAddress,
          abi: SafetyRulesAbi,
          functionName: 'allowProtocolsBatch',
          args: [rules.allowedProtocols as Address[]],
        });
        await publicClient.waitForTransactionReceipt({ hash: protoHash });
      }

      // 3. Register with AgentRegistry
      setPhase('registering');
      const regHash = await walletClient.writeContract({
        address: NET.AgentRegistry,
        abi: AgentRegistryAbi,
        functionName: 'register',
        args: [BigInt(selectedTokenId), rulesAddress, NET.SentinelGuard],
      });
      await publicClient.waitForTransactionReceipt({ hash: regHash });
      store.setRegisteredTx(regHash);

      // 4. Deposit (optional)
      if (hasDeposit) {
        const amountWei = parseUnits(deposit.amount, 18);

        if (isERC20Deposit) {
          setPhase('approving');
          const approveHash = await walletClient.writeContract({
            address: deposit.token as Address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [NET.SentinelGuard, amountWei],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });

          setPhase('depositing');
          const depositHash = await walletClient.writeContract({
            address: NET.SentinelGuard,
            abi: SentinelGuardAbi,
            functionName: 'depositForAgent',
            args: [selectedAgent, deposit.token as Address, amountWei],
          });
          await publicClient.waitForTransactionReceipt({ hash: depositHash });
        } else {
          setPhase('depositing');
          const depositHash = await walletClient.writeContract({
            address: NET.SentinelGuard,
            abi: SentinelGuardAbi,
            functionName: 'depositNativeForAgent',
            args: [selectedAgent],
            value: amountWei,
          });
          await publicClient.waitForTransactionReceipt({ hash: depositHash });
        }
      }

      setPhase('done');
      store.setStep(6);
    } catch (e) {
      setPhase('error');
      setErrorMsg(friendlyError(e));
    }
  };

  const running = phase !== 'idle' && phase !== 'done' && phase !== 'error';

  return (
    <div className="space-y-6 py-4">
      <div>
        <h2 className="font-sans font-bold text-xl text-sentinel-white">
          Review and confirm
        </h2>
        <p className="mt-1 text-sm text-sentinel-gray-1">
          This will deploy your SafetyRules contract and register the agent.
        </p>
      </div>

      {/* Summary */}
      <div className="surface p-4 space-y-2 font-mono text-xs">
        <div className="flex justify-between text-sentinel-gray-1">
          <span>Agent</span>
          <span className="text-sentinel-white truncate max-w-[240px]">{selectedAgent ?? '—'}</span>
        </div>
        <div className="flex justify-between text-sentinel-gray-1">
          <span>Max drawdown</span>
          <span className="text-sentinel-white">{rules.maxDrawdownBps / 100}%</span>
        </div>
        <div className="flex justify-between text-sentinel-gray-1">
          <span>Max tx/hour</span>
          <span className="text-sentinel-white">{rules.maxTxPerHour}</span>
        </div>
        <div className="flex justify-between text-sentinel-gray-1">
          <span>Oracle deviation</span>
          <span className="text-sentinel-white">{rules.oracleDeviationBps / 100}%</span>
        </div>
        <div className="flex justify-between text-sentinel-gray-1">
          <span>Daily volume cap</span>
          <span className="text-sentinel-white">${rules.dailyVolumeCapUsd.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sentinel-gray-1">
          <span>Active hours (UTC)</span>
          <span className="text-sentinel-white">{rules.timeOfDayMin}:00 – {rules.timeOfDayMax}:00</span>
        </div>
        <div className="flex justify-between text-sentinel-gray-1">
          <span>Protocols</span>
          <span className="text-sentinel-white">{rules.allowedProtocols.length} selected</span>
        </div>
        {hasDeposit && (
          <div className="flex justify-between text-sentinel-gray-1 border-t border-sentinel-gray-2 pt-2">
            <span>Deposit</span>
            <span className="text-sentinel-white">
              {deposit.amount} {deposit.token === 'NATIVE' ? 'MNT' : deposit.token.slice(0, 6) + '…'}
            </span>
          </div>
        )}
      </div>

      {/* Transaction progress */}
      {phase !== 'idle' && (
        <div className="surface p-4 scanlines">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-sentinel-gray-1 mb-3">Transactions</p>
          <PhaseRow phase="deploying-rules" current={phase} label="Deploy SafetyRules contract" />
          {rules.allowedProtocols.length > 0 && (
            <PhaseRow phase="setting-protocols" current={phase} label="Set allowed protocols" />
          )}
          <PhaseRow phase="registering" current={phase} label="Register with AgentRegistry" />
          {hasDeposit && isERC20Deposit && (
            <PhaseRow phase="approving" current={phase} label="Approve token spend" />
          )}
          {hasDeposit && (
            <PhaseRow phase="depositing" current={phase} label={`Deposit ${deposit.amount} ${deposit.token === 'NATIVE' ? 'MNT' : 'tokens'}`} />
          )}
        </div>
      )}

      {errorMsg && (
        <p className="font-mono text-xs text-sentinel-danger border border-sentinel-danger/30 px-4 py-2">
          {errorMsg}
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => store.setStep(4)}
          disabled={running}
          className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors disabled:opacity-30"
        >
          ← Back
        </button>
        <button
          onClick={run}
          disabled={running}
          className={cn(
            'font-mono text-xs tracking-widest uppercase px-7 py-2.5 transition-all',
            'text-sentinel-white bg-sentinel-blue/90 border border-sentinel-blue shadow-glow',
            'hover:bg-sentinel-blue hover:shadow-glow-cyan',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
          )}
        >
          {running ? 'Processing…' : 'Activate Sentinel ▸'}
        </button>
      </div>
    </div>
  );
}
