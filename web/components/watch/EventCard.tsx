'use client';

import { cn } from '@/lib/utils';
import type { WatchEvent } from '@/lib/hooks/use-watch-events';

const EVENT_META = {
  agent_registered: {
    label: 'REGISTERED',
    color: 'text-sentinel-blue',
    border: 'border-sentinel-blue/40',
    bg: 'bg-sentinel-blue/5',
  },
  agent_deregistered: {
    label: 'DEREGISTERED',
    color: 'text-sentinel-gray-1',
    border: 'border-sentinel-gray-2',
    bg: '',
  },
  agent_tx: {
    label: 'AGENT TX',
    color: 'text-sentinel-gray-1',
    border: 'border-sentinel-gray-2',
    bg: '',
  },
  anomaly_warn: {
    label: '⚠  ANOMALY WARN',
    color: 'text-yellow-400',
    border: 'border-yellow-400/40',
    bg: 'bg-yellow-400/5',
  },
  circuit_breaker: {
    label: '⚡ CIRCUIT BREAKER',
    color: 'text-sentinel-danger',
    border: 'border-sentinel-danger/70',
    bg: 'bg-sentinel-danger/10',
  },
  stats: {
    label: 'STATS',
    color: 'text-sentinel-gray-1',
    border: 'border-sentinel-gray-2',
    bg: '',
  },
  heartbeat: {
    label: 'HEARTBEAT',
    color: 'text-sentinel-gray-1',
    border: 'border-sentinel-gray-2',
    bg: '',
  },
} as const;

function truncAddr(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

export function EventCard({ event }: { event: WatchEvent }) {
  const meta = EVENT_META[event.type] ?? EVENT_META.agent_tx;
  const isBreaker = event.type === 'circuit_breaker';
  const time = new Date(event.ts).toISOString().slice(11, 19);

  return (
    <div
      className={cn(
        'border p-3 font-mono text-xs animate-slide-in-top',
        meta.border,
        meta.bg,
        isBreaker && 'ring-1 ring-sentinel-danger/50',
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn('font-bold tracking-widest text-[11px]', meta.color)}>
          {meta.label}
        </span>
        <span className="text-sentinel-gray-1 text-[10px] tabular-nums">{time} UTC</span>
      </div>

      {event.agent && (
        <div className="flex items-center gap-1.5 text-sentinel-gray-1">
          <span>agent</span>
          <span className="text-sentinel-white">{truncAddr(event.agent)}</span>
        </div>
      )}

      {event.target && (
        <div className="flex items-center gap-1.5 text-sentinel-gray-1">
          <span>target</span>
          <span className="text-sentinel-white">{truncAddr(event.target)}</span>
        </div>
      )}

      {event.anomalyType && (
        <div className="flex items-center gap-1.5 text-sentinel-gray-1 mt-0.5">
          <span>rule</span>
          <span className={meta.color}>{event.anomalyType}</span>
        </div>
      )}

      {event.message && (
        <div className="text-sentinel-gray-1 mt-0.5 leading-relaxed">{event.message}</div>
      )}

      {event.txHash && (
        <div className="flex items-center gap-1.5 text-sentinel-gray-1 mt-0.5">
          <span>tx</span>
          <span className="text-sentinel-blue">{truncAddr(event.txHash)}</span>
        </div>
      )}

      {event.block && (
        <div className="text-sentinel-gray-1/60 text-[10px] mt-1">block {event.block}</div>
      )}
    </div>
  );
}
