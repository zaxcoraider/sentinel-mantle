import Link from 'next/link';
import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { getLeaderboard } from '@/lib/agent-data';
import { cn } from '@/lib/utils';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Sentinel Leaderboard — Top Guarded Agents on Mantle',
  description: 'Live reputation leaderboard for AI agents protected by Sentinel on Mantle Network.',
  openGraph: {
    title: 'Sentinel Leaderboard',
    description: 'Top AI agents by reputation score — guarded by Sentinel on Mantle.',
  },
};

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

export default async function LeaderboardPage() {
  const entries = await getLeaderboard();

  const tweetText = encodeURIComponent(
    `Sentinel leaderboard — top AI agents guarded on @0xMantle.\n\nCircuit breakers, reputation scores, real safety rules.\n\nWatch live →`,
  );

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">

          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="font-mono font-bold text-xl text-sentinel-white tracking-wide uppercase">
                Leaderboard
              </h1>
              <p className="font-mono text-xs text-sentinel-gray-1 mt-1">
                Top AI agents by reputation score — Mantle Sepolia
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href={`https://x.com/intent/tweet?text=${tweetText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs px-4 py-2 border border-sentinel-gray-2 text-sentinel-gray-1 hover:text-sentinel-white hover:border-sentinel-white transition-colors"
              >
                Share ↗
              </a>
              <Link
                href="/watch"
                className="font-mono text-xs px-4 py-2 border border-sentinel-blue text-sentinel-blue hover:bg-sentinel-blue hover:text-white transition-colors"
              >
                Watch live →
              </Link>
            </div>
          </div>

          {/* Table */}
          {entries.length === 0 ? (
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
              {/* Header row */}
              <div className="grid grid-cols-[32px_1fr_80px_72px_72px_80px] gap-2 px-4 py-2 border-b border-sentinel-gray-2 bg-sentinel-gray-2/20">
                <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider">#</span>
                <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider">Agent</span>
                <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider text-right">Score</span>
                <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider text-right">Days</span>
                <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider text-right">Events</span>
                <span className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-wider text-right">Status</span>
              </div>

              {/* Data rows */}
              {entries.map((e) => (
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

          {entries.length > 0 && (
            <p className="font-mono text-[10px] text-sentinel-gray-1 mt-4 text-right">
              {entries.length} agent{entries.length !== 1 ? 's' : ''} • refreshes every 60s
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
