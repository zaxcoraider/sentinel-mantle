'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient } from 'wagmi';
import { type Address } from 'viem';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { DEPLOYMENTS, AgentRegistryAbi, MockIdentityRegistryAbi, SentinelGuardAbi, NATIVE_TOKEN } from '@/lib/contracts';
import { cn } from '@/lib/utils';

const SEP = DEPLOYMENTS.sepolia;

interface OwnedAgent {
  tokenId: bigint;
  agent: Address;
  isGuarded: boolean;
  isPaused: boolean;
  mntBalance: bigint;
}

function AgentCard({ a }: { a: OwnedAgent }) {
  const statusColor = a.isPaused
    ? 'border-sentinel-danger/50 text-sentinel-danger'
    : a.isGuarded
    ? 'border-emerald-400/50 text-emerald-400'
    : 'border-sentinel-gray-2 text-sentinel-gray-1';

  const statusLabel = a.isPaused ? '⚡ TRIPPED' : a.isGuarded ? '● GUARDED' : '○ UNWRAPPED';

  return (
    <Link
      href={`/agent/${a.agent}`}
      className="block border border-sentinel-gray-2 p-4 hover:bg-sentinel-gray-2/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-sentinel-gray-1">Token #{a.tokenId.toString()}</p>
          <p className="font-mono text-sm text-sentinel-white mt-0.5 truncate">
            {a.agent.slice(0, 12)}…{a.agent.slice(-4)}
          </p>
        </div>
        <span className={cn('font-mono text-[10px] border px-2 py-0.5 shrink-0', statusColor)}>
          {statusLabel}
        </span>
      </div>
      {a.isGuarded && (
        <p className="font-mono text-xs text-sentinel-gray-1 mt-2">
          Balance: <span className="text-sentinel-white">
            {(Number(a.mntBalance) / 1e18).toFixed(4)} MNT
          </span>
        </p>
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
        const transferLogs = await publicClient.getLogs({
          address: SEP.MockIdentityRegistry,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { name: 'from', type: 'address', indexed: true },
              { name: 'to', type: 'address', indexed: true },
              { name: 'tokenId', type: 'uint256', indexed: true },
            ],
          },
          args: { to: address },
          fromBlock: BigInt(0),
          toBlock: 'latest',
        });

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
                address: SEP.MockIdentityRegistry,
                abi: MockIdentityRegistryAbi,
                functionName: 'ownerOf',
                args: [tokenId],
              }),
              publicClient.readContract({
                address: SEP.MockIdentityRegistry,
                abi: MockIdentityRegistryAbi,
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

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">

          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-mono font-bold text-xl text-sentinel-white tracking-wide">
                Dashboard
              </h1>
              {address && (
                <p className="font-mono text-xs text-sentinel-gray-1 mt-1">
                  {address.slice(0, 10)}…{address.slice(-4)}
                </p>
              )}
            </div>
            {isConnected && (
              <Link
                href="/onboard"
                className="font-mono text-xs px-4 py-2 border border-sentinel-blue text-sentinel-blue hover:bg-sentinel-blue hover:text-white transition-colors"
              >
                + Wrap agent
              </Link>
            )}
          </div>

          {!isConnected ? (
            <div className="border border-sentinel-gray-2 p-8 text-center">
              <p className="font-mono text-sm text-sentinel-gray-1 mb-4">
                Connect your wallet to view your agents.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="border border-sentinel-gray-2 p-4 animate-pulse">
                  <div className="h-3 w-24 bg-sentinel-gray-2 rounded mb-2" />
                  <div className="h-4 w-48 bg-sentinel-gray-2 rounded" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="border border-sentinel-gray-2 p-8 text-center space-y-4">
              <p className="font-mono text-sm text-sentinel-gray-1">
                No ERC-8004 agent identities found.
              </p>
              <Link
                href="/onboard"
                className="inline-block font-mono text-xs px-6 py-2 border border-sentinel-blue text-sentinel-blue hover:bg-sentinel-blue hover:text-white transition-colors"
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
