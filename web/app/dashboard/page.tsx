'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient } from 'wagmi';
import { type Address } from 'viem';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { AgentRegistryAbi, AgentIdentityRegistryAbi, SentinelGuardAbi, NATIVE_TOKEN } from '@/lib/contracts';
import { NETWORK, DEPLOY_BLOCK } from '@/lib/network';
import { collectLogs } from '@/lib/logs';
import { cn } from '@/lib/utils';

const SEP = NETWORK;

interface OwnedAgent {
  tokenId: bigint;
  agent: Address;
  isGuarded: boolean;
  isPaused: boolean;
  mntBalance: bigint;
}

function AgentCard({ a }: { a: OwnedAgent }) {
  const tone = a.isPaused
    ? { ring: 'border-sentinel-danger/50', text: 'text-sentinel-danger', dot: 'bg-sentinel-danger', label: 'TRIPPED' }
    : a.isGuarded
    ? { ring: 'border-emerald-400/40', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'GUARDED' }
    : { ring: 'border-sentinel-gray-2', text: 'text-sentinel-gray-1', dot: 'bg-sentinel-gray-1', label: 'UNWRAPPED' };

  return (
    <Link
      href={`/agent/${a.agent}`}
      className={cn(
        'surface surface-hover block p-4 group',
        a.isPaused && 'border-sentinel-danger/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-sentinel-gray-1">
            Token #{a.tokenId.toString()}
          </p>
          <p className="font-mono text-sm text-sentinel-white mt-1 truncate group-hover:text-sentinel-cyan transition-colors">
            {a.agent.slice(0, 14)}…{a.agent.slice(-4)}
          </p>
        </div>
        <span className={cn('font-mono text-[10px] border px-2 py-1 shrink-0 flex items-center gap-1.5', tone.ring, tone.text)}>
          <span className="relative flex h-1.5 w-1.5">
            {!a.isPaused && a.isGuarded && (
              <span className={cn('absolute inline-flex h-full w-full rounded-full animate-ping-ring', tone.dot)} />
            )}
            <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', tone.dot)} />
          </span>
          {a.isPaused && '⚡ '}{tone.label}
        </span>
      </div>
      {a.isGuarded && (
        <div className="mt-3 pt-3 border-t border-sentinel-gray-2 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-sentinel-gray-1">Protected</span>
          <span className="font-mono text-sm text-sentinel-white tabular-nums">
            {(Number(a.mntBalance) / 1e18).toFixed(4)} <span className="text-sentinel-cyan">MNT</span>
          </span>
        </div>
      )}
    </Link>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [agents, setAgents] = useState<OwnedAgent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !publicClient) {
      setAgents([]);
      return;
    }

    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        // Find ERC-8004 tokens owned by this address
        const TRANSFER = {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { name: 'from', type: 'address', indexed: true },
            { name: 'to', type: 'address', indexed: true },
            { name: 'tokenId', type: 'uint256', indexed: true },
          ],
        } as const;
        const transferLogs = await collectLogs(publicClient, DEPLOY_BLOCK, (f, t) =>
          publicClient.getLogs({
            address: SEP.AgentIdentityRegistry,
            event: TRANSFER,
            args: { to: address },
            fromBlock: f,
            toBlock: t,
          }),
        );

        const tokenIds = [...new Set(transferLogs.map((l) => l.args.tokenId as bigint))];
        if (tokenIds.length === 0) {
          setAgents([]);
          setLoading(false);
          return;
        }

        const results = await Promise.allSettled(
          tokenIds.map(async (tokenId) => {
            const [ownerRes, agentRes] = await Promise.allSettled([
              publicClient.readContract({
                address: SEP.AgentIdentityRegistry,
                abi: AgentIdentityRegistryAbi,
                functionName: 'ownerOf',
                args: [tokenId],
              }),
              publicClient.readContract({
                address: SEP.AgentIdentityRegistry,
                abi: AgentIdentityRegistryAbi,
                functionName: 'getAgent',
                args: [tokenId],
              }),
            ]);

            if (ownerRes.status !== 'fulfilled') return null;
            if ((ownerRes.value as string).toLowerCase() !== address.toLowerCase()) return null;
            if (agentRes.status !== 'fulfilled') return null;

            const [agentAddress] = agentRes.value as [Address, string];

            const [isGuardedRes, isPausedRes, balanceRes] = await Promise.allSettled([
              publicClient.readContract({
                address: SEP.AgentRegistry,
                abi: AgentRegistryAbi,
                functionName: 'isGuarded',
                args: [agentAddress],
              }),
              publicClient.readContract({
                address: SEP.SentinelGuard,
                abi: SentinelGuardAbi,
                functionName: 'isPaused',
                args: [agentAddress],
              }),
              publicClient.readContract({
                address: SEP.SentinelGuard,
                abi: SentinelGuardAbi,
                functionName: 'balanceOf',
                args: [agentAddress, NATIVE_TOKEN],
              }),
            ]);

            return {
              tokenId,
              agent: agentAddress,
              isGuarded: isGuardedRes.status === 'fulfilled' ? (isGuardedRes.value as boolean) : false,
              isPaused: isPausedRes.status === 'fulfilled' ? (isPausedRes.value as boolean) : false,
              mntBalance: balanceRes.status === 'fulfilled' ? (balanceRes.value as bigint) : BigInt(0),
            } satisfies OwnedAgent;
          }),
        );

        const list = results
          .filter(
            (r): r is PromiseFulfilledResult<OwnedAgent | null> =>
              r.status === 'fulfilled' && r.value !== null,
          )
          .map((r) => r.value as OwnedAgent)
          .sort((a, b) => (b.isGuarded ? 1 : 0) - (a.isGuarded ? 1 : 0));

        setAgents(list);
      } catch {
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [address, publicClient]);

  const guardedCount = agents.filter((a) => a.isGuarded).length;
  const trippedCount = agents.filter((a) => a.isPaused).length;
  const totalMnt = agents.reduce((sum, a) => sum + Number(a.mntBalance) / 1e18, 0);

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">

          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <span className="eyebrow">Control room</span>
              <h1 className="font-sans font-bold text-3xl text-sentinel-white tracking-tight mt-1">
                Dashboard
              </h1>
              {address && (
                <p className="font-mono text-xs text-sentinel-gray-1 mt-1">
                  {address.slice(0, 12)}…{address.slice(-4)}
                </p>
              )}
            </div>
            {isConnected && (
              <Link
                href="/onboard"
                className="font-mono text-xs tracking-widest uppercase px-5 py-2.5 text-sentinel-white bg-sentinel-blue/90 border border-sentinel-blue shadow-glow hover:bg-sentinel-blue hover:shadow-glow-cyan transition-all"
              >
                + Wrap agent
              </Link>
            )}
          </div>

          {/* Summary stats — present whenever connected with agents */}
          {isConnected && agents.length > 0 && (
            <div className="grid grid-cols-3 gap-px bg-sentinel-gray-2 border border-sentinel-gray-2 mb-6">
              <div className="surface p-4">
                <p className="font-mono text-2xl font-bold text-sentinel-white tabular-nums">{guardedCount}</p>
                <p className="eyebrow mt-1">Guarded</p>
              </div>
              <div className="surface p-4">
                <p className="font-mono text-2xl font-bold text-sentinel-cyan tabular-nums glow-blue">
                  {totalMnt.toFixed(3)}
                </p>
                <p className="eyebrow mt-1">MNT Protected</p>
              </div>
              <div className="surface p-4">
                <p className={cn('font-mono text-2xl font-bold tabular-nums', trippedCount > 0 ? 'text-sentinel-danger' : 'text-sentinel-white')}>
                  {trippedCount}
                </p>
                <p className="eyebrow mt-1">Tripped</p>
              </div>
            </div>
          )}

          {!isConnected ? (
            <div className="surface p-10 text-center space-y-4 shadow-glow">
              <div className="text-sentinel-cyan text-3xl">◈</div>
              <p className="font-mono text-sm text-sentinel-white">
                Connect your wallet to view your guarded agents.
              </p>
              <p className="font-mono text-xs text-sentinel-gray-1 max-w-sm mx-auto leading-relaxed">
                Your dashboard shows every ERC-8004 identity you own, its protection status, and the funds Sentinel is guarding.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="surface p-4 animate-pulse">
                  <div className="h-3 w-24 bg-sentinel-gray-2 rounded mb-2" />
                  <div className="h-4 w-48 bg-sentinel-gray-2 rounded" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="surface p-10 text-center space-y-5 shadow-glow">
              <div className="text-sentinel-gray-1 text-3xl">⬡</div>
              <div>
                <p className="font-mono text-sm text-sentinel-white">No agents wrapped yet.</p>
                <p className="font-mono text-xs text-sentinel-gray-1 mt-1">
                  Wrap an ERC-8004 agent to put it under Sentinel protection.
                </p>
              </div>
              <Link
                href="/onboard"
                className="inline-block font-mono text-xs tracking-widest uppercase px-6 py-3 text-sentinel-white bg-sentinel-blue/90 border border-sentinel-blue shadow-glow hover:bg-sentinel-blue hover:shadow-glow-cyan transition-all"
              >
                Wrap your first agent →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((a) => (
                <AgentCard key={a.agent} a={a} />
              ))}
              <p className="font-mono text-[10px] text-sentinel-gray-1 text-right mt-2">
                {agents.length} identity token{agents.length !== 1 ? 's' : ''} found
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
