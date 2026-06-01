'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/lib/agent-data';

type SortKey = 'score' | 'days' | 'events';
type SortDir = 'asc' | 'desc';

function scoreColor(n: number): string {
  return n >= 700 ? 'text-emerald-400' : n >= 400 ? 'text-amber-400' : 'text-sentinel-danger';
}

function ScoreBadge({ score }: { score: bigint }) {
  const n = Number(score);
  return <span className={cn('font-mono font-bold tabular-nums', scoreColor(n))}>{n}</span>;
}

const MEDAL = ['text-amber-300', 'text-zinc-300', 'text-amber-600'] as const;

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <span className={cn('font-mono text-xs font-bold', MEDAL[rank - 1])}>{String(rank).padStart(2, '0')}</span>;
  }
  return <span className="font-mono text-xs text-sentinel-gray-1 tabular-nums">{String(rank).padStart(2, '0')}</span>;
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'font-mono text-[10px] uppercase tracking-wider text-right hover:text-sentinel-white transition-colors',
        active ? 'text-sentinel-white' : 'text-sentinel-gray-1',
      )}
    >
      {label}
      {active && <span className="ml-1">{dir === 'desc' ? '↓' : '↑'}</span>}
    </button>
  );
}

// Top-3 podium cards
function Podium({ entries }: { entries: (LeaderboardEntry & { rank: number })[] }) {
  const top = entries.slice(0, 3);
  if (top.length < 3) return null;
  const order = [1, 0, 2]; // visual: 2nd · 1st · 3rd
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {order.map((i) => {
        const e = top[i];
        const isFirst = e.rank === 1;
        return (
          <Link
            key={e.agent}
            href={`/agent/${e.agent}`}
            className={cn(
              'surface surface-hover p-4 flex flex-col items-center text-center',
              isFirst ? 'shadow-glow border-sentinel-blue/40 -mt-2' : '',
            )}
          >
            <span className={cn('font-mono text-2xl font-bold', MEDAL[e.rank - 1])}>
              {isFirst ? '★' : e.rank}
            </span>
            <span className="font-mono text-[11px] text-sentinel-white mt-2 truncate w-full">
              {e.agent.slice(0, 8)}…{e.agent.slice(-4)}
            </span>
            <span className={cn('font-mono text-xl font-bold mt-1 tabular-nums', scoreColor(Number(e.score)))}>
              {Number(e.score)}
            </span>
            <span className="eyebrow mt-0.5">reputation</span>
          </Link>
        );
      })}
    </div>
  );
}

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'score') cmp = Number(b.score - a.score);
      else if (sortKey === 'days') cmp = b.daysGuarded - a.daysGuarded;
      else if (sortKey === 'events') cmp = Number(b.eventCount - a.eventCount);
      return sortDir === 'desc' ? cmp : -cmp;
    });
    return copy.map((e, i) => ({ ...e, rank: i + 1 }));
  }, [entries, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <>
      {/* Network chip */}
      <div className="flex items-center gap-2 mb-5">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1 border border-sentinel-cyan/40 text-sentinel-cyan bg-sentinel-cyan/5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-sentinel-cyan animate-glow-pulse" />
          Mantle Mainnet
        </span>
        {sorted.length > 0 && (
          <span className="font-mono text-[10px] text-sentinel-gray-1">
            {sorted.length} agent{sorted.length !== 1 ? 's' : ''} · refreshes every 60s
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="surface p-10 text-center space-y-5 shadow-glow">
          <div className="text-sentinel-cyan text-3xl">⬡</div>
          <div>
            <p className="font-mono text-sm text-sentinel-white">No agents on the board yet.</p>
            <p className="font-mono text-xs text-sentinel-gray-1 mt-1 max-w-sm mx-auto leading-relaxed">
              Reputation is earned on-chain — agents that stay within their safety rules climb; those that trip the breaker fall.
            </p>
          </div>
          <Link
            href="/onboard"
            className="inline-block font-mono text-xs tracking-widest uppercase px-6 py-3 text-sentinel-white bg-sentinel-blue/90 border border-sentinel-blue shadow-glow hover:bg-sentinel-blue hover:shadow-glow-cyan transition-all"
          >
            Be the first — wrap an agent →
          </Link>
        </div>
      ) : (
        <>
          <Podium entries={sorted} />

          <div className="surface overflow-hidden">
            <div className="grid grid-cols-[32px_1fr_80px_72px_72px_80px] gap-2 px-4 py-2.5 border-b border-sentinel-gray-2 bg-white/[0.02]">
              <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider">#</span>
              <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider">Agent</span>
              <div className="text-right">
                <SortHeader label="Score" active={sortKey === 'score'} dir={sortDir} onClick={() => toggleSort('score')} />
              </div>
              <div className="text-right">
                <SortHeader label="Days" active={sortKey === 'days'} dir={sortDir} onClick={() => toggleSort('days')} />
              </div>
              <div className="text-right">
                <SortHeader label="Events" active={sortKey === 'events'} dir={sortDir} onClick={() => toggleSort('events')} />
              </div>
              <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider text-right">Status</span>
            </div>

            {sorted.map((e) => (
              <Link
                key={e.agent}
                href={`/agent/${e.agent}`}
                className={cn(
                  'grid grid-cols-[32px_1fr_80px_72px_72px_80px] gap-2 px-4 py-3',
                  'border-b border-sentinel-gray-2/50 last:border-0',
                  'hover:bg-white/[0.03] transition-colors',
                  e.rank <= 3 && 'bg-white/[0.015]',
                )}
              >
                <div className="flex items-center">
                  <RankBadge rank={e.rank} />
                </div>
                <div className="flex items-center min-w-0">
                  <span className="font-mono text-xs text-sentinel-white truncate">
                    {e.agent.slice(0, 10)}…{e.agent.slice(-4)}
                  </span>
                </div>
                <div className="flex items-center justify-end">
                  <ScoreBadge score={e.score} />
                </div>
                <div className="flex items-center justify-end">
                  <span className="font-mono text-xs text-sentinel-gray-1 tabular-nums">{e.daysGuarded}d</span>
                </div>
                <div className="flex items-center justify-end">
                  <span className="font-mono text-xs text-sentinel-gray-1 tabular-nums">{e.eventCount.toString()}</span>
                </div>
                <div className="flex items-center justify-end">
                  {e.isPaused ? (
                    <span className="font-mono text-[10px] text-sentinel-danger flex items-center gap-1">⚡ TRIPPED</span>
                  ) : (
                    <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> GUARDED
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
