'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// A looping, self-contained dramatization of the Sentinel protection arc.
// Pure presentational motion — no chain data — so the hero always feels alive.

type Phase = 'monitor' | 'anomaly' | 'breaker' | 'rescued';

const SEQUENCE: { phase: Phase; ms: number }[] = [
  { phase: 'monitor', ms: 2600 },
  { phase: 'anomaly', ms: 1800 },
  { phase: 'breaker', ms: 2200 },
  { phase: 'rescued', ms: 2400 },
];

const COPY: Record<Phase, { status: string; detail: string; tone: string; meter: number }> = {
  monitor: {
    status: 'MONITORING',
    detail: 'yieldchaser.eth · executing within limits',
    tone: 'text-emerald-400',
    meter: 32,
  },
  anomaly: {
    status: 'ANOMALY DETECTED',
    detail: 'drawdown -8.2% · approaching max',
    tone: 'text-amber-400',
    meter: 78,
  },
  breaker: {
    status: 'CIRCUIT BREAKER FIRED',
    detail: 'agent paused · reason MAX_DRAWDOWN',
    tone: 'text-sentinel-danger',
    meter: 100,
  },
  rescued: {
    status: 'FUNDS RESCUED',
    detail: 'routed → time-locked EmergencyVault',
    tone: 'text-sentinel-cyan',
    meter: 100,
  },
};

const NODES = ['AGENT', 'SENTINEL GUARD', 'EMERGENCY VAULT'] as const;

export function BreakerVisual() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const { ms } = SEQUENCE[idx];
    const t = setTimeout(() => setIdx((i) => (i + 1) % SEQUENCE.length), ms);
    return () => clearTimeout(t);
  }, [idx]);

  const phase = SEQUENCE[idx].phase;
  const c = COPY[phase];
  const fired = phase === 'breaker';
  const rescued = phase === 'rescued';

  // Which pipeline node is "active"
  const activeNode = phase === 'rescued' ? 2 : phase === 'monitor' ? 0 : 1;

  return (
    <div
      className={cn(
        'surface scanlines w-full max-w-md p-5 font-mono transition-shadow duration-300',
        fired && 'glow-box-danger',
        !fired && 'shadow-glow',
      )}
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-sentinel-gray-2 pb-3">
        <span className="text-[11px] tracking-[0.18em] uppercase text-sentinel-gray-1">
          Sentinel · Monitor
        </span>
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping-ring" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] text-emerald-400">live</span>
        </span>
      </div>

      {/* pipeline */}
      <div className="mt-4 space-y-0">
        {NODES.map((node, i) => {
          const isActive = i === activeNode;
          const isVaultRescued = i === 2 && rescued;
          return (
            <div key={node}>
              <div
                className={cn(
                  'flex items-center justify-between border px-3 py-2 text-xs transition-all duration-300',
                  isActive
                    ? fired && i === 1
                      ? 'border-sentinel-danger/60 bg-sentinel-danger/10 text-sentinel-danger'
                      : isVaultRescued
                        ? 'border-sentinel-cyan/60 bg-sentinel-cyan/10 text-sentinel-cyan'
                        : 'border-sentinel-blue/50 bg-sentinel-blue/10 text-sentinel-white'
                    : 'border-sentinel-gray-2 text-sentinel-gray-1',
                )}
              >
                <span className="tracking-wide">{node}</span>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-colors',
                    isActive
                      ? fired && i === 1
                        ? 'bg-sentinel-danger'
                        : isVaultRescued
                          ? 'bg-sentinel-cyan'
                          : 'bg-sentinel-blue'
                      : 'bg-sentinel-gray-2',
                  )}
                />
              </div>
              {i < NODES.length - 1 && (
                <div className="flex justify-start pl-5 py-0.5">
                  <span
                    className={cn(
                      'text-sentinel-gray-2 transition-colors duration-300',
                      ((i === 0 && activeNode >= 1) || (i === 1 && rescued)) &&
                        (fired ? 'text-sentinel-danger' : rescued ? 'text-sentinel-cyan' : 'text-sentinel-blue'),
                    )}
                  >
                    ↓
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* status readout */}
      <div className="mt-4 border border-sentinel-gray-2 bg-black/40 px-3 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-bold tracking-wide', c.tone, fired && 'animate-pulse')}>
            {fired && '⚡ '}
            {c.status}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-sentinel-gray-1">{c.detail}</p>

        {/* drawdown meter */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-sentinel-gray-1">
            <span>DRAWDOWN</span>
            <span className={c.tone}>{phase === 'monitor' ? '-2.6%' : '-8.2%'}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden bg-sentinel-gray-2">
            <div
              className={cn(
                'h-full transition-all duration-700 ease-out',
                fired || rescued ? 'bg-sentinel-danger' : phase === 'anomaly' ? 'bg-amber-400' : 'bg-emerald-400',
              )}
              style={{ width: `${c.meter}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
