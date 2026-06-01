'use client';

import { cn } from '@/lib/utils';
import type { WatchStats } from '@/lib/hooks/use-watch-events';

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'danger' | 'cyan';
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2 border-r border-sentinel-gray-2 shrink-0">
      <span className="font-mono text-[9px] text-sentinel-gray-1 uppercase tracking-[0.18em]">{label}</span>
      <span
        className={cn(
          'font-mono font-bold text-base tabular-nums leading-none',
          tone === 'danger' ? 'text-sentinel-danger' : tone === 'cyan' ? 'text-sentinel-cyan' : 'text-sentinel-white',
        )}
      >
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
  mode,
}: {
  stats: WatchStats;
  connected: boolean;
  muted: boolean;
  onToggleMute: () => void;
  mode: 'live' | 'demo' | 'connecting';
}) {
  return (
    <div className="flex items-stretch border-b border-sentinel-gray-2 overflow-x-auto shrink-0 bg-white/[0.015]">
      <Stat label="agents" value={stats.agentsGuarded} />
      <Stat label="events" value={stats.totalEvents} />
      <Stat label="breakers" value={stats.circuitBreakers} tone={stats.circuitBreakers > 0 ? 'danger' : 'default'} />
      {stats.uptimeSec !== undefined && <Stat label="uptime" value={fmt(stats.uptimeSec)} />}
      {stats.lastBlock && <Stat label="block" value={`#${stats.lastBlock}`} tone="cyan" />}

      <div className="ml-auto flex items-center gap-4 px-4">
        <button
          onClick={onToggleMute}
          className="font-mono text-[10px] text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
          title={muted ? 'Unmute alerts' : 'Mute alerts'}
        >
          {muted ? '🔕 MUTED' : '🔔 SOUND'}
        </button>

        <div
          className={cn(
            'font-mono text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-1 border',
            mode === 'live' && 'text-emerald-400 border-emerald-400/40 bg-emerald-400/5',
            mode === 'demo' && 'text-sentinel-cyan border-sentinel-cyan/40 bg-sentinel-cyan/5',
            mode === 'connecting' && 'text-sentinel-gray-1 border-sentinel-gray-2',
          )}
        >
          <span className="relative flex h-1.5 w-1.5">
            {mode !== 'connecting' && (
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full animate-ping-ring',
                  mode === 'live' ? 'bg-emerald-400' : 'bg-sentinel-cyan',
                )}
              />
            )}
            <span
              className={cn(
                'relative inline-flex h-1.5 w-1.5 rounded-full',
                mode === 'live' ? 'bg-emerald-400' : mode === 'demo' ? 'bg-sentinel-cyan' : 'bg-sentinel-gray-1',
              )}
            />
          </span>
          {mode === 'live' ? 'LIVE' : mode === 'demo' ? 'DEMO FEED' : 'CONNECTING…'}
        </div>
      </div>
    </div>
  );
}
