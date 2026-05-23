'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Nav } from '@/components/Nav';
import { EventCard } from '@/components/watch/EventCard';
import { StatsBar } from '@/components/watch/StatsBar';
import { useWatchEvents, type AgentLiveStatus } from '@/lib/hooks/use-watch-events';
import { cn } from '@/lib/utils';

const MONITOR_URL =
  process.env.NEXT_PUBLIC_MONITOR_URL ?? 'http://localhost:8080';

// ---- Sound: synthesized alarm using Web Audio API (no file assets needed) --

function playAlarm(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.30);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
    osc.onended = () => void ctx.close();
  } catch { /* browser blocks audio before user gesture */ }
}

// ---- Agent sidebar ---------------------------------------------------------

const STATUS_META = {
  guarded: { color: 'text-emerald-400', label: 'GUARDED' },
  warn:    { color: 'text-yellow-400',  label: 'WARN' },
  tripped: { color: 'text-sentinel-danger', label: 'TRIPPED' },
} as const;

function AgentRow({ a }: { a: AgentLiveStatus }) {
  const meta = STATUS_META[a.status];
  return (
    <div className="border border-sentinel-gray-2 px-3 py-2">
      <div className="font-mono text-[10px] text-sentinel-white truncate">
        {a.agent.slice(0, 10)}…{a.agent.slice(-6)}
      </div>
      <div className={cn('font-mono text-[10px] mt-0.5 flex items-center gap-1', meta.color)}>
        <span className={cn('text-[8px]', a.status === 'guarded' && 'animate-pulse')}>●</span>
        {meta.label}
      </div>
      {a.tokenId && a.tokenId !== '?' && (
        <div className="font-mono text-[9px] text-sentinel-gray-1 mt-0.5">token #{a.tokenId}</div>
      )}
    </div>
  );
}

// ---- Empty / waiting states ------------------------------------------------

function EmptyFeed({ connected }: { connected: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20 select-none">
      <div className="font-mono text-sentinel-gray-1/40 text-xs tracking-widest uppercase mb-3">
        {connected ? 'monitoring — waiting for events…' : 'connecting to monitor…'}
      </div>
      <div className="font-mono text-[10px] text-sentinel-gray-1/25">
        {connected
          ? 'events appear here as agents execute transactions'
          : `${MONITOR_URL}/events`}
      </div>
    </div>
  );
}

// ---- Main page -------------------------------------------------------------

export default function WatchPage() {
  const { events, agents, stats, connected } = useWatchEvents(MONITOR_URL);
  const [muted, setMuted] = useState(true);
  const prevBreakers = useRef(0);

  // Play alarm on new circuit breaker event (if not muted)
  useEffect(() => {
    if (stats.circuitBreakers > prevBreakers.current) {
      prevBreakers.current = stats.circuitBreakers;
      if (!muted) playAlarm();
    }
  }, [stats.circuitBreakers, muted]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const agentList = Array.from(agents.values()).sort((a, b) => {
    const order = { tripped: 0, warn: 1, guarded: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="flex flex-col h-screen bg-sentinel-black overflow-hidden">
      <Nav />

      {/* Page header */}
      <div className="pt-14 flex flex-col flex-1 overflow-hidden">
        {/* Title row */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-sentinel-gray-2 shrink-0">
          <div>
            <h1 className="font-mono font-bold text-base text-sentinel-white tracking-widest uppercase">
              Sentinel Watch
            </h1>
            <p className="font-mono text-[10px] text-sentinel-gray-1 mt-0.5">
              Real-time circuit breaker monitor — Mantle Sepolia
            </p>
          </div>
          <div className="font-mono text-[10px] text-sentinel-gray-1">
            {agentList.length} agent{agentList.length !== 1 ? 's' : ''} guarded
          </div>
        </div>

        {/* Stats bar */}
        <StatsBar
          stats={stats}
          connected={connected}
          muted={muted}
          onToggleMute={toggleMute}
        />

        {/* Content: feed + sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Event feed */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {events.length === 0 ? (
              <EmptyFeed connected={connected} />
            ) : (
              events.map((ev) => <EventCard key={`${ev.id}-${ev.ts}`} event={ev} />)
            )}
          </div>

          {/* Agents sidebar */}
          <div className="w-56 shrink-0 border-l border-sentinel-gray-2 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-sentinel-gray-2 shrink-0">
              <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-widest">
                Guarded Agents
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {agentList.length === 0 ? (
                <div className="font-mono text-[10px] text-sentinel-gray-1/40 text-center pt-6">
                  {connected ? 'none yet' : '…'}
                </div>
              ) : (
                agentList.map((a) => <AgentRow key={a.agent} a={a} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
