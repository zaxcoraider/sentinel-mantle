import { notFound } from 'next/navigation';
import { isAddress, formatUnits, type Address } from 'viem';
import { Nav } from '@/components/Nav';
import { SafetyRulesDisplay } from '@/components/agent/SafetyRulesDisplay';
import { ReputationChart } from '@/components/agent/ReputationChart';
import { getAgentDetail } from '@/lib/agent-data';
import { DEPLOYMENTS } from '@/lib/contracts';
import { cn } from '@/lib/utils';

export const revalidate = 30;

// ---- Status badge ----------------------------------------------------------

function StatusBadge({ paused, active }: { paused: boolean; active: boolean }) {
  if (!active) {
    return (
      <span className="font-mono text-xs px-2 py-0.5 border border-sentinel-gray-2 text-sentinel-gray-1">
        DEREGISTERED
      </span>
    );
  }
  if (paused) {
    return (
      <span className="font-mono text-xs px-2 py-0.5 border border-sentinel-danger/50 text-sentinel-danger">
        ⚡ CIRCUIT TRIPPED
      </span>
    );
  }
  return (
    <span className="font-mono text-xs px-2 py-0.5 border border-emerald-400/50 text-emerald-400">
      ● GUARDED
    </span>
  );
}

// ---- Detail row ------------------------------------------------------------

function DetailRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-sentinel-gray-2/50 last:border-0">
      <span className="font-mono text-xs text-sentinel-gray-1">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-sentinel-blue hover:underline"
        >
          {value} ↗
        </a>
      ) : (
        <span className="font-mono text-xs text-sentinel-white">{value}</span>
      )}
    </div>
  );
}

// ---- Page ------------------------------------------------------------------

export default async function AgentPage({
  params,
}: {
  params: { id: string };
}) {
  const raw = params.id;
  if (!isAddress(raw)) notFound();
  const agent = raw as Address;

  const data = await getAgentDetail(agent);
  if (!data.isGuarded) {
    return (
      <>
        <Nav />
        <main className="pt-14 min-h-screen">
          <div className="max-w-2xl mx-auto px-4 py-12">
            <p className="font-mono text-sm text-sentinel-gray-1">
              Agent <span className="text-sentinel-white">{agent.slice(0, 10)}…</span> is not registered with Sentinel.
            </p>
            <a href="/onboard" className="inline-block mt-4 font-mono text-xs text-sentinel-blue hover:underline">
              Wrap this agent →
            </a>
          </div>
        </main>
      </>
    );
  }

  const expBase = DEPLOYMENTS.sepolia.explorerBase;
  const mntFormatted = formatUnits(data.nativeMntBalance, 18);

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-8">

          {/* Header */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono font-bold text-base text-sentinel-white break-all">
                {agent}
              </h1>
              <StatusBadge
                paused={data.isPaused}
                active={data.config?.active ?? false}
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <a
                href={`${expBase}/address/${agent}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
              >
                Mantlescan ↗
              </a>
              <span className="font-mono text-[10px] text-sentinel-gray-1">
                Token #{data.config?.erc8004TokenId?.toString() ?? '—'}
              </span>
              {data.daysGuarded > 0 && (
                <span className="font-mono text-[10px] text-sentinel-gray-1">
                  Guarded {data.daysGuarded}d
                </span>
              )}
            </div>
          </div>

          {/* Top grid: Reputation + Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reputation */}
            <div className="border border-sentinel-gray-2 p-4 space-y-2">
              <p className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-widest">
                Reputation
              </p>
              {data.reputation ? (
                <ReputationChart
                  score={data.reputation.score}
                  history={data.reputation.history}
                />
              ) : (
                <p className="font-mono text-xs text-sentinel-gray-1">Not rated yet</p>
              )}
            </div>

            {/* Guard balance */}
            <div className="border border-sentinel-gray-2 p-4 space-y-3">
              <p className="font-mono text-[10px] text-sentinel-gray-1 uppercase tracking-widest">
                Guard Balance
              </p>
              <div>
                <span className="font-mono font-bold text-2xl text-sentinel-white">
                  {parseFloat(mntFormatted).toFixed(4)}
                </span>
                <span className="font-mono text-sm text-sentinel-gray-1 ml-2">MNT</span>
              </div>
              <div className="space-y-0">
                {data.config && (
                  <>
                    <DetailRow
                      label="Guard contract"
                      value={data.config.guardContract.slice(0, 10) + '…'}
                      href={`${expBase}/address/${data.config.guardContract}`}
                    />
                    <DetailRow
                      label="Registered"
                      value={
                        data.config.registeredAt > 0
                          ? new Date(Number(data.config.registeredAt) * 1000).toLocaleDateString()
                          : '—'
                      }
                    />
                  </>
                )}
                {data.owner && (
                  <DetailRow
                    label="Owner"
                    value={data.owner.slice(0, 10) + '…'}
                    href={`${expBase}/address/${data.owner}`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Safety Rules */}
          {data.rules && data.config && (
            <div className="space-y-2">
              <h2 className="font-mono font-bold text-sm text-sentinel-white uppercase tracking-widest">
                Safety Rules
              </h2>
              <SafetyRulesDisplay
                rules={data.rules}
                rulesAddress={data.config.rulesContract}
              />
            </div>
          )}

          {/* Reputation events */}
          {data.reputation && data.reputation.history.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-mono font-bold text-sm text-sentinel-white uppercase tracking-widest">
                Reputation History
              </h2>
              <div className="border border-sentinel-gray-2">
                {data.reputation.history.map((h, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center justify-between px-4 py-2 font-mono text-xs border-b border-sentinel-gray-2/50 last:border-0',
                    )}
                  >
                    <span className="text-sentinel-gray-1">
                      {new Date(Number(h.timestamp) * 1000).toLocaleDateString()}
                    </span>
                    <span className={h.delta >= 0 ? 'text-emerald-400' : 'text-sentinel-danger'}>
                      {h.delta >= 0 ? '+' : ''}{h.delta}
                    </span>
                    <span className="text-sentinel-white">{h.scoreAfter}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
