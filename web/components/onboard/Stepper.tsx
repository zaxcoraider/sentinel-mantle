import { cn } from '@/lib/utils';

const STEPS = [
  { n: 1, label: 'Connect' },
  { n: 2, label: 'Agent' },
  { n: 3, label: 'Rules' },
  { n: 4, label: 'Deposit' },
  { n: 5, label: 'Confirm' },
  { n: 6, label: 'Done' },
];

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Onboarding steps" className="mb-8">
      <ol className="flex items-center">
        {STEPS.map(({ n, label }, i) => {
          const done = current > n;
          const active = current === n;
          return (
            <li key={n} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs transition-all duration-300',
                    done && 'bg-sentinel-blue border-sentinel-blue text-white',
                    active && 'border-sentinel-cyan text-sentinel-cyan shadow-glow-cyan bg-sentinel-cyan/5',
                    !done && !active && 'border-sentinel-gray-2 text-sentinel-gray-1',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? '✓' : n}
                </div>
                <span
                  className={cn(
                    'font-mono text-[10px] tracking-wide hidden sm:block transition-colors',
                    active ? 'text-sentinel-cyan' : done ? 'text-sentinel-gray-1' : 'text-sentinel-gray-1/60',
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-2 mb-4 bg-sentinel-gray-2 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      done ? 'w-full bg-sentinel-blue' : 'w-0 bg-sentinel-blue',
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
