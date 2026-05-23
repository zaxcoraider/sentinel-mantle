import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { HeroCounters } from '@/components/HeroCounters';
import { EventRow } from '@/components/EventRow';
import { ConnectButton } from '@/components/ConnectButton';
import { ConnectRedirect } from '@/components/ConnectRedirect';
import { getLandingData } from '@/lib/landing-data';

export const metadata: Metadata = {
  title: 'SENTINEL — The circuit breaker for autonomous AI agents',
  description:
    'Wrap your ERC-8004 agent. Set safety rules. Sleep at night. Sentinel monitors your agent on Mantle and pauses it before damage compounds.',
};

// ISR: re-fetch chain data every 30 seconds
export const revalidate = 30;

async function LandingStats() {
  const data = await getLandingData();
  return (
    <>
      <HeroCounters
        agentCount={data.agentCount}
        tvlUsd={data.tvlUsd}
        breakerCount={data.breakerCount}
      />
      <WatchPanel events={data.recentEvents} />
    </>
  );
}

function WatchPanel({
  events,
}: {
  events: Awaited<ReturnType<typeof getLandingData>>['recentEvents'];
}) {
  return (
    <section className="mt-16">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs tracking-widest uppercase text-sentinel-gray-1">
          Watch Sentinel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-xs text-emerald-400">live</span>
        </span>
      </div>
      <div className="border border-sentinel-gray-2 bg-sentinel-gray-2/30">
        {events.length === 0 ? (
          <div className="py-6 px-4 text-center font-mono text-xs text-sentinel-gray-1">
            No events yet. Agents will appear here once registered.
          </div>
        ) : (
          events.map((event, i) => <EventRow key={i} event={event} />)
        )}
      </div>
      <div className="mt-3 text-right">
        <Link
          href="/watch"
          className="font-mono text-xs text-sentinel-blue hover:underline"
        >
          View full live wall →
        </Link>
      </div>
    </section>
  );
}

function StatsSkeleton() {
  return (
    <div className="py-8 space-y-8">
      <div className="grid grid-cols-3 gap-8 md:gap-16">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-14 w-24 bg-sentinel-gray-2 animate-pulse rounded" />
            <div className="h-3 w-20 bg-sentinel-gray-2 animate-pulse rounded" />
          </div>
        ))}
      </div>
      <div className="border border-sentinel-gray-2 divide-y divide-sentinel-gray-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-2 px-3 h-8 bg-sentinel-gray-2/30 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    step: '01',
    verb: 'Wrap',
    copy: 'Register your ERC-8004 agent address with Sentinel and deploy a SafetyRules contract.',
  },
  {
    step: '02',
    verb: 'Watch',
    copy: 'The off-chain monitor tracks every transaction in real time against your configured limits.',
  },
  {
    step: '03',
    verb: 'Pause',
    copy: 'If the agent breaches a rule, the monitor triggers the circuit breaker and pauses the agent.',
  },
  {
    step: '04',
    verb: 'Rescue',
    copy: 'Funds are transferred to a time-locked EmergencyVault you control. No counterparty risk.',
  },
];

export default function LandingPage() {
  return (
    <>
      <Nav />
      <ConnectRedirect />

      <main className="pt-14 max-w-4xl mx-auto px-4 md:px-6">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="pt-16 md:pt-20 pb-4">
          <h1 className="font-sans text-[clamp(40px,6vw,72px)] font-bold leading-tight tracking-tight text-sentinel-white">
            The circuit breaker for
            <br />
            autonomous AI agents.
          </h1>
          <p className="mt-4 font-mono text-base md:text-lg text-sentinel-gray-1 max-w-xl">
            Wrap your ERC-8004 agent. Sleep at night.
          </p>

          <div className="mt-8 flex items-center gap-4 flex-wrap">
            <ConnectButton className="inline-flex" />
            <Link
              href="/watch"
              className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
            >
              View the live wall →
            </Link>
          </div>
        </section>

        {/* ── Live stats + Watch panel ────────────────────────────────── */}
        <Suspense fallback={<StatsSkeleton />}>
          <LandingStats />
        </Suspense>

        {/* ── How it works ────────────────────────────────────────────── */}
        <section className="mt-20">
          <h2 className="font-mono text-xs tracking-widest uppercase text-sentinel-gray-1 mb-6">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-px bg-sentinel-gray-2">
            {HOW_IT_WORKS.map(({ step, verb, copy }) => (
              <div
                key={step}
                className="bg-sentinel-black p-5 space-y-3"
              >
                <span className="font-mono text-xs text-sentinel-blue">{step}</span>
                <p className="font-mono font-bold text-sentinel-white text-sm">{verb}</p>
                <p className="text-xs text-sentinel-gray-1 leading-relaxed">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Trust line ─────────────────────────────────────────────── */}
        <section className="mt-16 py-8 border-t border-sentinel-gray-2">
          <p className="font-mono text-xs text-sentinel-gray-1 text-center">
            Three contracts. One monitor. One reason it can only exist on Mantle.
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
