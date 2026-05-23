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
}

export function StatCounter({
  value,
  label,
  prefix,
  suffix,
  decimals,
  className,
}: Props) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="font-mono text-[56px] leading-none font-bold text-sentinel-white tabular-nums">
        <CountUp
          end={value}
          duration={1.5}
          separator=","
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          useEasing
        />
      </span>
      <span className="font-mono text-xs tracking-widest uppercase text-sentinel-gray-1">
        {label}
      </span>
    </div>
  );
}
