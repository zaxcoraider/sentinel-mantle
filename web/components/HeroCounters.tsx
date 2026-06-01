'use client';

import { StatCounter } from './StatCounter';

interface Props {
  agentCount: number;
  tvlMnt: number;
  breakerCount: number;
}

export function HeroCounters({ agentCount, tvlMnt, breakerCount }: Props) {
  // Show more precision for small demo balances so it never reads as a flat 0.
  const tvlDecimals = tvlMnt > 0 && tvlMnt < 1 ? 3 : tvlMnt < 1000 ? 2 : 0;
  return (
    <div className="grid grid-cols-3 gap-px bg-sentinel-gray-2 border border-sentinel-gray-2">
      <div className="surface p-5 md:p-6">
        <StatCounter value={agentCount} label="Agents Guarded" />
      </div>
      <div className="surface p-5 md:p-6">
        <StatCounter value={tvlMnt} label="MNT Protected" decimals={tvlDecimals} tone="cyan" />
      </div>
      <div className="surface p-5 md:p-6">
        <StatCounter value={breakerCount} label="Breakers Tripped" tone="danger" />
      </div>
    </div>
  );
}
