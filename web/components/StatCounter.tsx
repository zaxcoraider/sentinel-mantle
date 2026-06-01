'use client';

import CountUp from 'react-countup';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  tone?: 'default' | 'cyan' | 'danger';
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-sentinel-white',
  cyan: 'text-sentinel-cyan glow-blue',
  danger: 'text-sentinel-danger',
};

export function StatCounter({
  value,
  label,
  prefix,
  suffix,
  decimals,
  className,
  tone = 'default',
}: Props) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span
        className={cn(
          'font-mono text-[44px] md:text-[56px] leading-none font-bold tabular-nums',
          TONE[tone],
        )}
      >
        <CountUp
          end={value}
          duration={1.6}
          separator=","
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          useEasing
        />
      </span>
      <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-sentinel-gray-1">
        {label}
      </span>
    </div>
  );
}
