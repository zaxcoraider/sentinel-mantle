'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Nav } from '@/components/Nav';
import { EventCard } from '@/components/watch/EventCard';
import { StatsBar } from '@/components/watch/StatsBar';
import { useWatchEvents, type AgentLiveStatus } from '@/lib/hooks/use-watch-events';
import { useDemoFeed } from '@/lib/hooks/use-demo-feed';
import { cn } from '@/lib/utils';

const MONITOR_URL = process.env.NEXT_PUBLIC_MONITOR_URL ?? 'http://localhost:8080';

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
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
    osc.onended = () => void ctx.close();
  } catch {
    /* browser blocks audio before user gesture */
  }
}

// ---- Agent sidebar ---------------------------------------------------------

const STATUS_META = {
  guarded: { color: 'text-emerald-400', dot: 'bg-emerald-400', label: 'GUARDED' },
  warn: { color: 'text-amber-400', dot: 'bg-amber-400', label: 'WARN' },
  tripped: { color: 'text-sentinel-danger', dot: 'bg-sentinel-danger', label: 'TRIPPED' },
} as const;

function AgentRow({ a }: { a: AgentLiveStatus }) {
  const meta = STATUS_META[a.status];
  return (
    <div
      className={cn(
        'surface surface-hover px-3 py-2.5',
        a.status === 'tripped' && 'border-sentinel-danger/50',
        a.status === 'warn' && 'border-amber-400/40',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-sentinel-white truncate">
          {a.agent.slice(0, 8)}…{a.agent.slice(-4)}
        </span>
        {a.tokenId && a.tokenId !== '?' && (
          <span className="font-mono text-[9px] text-sentinel-gray-1">#{a.tokenId}</span>
        )}
      </div>
      <div className={cn('font-mono text-[10px] mt-1 flex items-center gap-1.5', meta.color)}>
        <span className="relative flex h-1.5 w-1.5">
          {a.status !== 'tripped' && (
            <span className={cn('absolute inline-flex h-full w-full rounded-full animate-ping-ring', meta.dot)} />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', meta.dot)} />
        </span>
        {meta.label}
      </div>
    </div>
  );
}

// ---- Monitoring (waiting) state — radar scan -------------------------------

function MonitoringState({ mode }: { mode: 'demo' | 'connecting' }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20 select-none">
      <div className="relative h-24 w-24 mb-6">
        <span className="absolute inset-0 rounded-full border border-sentinel-blue/30" />
        <span className="absolute inset-3 rounded-full border border-sentinel-blue/20" />
        <span className="absolute inset-6 rounded-full border border-sentinel-blue/10" />
        <span className="absolute inset-0 rounded-full border-t-2 border-sentinel-cyan/70 animate-spin [animation-duration:2.5s]" />
        <span className="absolute inset-0 flex items-center justify-center text-sentinel-cyan text-lg">◎</span>
      </div>
      <div className="font-mono text-xs tracking-[0.2em] uppercase text-sentinel-gray-1 mb-2">
        {mode === 'connecting' ? 'connecting to monitor…' : 'monitoring — scanning for anomalies'}
      </div>
      <div className="font-mono text-[10px] text-sentinel-gray-1/50 max-w-xs leading-relaxed">
        Every guarded agent transaction is checked against its safety rules in real time.
        Events stream here the instant something happens.
      </div>
    </div>
  );
}

// ---- Main page -------------------------------------------------------------

export default function WatchPage() {
  const real = useWatchEvents(MONITOR_URL);
  const [graceOver, setGraceOver] = useState(false);
  const [muted, setMuted] = useState(true);
  const prevBreakers = useRef(0);

  // Give the real monitor a few seconds; if it never connects, fall back to the demo feed.
  useEffect(() => {
    const t = setTimeout(() => setGraceOver(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const isLive = real.connected;
  const useDemo = !isLive && graceOver;
  const demo = useDemoFeed(useDemo);

  const mode: 'live' | 'demo' | 'connecting' = isLive ? 'live' : useDemo ? 'demo' : 'connecting';
  const source = isLive ? real : useDemo ? demo : { events: real.events, agents: real.agents, stats: real.stats };

  // Play alarm on new circuit breaker event (if not muted)
  useEffect(() => {
    if (source.stats.circuitBreakers > prevBreakers.current) {
      prevBreakers.current = source.stats.circuitBreakers;
      if (!muted) playAlarm();
    }
  }, [source.stats.circuitBreakers, muted]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const agentList = useMemo(() => {
    const order = { tripped: 0, warn: 1, guarded: 2 };
    return Array.from(source.agents.values()).sort((a, b) => order[a.status] - order[b.status]);
  }, [source.agents]);

  return (
    <div className="flex flex-col h-screen bg-sentinel-black overflow-hidden">
      <Nav />

      <div className="pt-14 flex flex-col flex-1 overflow-hidden">
        {/* Command-bar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-sentinel-gray-2 shrink-0 bg-white/[0.015]">
          <div className="flex items-center gap-3">
            <span className="text-sentinel-cyan text-lg leading-none">◈</span>
            <div>
              <h1 className="font-mono font-bold text-sm text-sentinel-white tracking-[0.2em] uppercase glow-blue">
                Sentinel Watch
              </h1>
              <p className="font-mono text-[10px] text-sentinel-gray-1 mt-0.5">
                Real-time circuit-breaker monitor · Mantle Network
              </p>
            </div>
          </div>
          <div className="font-mono text-[10px] text-sentinel-gray-1">
            {agentList.length} agent{agentList.length !== 1 ? 's' : ''} guarded
          </div>
        </div>

        <StatsBar stats={source.stats} connected={isLive} muted={muted} onToggleMute={toggleMute} mode={mode} />

        {/* Content: feed + sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Event feed */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scanlines">
            {source.events.length === 0 ? (
              <MonitoringState mode={mode === 'live' ? 'demo' : mode} />
            ) : (
              source.events.map((ev) => <EventCard key={`${ev.id}-${ev.ts}`} event={ev} />)
            )}
          </div>

          {/* Agents sidebar */}
          <div className="w-60 shrink-0 border-l border-sentinel-gray-2 flex flex-col overflow-hidden bg-white/[0.01]">
            <div className="px-3 py-2.5 border-b border-sentinel-gray-2 shrink-0 flex items-center justify-between">
              <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-[0.18em]">
                Guarded Agents
              </span>
              <span className="font-mono text-[10px] text-sentinel-cyan tabular-nums">{agentList.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {agentList.length === 0 ? (
                <div className="font-mono text-[10px] text-sentinel-gray-1/40 text-center pt-6">
                  {mode === 'connecting' ? '…' : 'none yet'}
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
