'use client';

import { cn } from '@/lib/utils';
import type { WatchEvent } from '@/lib/hooks/use-watch-events';

const EVENT_META = {
  agent_registered: { label: 'REGISTERED', color: 'text-sentinel-blue', spine: 'bg-sentinel-blue', bg: 'bg-sentinel-blue/[0.04]' },
  agent_deregistered: { label: 'DEREGISTERED', color: 'text-sentinel-gray-1', spine: 'bg-sentinel-gray-2', bg: '' },
  agent_tx: { label: 'AGENT TX', color: 'text-sentinel-gray-1', spine: 'bg-sentinel-gray-2', bg: '' },
  anomaly_warn: { label: 'ANOMALY WARN', color: 'text-amber-400', spine: 'bg-amber-400', bg: 'bg-amber-400/[0.04]' },
  circuit_breaker: { label: 'CIRCUIT BREAKER', color: 'text-sentinel-danger', spine: 'bg-sentinel-danger', bg: 'bg-sentinel-danger/[0.07]' },
  stats: { label: 'STATS', color: 'text-sentinel-gray-1', spine: 'bg-sentinel-gray-2', bg: '' },
  heartbeat: { label: 'HEARTBEAT', color: 'text-sentinel-gray-1', spine: 'bg-sentinel-gray-2', bg: '' },
} as const;

const truncAddr = (addr: string): string => `${addr.slice(0, 8)}…${addr.slice(-4)}`;

const Field = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2">
    <span className="text-sentinel-gray-1/70 w-12 shrink-0">{k}</span>
    <span className="truncate">{children}</span>
  </div>
);

export function EventCard({ event }: { event: WatchEvent }) {
  const meta = EVENT_META[event.type] ?? EVENT_META.agent_tx;
  const isBreaker = event.type === 'circuit_breaker';
  const isRescue = event.type === 'agent_tx' && (event.message?.includes('rescued') ?? false);
  const time = new Date(event.ts).toISOString().slice(11, 19);

  return (
    <div
      className={cn(
        'group relative flex overflow-hidden border font-mono text-xs animate-slide-in-top',
        isBreaker ? 'border-sentinel-danger/60 glow-box-danger' : 'border-sentinel-gray-2',
        meta.bg,
        isRescue && 'border-sentinel-cyan/40 bg-sentinel-cyan/[0.04]',
      )}
    >
      {/* status spine */}
      <span className={cn('w-0.5 shrink-0', isRescue ? 'bg-sentinel-cyan' : meta.spine, isBreaker && 'animate-pulse')} />

      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span
            className={cn(
              'font-bold tracking-[0.15em] text-[11px] flex items-center gap-1.5',
              isRescue ? 'text-sentinel-cyan' : meta.color,
            )}
          >
            {isBreaker && <span className="animate-pulse">⚡</span>}
            {isRescue ? 'FUNDS RESCUED' : meta.label}
          </span>
          <span className="text-sentinel-gray-1/70 text-[10px] tabular-nums">{time} UTC</span>
        </div>

        <div className="space-y-0.5 text-sentinel-gray-1">
          {event.agent && (
            <Field k="agent">
              <span className="text-sentinel-white">{truncAddr(event.agent)}</span>
            </Field>
          )}
          {event.target && (
            <Field k="target">
              <span className="text-sentinel-white">{truncAddr(event.target)}</span>
            </Field>
          )}
          {event.anomalyType && (
            <Field k="rule">
              <span className={cn('font-bold', isRescue ? 'text-sentinel-cyan' : meta.color)}>
                {event.anomalyType}
              </span>
            </Field>
          )}
          {event.message && (
            <div className="text-sentinel-gray-1/90 leading-relaxed pt-0.5">{event.message}</div>
          )}
          {event.txHash && (
            <Field k="tx">
              <span className="text-sentinel-blue">{truncAddr(event.txHash)}</span>
            </Field>
          )}
          {event.block && (
            <div className="text-sentinel-gray-1/50 text-[10px] pt-0.5">block {event.block}</div>
          )}
        </div>
      </div>
    </div>
  );
}
