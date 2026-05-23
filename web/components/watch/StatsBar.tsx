'use client';

import { cn } from '@/lib/utils';
import type { WatchStats } from '@/lib/hooks/use-watch-events';

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider">{label}</span>
      <span className={cn('font-mono font-bold text-sm tabular-nums', accent ? 'text-sentinel-danger' : 'text-sentinel-white')}>
        {value}
      </span>
    </div>
  );
}

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function StatsBar({
  stats,
  connected,
  muted,
  onToggleMute,
}: {
  stats: WatchStats;
  connected: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <div className="flex items-center gap-6 px-4 py-2.5 border-b border-sentinel-gray-2 overflow-x-auto shrink-0">
      <Stat label="agents" value={stats.agentsGuarded} />
      <Stat label="events" value={stats.totalEvents} />
      <Stat label="breakers" value={stats.circuitBreakers} accent={stats.circuitBreakers > 0} />
      {stats.uptimeSec !== undefined && (
        <Stat label="uptime" value={fmt(stats.uptimeSec)} />
      )}
      {stats.lastBlock && (
        <Stat label="block" value={`#${stats.lastBlock}`} />
      )}

      <div className="ml-auto flex items-center gap-4">
        <button
          onClick={onToggleMute}
          className="font-mono text-[10px] text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
          title={muted ? 'Unmute alerts' : 'Mute alerts'}
        >
          {muted ? '🔕 MUTED' : '🔔 SOUND'}
        </button>
        <div className={cn(
          'font-mono text-xs font-bold flex items-center gap-1.5',
          connected ? 'text-emerald-400' : 'text-sentinel-gray-1',
        )}>
          <span className={cn('text-[8px]', connected ? 'animate-pulse' : '')}>●</span>
          {connected ? 'LIVE' : 'CONNECTING…'}
        </div>
      </div>
    </div>
  );
}
