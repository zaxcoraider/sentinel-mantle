'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOnboardStore, type SafetyRulesForm } from '@/lib/store/onboard-store';
import { cn } from '@/lib/utils';

const COMMON_PROTOCOLS = [
  { label: 'Merchant Moe', address: '0x0000000000000000000000000000000000000001' },
  { label: 'Agni Finance', address: '0x0000000000000000000000000000000000000002' },
  { label: 'FusionX', address: '0x0000000000000000000000000000000000000003' },
];

const schema = z
  .object({
    maxDrawdownBps: z.number().int().min(1).max(10000),
    maxTxPerHour: z.number().int().min(1).max(1000),
    oracleDeviationBps: z.number().int().min(1).max(5000),
    dailyVolumeCapUsd: z.number().int().min(100),
    timeOfDayMin: z.number().int().min(0).max(23),
    timeOfDayMax: z.number().int().min(0).max(23),
    allowedProtocols: z.array(z.string()),
  })
  .refine((d) => d.timeOfDayMin < d.timeOfDayMax, {
    message: 'Start hour must be before end hour',
    path: ['timeOfDayMax'],
  });

function RuleField({
  label,
  helper,
  children,
  error,
}: {
  label: string;
  helper: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2 py-3 border-b border-sentinel-gray-2 last:border-b-0">
      <div>
        <p className="font-mono text-sm text-sentinel-white">{label}</p>
        <p className="font-mono text-xs text-sentinel-gray-1 mt-0.5">{helper}</p>
        {error && <p className="font-mono text-xs text-sentinel-danger mt-1">{error}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function Step3Rules() {
  const store = useOnboardStore();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SafetyRulesForm>({
    resolver: zodResolver(schema),
    defaultValues: store.rules,
  });

  const protocols = watch('allowedProtocols');

  const toggleProtocol = (addr: string) => {
    const current = protocols ?? [];
    const next = current.includes(addr) ? current.filter((a) => a !== addr) : [...current, addr];
    setValue('allowedProtocols', next);
  };

  const onSubmit = (data: SafetyRulesForm) => {
    store.patchRules(data);
    store.setStep(4);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div>
        <h2 className="font-mono font-bold text-lg text-sentinel-white">
          Configure safety rules
        </h2>
        <p className="mt-1 text-sm text-sentinel-gray-1">
          These rules are deployed on-chain as your agent's SafetyRules contract.
        </p>
      </div>

      <div className="border border-sentinel-gray-2 px-4">
        <RuleField
          label="Max drawdown"
          helper="Pause if value drops by more than this %"
          error={errors.maxDrawdownBps?.message}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              min="1"
              max="10000"
              {...register('maxDrawdownBps', { valueAsNumber: true })}
              className="w-20 font-mono text-sm bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-2 py-1 outline-none text-sentinel-white"
            />
            <span className="font-mono text-xs text-sentinel-gray-1">bps (100 = 1%)</span>
          </div>
        </RuleField>

        <RuleField
          label="Max tx / hour"
          helper="Rate cap — pause if agent fires more transactions"
          error={errors.maxTxPerHour?.message}
        >
          <input
            type="number"
            step="1"
            min="1"
            max="1000"
            {...register('maxTxPerHour', { valueAsNumber: true })}
            className="w-20 font-mono text-sm bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-2 py-1 outline-none text-sentinel-white"
          />
        </RuleField>

        <RuleField
          label="Oracle deviation"
          helper="Pause if price feed deviates from last on-chain price by this %"
          error={errors.oracleDeviationBps?.message}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              min="1"
              max="5000"
              {...register('oracleDeviationBps', { valueAsNumber: true })}
              className="w-20 font-mono text-sm bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-2 py-1 outline-none text-sentinel-white"
            />
            <span className="font-mono text-xs text-sentinel-gray-1">bps</span>
          </div>
        </RuleField>

        <RuleField
          label="Daily volume cap"
          helper="Pause if agent moves more than this in USD per 24h"
          error={errors.dailyVolumeCapUsd?.message}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-sentinel-gray-1">$</span>
            <input
              type="number"
              step="100"
              min="100"
              {...register('dailyVolumeCapUsd', { valueAsNumber: true })}
              className="w-28 font-mono text-sm bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-2 py-1 outline-none text-sentinel-white"
            />
          </div>
        </RuleField>

        <RuleField
          label="Active hours (UTC)"
          helper="Off-hours activity triggers a warning (not a pause)"
          error={errors.timeOfDayMax?.message}
        >
          <div className="flex items-center gap-2 font-mono text-sm">
            <input
              type="number"
              min="0"
              max="23"
              {...register('timeOfDayMin', { valueAsNumber: true })}
              className="w-14 bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-2 py-1 outline-none text-sentinel-white"
            />
            <span className="text-sentinel-gray-1">–</span>
            <input
              type="number"
              min="0"
              max="23"
              {...register('timeOfDayMax', { valueAsNumber: true })}
              className="w-14 bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-2 py-1 outline-none text-sentinel-white"
            />
            <span className="text-xs text-sentinel-gray-1">UTC</span>
          </div>
        </RuleField>

        <RuleField label="Allowed protocols" helper="Only these contracts may be called">
          <div className="space-y-2">
            {COMMON_PROTOCOLS.map((p) => (
              <label
                key={p.address}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(protocols ?? []).includes(p.address)}
                  onChange={() => toggleProtocol(p.address)}
                  className="accent-sentinel-blue"
                />
                <span className="font-mono text-xs text-sentinel-white">{p.label}</span>
              </label>
            ))}
            <p className="font-mono text-xs text-sentinel-gray-1">
              {(protocols ?? []).length} selected
            </p>
          </div>
        </RuleField>
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => store.setStep(2)}
          className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
        >
          ← Back
        </button>
        <button
          type="submit"
          className={cn(
            'font-mono text-xs px-6 py-2',
            'border border-sentinel-blue text-sentinel-blue',
            'hover:bg-sentinel-blue hover:text-white transition-colors',
          )}
        >
          Continue →
        </button>
      </div>
    </form>
  );
}
