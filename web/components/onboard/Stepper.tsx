import { cn } from '@/lib/utils';

const STEPS = [
  { n: 1, label: 'Connect' },
  { n: 2, label: 'Select Agent' },
  { n: 3, label: 'Rules' },
  { n: 4, label: 'Deposit' },
  { n: 5, label: 'Confirm' },
  { n: 6, label: 'Done' },
];

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Onboarding steps" className="mb-8">
      <ol className="flex items-center gap-0">
        {STEPS.map(({ n, label }, i) => {
          const done = current > n;
          const active = current === n;
          return (
            <li key={n} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full border flex items-center justify-center font-mono text-xs transition-colors',
                    done && 'bg-sentinel-blue border-sentinel-blue text-white',
                    active && 'border-sentinel-blue text-sentinel-blue',
                    !done && !active && 'border-sentinel-gray-2 text-sentinel-gray-1',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? '✓' : n}
                </div>
                <span
                  className={cn(
                    'font-mono text-[10px] tracking-wide hidden sm:block',
                    active ? 'text-sentinel-white' : 'text-sentinel-gray-1',
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-px w-8 md:w-14 mx-1 mb-4',
                    current > n ? 'bg-sentinel-blue' : 'bg-sentinel-gray-2',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
