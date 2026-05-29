'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/lib/agent-data';

type SortKey = 'score' | 'days' | 'events';
type SortDir = 'asc' | 'desc';
type ChainFilter = 'testnet' | 'mainnet';

function ScoreBadge({ score }: { score: bigint }) {
  const n = Number(score);
  const color =
    n >= 700 ? 'text-emerald-400' :
    n >= 400 ? 'text-yellow-400' :
               'text-sentinel-danger';
  return <span className={cn('font-mono font-bold tabular-nums', color)}>{n}</span>;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="font-mono text-xs font-bold text-yellow-400">01</span>;
  if (rank === 2) return <span className="font-mono text-xs font-bold text-sentinel-gray-1">02</span>;
  if (rank === 3) return <span className="font-mono text-xs font-bold text-amber-600">03</span>;
  return <span className="font-mono text-xs text-sentinel-gray-1 tabular-nums">{String(rank).padStart(2, '0')}</span>;
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
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

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  const [chain, setChain] = useState<ChainFilter>('testnet');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    if (chain === 'mainnet') return [];
    const copy = [...entries];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'score') cmp = Number(b.score - a.score);
      else if (sortKey === 'days') cmp = b.daysGuarded - a.daysGuarded;
      else if (sortKey === 'events') cmp = Number(b.eventCount - a.eventCount);
      return sortDir === 'desc' ? cmp : -cmp;
    });
    return copy.map((e, i) => ({ ...e, rank: i + 1 }));
  }, [entries, chain, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <>
      {/* Chain tabs */}
      <div className="flex gap-0 mb-4 border-b border-sentinel-gray-2">
        <button
          onClick={() => setChain('testnet')}
          className={cn(
            'font-mono text-xs px-4 py-2 border-b-2 transition-colors',
            chain === 'testnet'
              ? 'border-sentinel-blue text-sentinel-white'
              : 'border-transparent text-sentinel-gray-1 hover:text-sentinel-white',
          )}
        >
          Mantle Sepolia
        </button>
        <button
          onClick={() => setChain('mainnet')}
          className={cn(
            'font-mono text-xs px-4 py-2 border-b-2 transition-colors',
            chain === 'mainnet'
              ? 'border-sentinel-blue text-sentinel-white'
              : 'border-transparent text-sentinel-gray-1 hover:text-sentinel-white',
          )}
        >
          Mantle Mainnet
        </button>
      </div>

      {chain === 'mainnet' ? (
        <div className="border border-sentinel-gray-2 p-8 text-center">
          <p className="font-mono text-sm text-sentinel-gray-1">
            Mainnet launch coming soon.
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="border border-sentinel-gray-2 p-8 text-center">
          <p className="font-mono text-sm text-sentinel-gray-1">
            No agents registered yet.
          </p>
          <Link
            href="/onboard"
            className="inline-block mt-4 font-mono text-xs text-sentinel-blue hover:underline"
          >
            Wrap your agent →
          </Link>
        </div>
      ) : (
        <div className="border border-sentinel-gray-2">
          <div className="grid grid-cols-[32px_1fr_80px_72px_72px_80px] gap-2 px-4 py-2 border-b border-sentinel-gray-2 bg-sentinel-gray-2/20">
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
                'hover:bg-sentinel-gray-2/30 transition-colors',
                e.rank <= 3 && 'bg-sentinel-gray-2/10',
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
                <span className="font-mono text-xs text-sentinel-gray-1 tabular-nums">
                  {e.daysGuarded}d
                </span>
              </div>
              <div className="flex items-center justify-end">
                <span className="font-mono text-xs text-sentinel-gray-1 tabular-nums">
                  {e.eventCount.toString()}
                </span>
              </div>
              <div className="flex items-center justify-end">
                {e.isPaused ? (
                  <span className="font-mono text-[10px] text-sentinel-danger">TRIPPED</span>
                ) : (
                  <span className="font-mono text-[10px] text-emerald-400">GUARDED</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {chain === 'testnet' && sorted.length > 0 && (
        <p className="font-mono text-[10px] text-sentinel-gray-1 mt-4 text-right">
          {sorted.length} agent{sorted.length !== 1 ? 's' : ''} • refreshes every 60s
        </p>
      )}
    </>
  );
}
