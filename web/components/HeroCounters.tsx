'use client';

import { StatCounter } from './StatCounter';

interface Props {
  agentCount: number;
  tvlUsd: number;
  breakerCount: number;
}

export function HeroCounters({ agentCount, tvlUsd, breakerCount }: Props) {
  return (
    <div className="grid grid-cols-3 gap-8 md:gap-16 py-8">
      <StatCounter
        value={agentCount}
        label="Agents Guarded"
      />
      <StatCounter
        value={tvlUsd}
        label="Value Locked"
        prefix="$"
      />
      <StatCounter
        value={breakerCount}
        label="Breakers Tripped"
      />
    </div>
  );
}
