'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOnboardStore, type DepositForm } from '@/lib/store/onboard-store';
import { cn } from '@/lib/utils';

const TOKENS = [
  { id: 'NATIVE', label: 'MNT (native)', decimals: 18 },
  { id: '0xcDA86A272531e8640cD7F1a92c01839911B90bb0', label: 'mETH', decimals: 18 },
  { id: '0x5bE26527e817998A7206475496fDE1E68957c5A6', label: 'USDY', decimals: 18 },
  { id: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34', label: 'USDe', decimals: 18 },
];

const schema = z.object({
  token: z.string(),
  amount: z
    .string()
    .refine((v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), {
      message: 'Enter a positive amount or leave blank to skip',
    }),
});

export function Step4Deposit() {
  const store = useOnboardStore();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<DepositForm>({
    resolver: zodResolver(schema),
    defaultValues: store.deposit,
  });

  const token = watch('token');

  const onSubmit = (data: DepositForm) => {
    store.setDeposit(data);
    store.setStep(5);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
      <div>
        <h2 className="font-mono font-bold text-lg text-sentinel-white">
          Deposit funds
        </h2>
        <p className="mt-1 text-sm text-sentinel-gray-1">
          The guard holds these funds on behalf of your agent. You can skip and
          deposit later.
        </p>
      </div>

      <div className="border border-sentinel-gray-2 p-4 space-y-4">
        <div>
          <label className="font-mono text-xs text-sentinel-gray-1 block mb-2">Token</label>
          <select
            {...register('token')}
            className="w-full font-mono text-sm bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-3 py-2 outline-none text-sentinel-white"
          >
            {TOKENS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-mono text-xs text-sentinel-gray-1 block mb-2">
            Amount{' '}
            <span className="opacity-60">
              ({TOKENS.find((t) => t.id === token)?.label ?? 'MNT'})
            </span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0  (leave blank to skip)"
            {...register('amount')}
            className="w-full font-mono text-sm bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-3 py-2 outline-none text-sentinel-white placeholder:text-sentinel-gray-1"
          />
          {errors.amount && (
            <p className="font-mono text-xs text-sentinel-danger mt-1">
              {errors.amount.message}
            </p>
          )}
        </div>

        <p className="font-mono text-xs text-sentinel-gray-1">
          ERC-20 deposits require two transactions: approve → deposit. Native MNT
          is a single transaction.
        </p>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => store.setStep(3)}
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
