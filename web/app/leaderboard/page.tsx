import Link from 'next/link';
import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { getLeaderboard } from '@/lib/agent-data';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Sentinel Leaderboard — Top Guarded Agents on Mantle',
  description: 'Live reputation leaderboard for AI agents protected by Sentinel on Mantle Network.',
  openGraph: {
    title: 'Sentinel Leaderboard',
    description: 'Top AI agents by reputation score — guarded by Sentinel on Mantle.',
    images: ['/api/og/leaderboard'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og/leaderboard'],
  },
};

export default async function LeaderboardPage() {
  const entries = await getLeaderboard();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentsentinel.vercel.app';
  const shareUrl = encodeURIComponent(`${appUrl}/leaderboard`);
  const tweetText = encodeURIComponent(
    `Sentinel leaderboard — top AI agents guarded on @0xMantle.\n\nCircuit breakers, reputation scores, real safety rules.`,
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
                Top AI agents by reputation score
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href={`https://x.com/intent/tweet?text=${tweetText}&url=${shareUrl}`}
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

          <LeaderboardTable entries={entries} />

        </div>
      </main>
      <Footer />
    </>
  );
}
