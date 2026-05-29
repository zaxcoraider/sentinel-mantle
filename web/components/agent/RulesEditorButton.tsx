'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address } from 'viem';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SafetyRulesAbi } from '@/lib/contracts';
import type { SafetyRulesConfig } from '@/lib/agent-data';

interface Props {
  rulesAddress: Address;
  owner: Address;
  rules: SafetyRulesConfig;
}

type SetterKey = 'drawdown' | 'txph' | 'oracle' | 'volume' | 'window';

const SETTER_LABEL: Record<SetterKey, string> = {
  drawdown: 'Max drawdown',
  txph: 'Max tx/hour',
  oracle: 'Oracle deviation',
  volume: 'Daily volume cap',
  window: 'Active hours',
};

export function RulesEditorButton({ rulesAddress, owner, rules }: Props) {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);

  const isOwner =
    isConnected && address && address.toLowerCase() === owner.toLowerCase();

  if (!isOwner) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="font-mono text-xs px-3 py-1.5 border border-sentinel-blue text-sentinel-blue hover:bg-sentinel-blue hover:text-white transition-colors">
          Manage
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Safety Rules</DialogTitle>
          <DialogDescription>
            Owner-only. Each change is a separate transaction.
          </DialogDescription>
        </DialogHeader>
        <RulesForm
          rulesAddress={rulesAddress}
          rules={rules}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function RulesForm({
  rulesAddress,
  rules,
  onDone,
}: {
  rulesAddress: Address;
  rules: SafetyRulesConfig;
  onDone: () => void;
}) {
  const [drawdownPct, setDrawdownPct] = useState(
    (Number(rules.maxDrawdownBps) / 100).toString(),
  );
  const [txph, setTxph] = useState(rules.maxTxPerHour.toString());
  const [oraclePct, setOraclePct] = useState(
    (Number(rules.oracleDeviationBps) / 100).toString(),
  );
  const [volume, setVolume] = useState(rules.dailyVolumeCapUsd.toString());
  const [hourMin, setHourMin] = useState(rules.timeOfDayMin.toString());
  const [hourMax, setHourMax] = useState(rules.timeOfDayMax.toString());

  const [active, setActive] = useState<SetterKey | null>(null);
  const { writeContractAsync } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash: pendingHash });
  const [error, setError] = useState<string | null>(null);

  const update = async (key: SetterKey) => {
    setError(null);
    setActive(key);
    try {
      let hash: `0x${string}`;
      if (key === 'drawdown') {
        const bps = BigInt(Math.round(parseFloat(drawdownPct) * 100));
        if (bps > BigInt(10000)) throw new Error('Max 100%');
        hash = await writeContractAsync({
          address: rulesAddress,
          abi: SafetyRulesAbi,
          functionName: 'setMaxDrawdown',
          args: [bps],
        });
      } else if (key === 'txph') {
        hash = await writeContractAsync({
          address: rulesAddress,
          abi: SafetyRulesAbi,
          functionName: 'setMaxTxPerHour',
          args: [BigInt(txph)],
        });
      } else if (key === 'oracle') {
        const bps = BigInt(Math.round(parseFloat(oraclePct) * 100));
        if (bps > BigInt(10000)) throw new Error('Max 100%');
        hash = await writeContractAsync({
          address: rulesAddress,
          abi: SafetyRulesAbi,
          functionName: 'setOracleDeviation',
          args: [bps],
        });
      } else if (key === 'volume') {
        hash = await writeContractAsync({
          address: rulesAddress,
          abi: SafetyRulesAbi,
          functionName: 'setDailyVolumeCap',
          args: [BigInt(volume)],
        });
      } else {
        const min = parseInt(hourMin, 10);
        const max = parseInt(hourMax, 10);
        if (min < 0 || min > 23 || max < 0 || max > 23) throw new Error('Hours 0-23');
        hash = await writeContractAsync({
          address: rulesAddress,
          abi: SafetyRulesAbi,
          functionName: 'setTimeWindow',
          args: [min, max],
        });
      }
      setPendingHash(hash);
    } catch (e) {
      setError(friendlyError(e));
      setActive(null);
    }
  };

  return (
    <div className="space-y-3">
      <Field
        label="Max drawdown (%)"
        value={drawdownPct}
        onChange={setDrawdownPct}
        onSave={() => update('drawdown')}
        loading={active === 'drawdown'}
      />
      <Field
        label="Max tx / hour"
        value={txph}
        onChange={setTxph}
        onSave={() => update('txph')}
        loading={active === 'txph'}
      />
      <Field
        label="Oracle deviation (%)"
        value={oraclePct}
        onChange={setOraclePct}
        onSave={() => update('oracle')}
        loading={active === 'oracle'}
      />
      <Field
        label="Daily volume cap (USD)"
        value={volume}
        onChange={setVolume}
        onSave={() => update('volume')}
        loading={active === 'volume'}
      />
      <div className="border border-sentinel-gray-2 p-3 space-y-2">
        <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase">
          Active hours (UTC, 0–23)
        </span>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={0}
            max={23}
            value={hourMin}
            onChange={(e) => setHourMin(e.target.value)}
            className="w-16 font-mono text-xs bg-sentinel-black border border-sentinel-gray-2 px-2 py-1 text-sentinel-white"
          />
          <span className="font-mono text-xs text-sentinel-gray-1">–</span>
          <input
            type="number"
            min={0}
            max={23}
            value={hourMax}
            onChange={(e) => setHourMax(e.target.value)}
            className="w-16 font-mono text-xs bg-sentinel-black border border-sentinel-gray-2 px-2 py-1 text-sentinel-white"
          />
          <button
            onClick={() => update('window')}
            disabled={active === 'window' || confirming}
            className="ml-auto font-mono text-xs px-3 py-1 border border-sentinel-blue text-sentinel-blue hover:bg-sentinel-blue hover:text-white transition-colors disabled:opacity-50"
          >
            {active === 'window' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <p className="font-mono text-xs text-sentinel-danger">{error}</p>
      )}
      {pendingHash && active && (
        <p className="font-mono text-[10px] text-sentinel-gray-1">
          {confirming ? `Confirming ${SETTER_LABEL[active]}…` : `${SETTER_LABEL[active]} updated.`}
        </p>
      )}
      <button
        onClick={onDone}
        className="font-mono text-xs px-3 py-1.5 border border-sentinel-gray-2 text-sentinel-gray-1 hover:text-sentinel-white hover:border-sentinel-white transition-colors w-full mt-2"
      >
        Done
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onSave,
  loading,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  loading: boolean;
}) {
  return (
    <div className="border border-sentinel-gray-2 p-3 space-y-2">
      <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase">{label}</span>
      <div className="flex gap-2 items-center">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-xs bg-sentinel-black border border-sentinel-gray-2 px-2 py-1 text-sentinel-white"
        />
        <button
          onClick={onSave}
          disabled={loading}
          className="font-mono text-xs px-3 py-1 border border-sentinel-blue text-sentinel-blue hover:bg-sentinel-blue hover:text-white transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('User rejected') || msg.includes('User denied')) return 'Cancelled.';
  if (msg.includes('OwnableUnauthorizedAccount')) return 'You are not the owner of this rules contract.';
  if (msg.includes('InvalidBps')) return 'Value must be ≤ 100%.';
  if (msg.includes('InvalidHour')) return 'Hour must be between 0 and 23.';
  if (msg.includes('InvalidTimeWindow')) return 'Invalid time window.';
  if (msg.includes('ZeroValue')) return 'Value cannot be zero.';
  return msg.split('\n')[0].slice(0, 120);
}
