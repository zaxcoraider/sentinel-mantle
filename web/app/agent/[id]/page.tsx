import { notFound } from 'next/navigation';
import { isAddress, formatUnits, type Address } from 'viem';
import { Nav } from '@/components/Nav';
import { SafetyRulesDisplay } from '@/components/agent/SafetyRulesDisplay';
import { ReputationChart } from '@/components/agent/ReputationChart';
import { RulesEditorButton } from '@/components/agent/RulesEditorButton';
import { AiIncidentReport } from '@/components/agent/AiIncidentReport';
import { getAgentDetail } from '@/lib/agent-data';
import { getServerNet } from '@/lib/server-net';
import { NETWORKS } from '@/lib/networks';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ---- Status badge ----------------------------------------------------------

function StatusBadge({ paused, active }: { paused: boolean; active: boolean }) {
  if (!active) {
    return (
      <span className="font-mono text-[11px] px-2.5 py-1 border border-sentinel-gray-2 text-sentinel-gray-1">
        DEREGISTERED
      </span>
    );
  }
  if (paused) {
    return (
      <span className="font-mono text-[11px] px-2.5 py-1 border border-sentinel-danger/60 text-sentinel-danger bg-sentinel-danger/10 glow-box-danger flex items-center gap-1.5">
        <span className="animate-pulse">⚡</span> CIRCUIT TRIPPED
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] px-2.5 py-1 border border-emerald-400/50 text-emerald-400 bg-emerald-400/5 flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping-ring" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      GUARDED
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

  const net = getServerNet();
  const data = await getAgentDetail(agent, net);
  if (!data.isGuarded) {
    return (
      <>
        <Nav />
        <main className="pt-14 min-h-screen">
          <div className="max-w-xl mx-auto px-4 py-20">
            <div className="surface p-10 text-center space-y-5 shadow-glow">
              <div className="text-sentinel-gray-1 text-3xl">⬡</div>
              <div>
                <p className="font-mono text-sm text-sentinel-white">Agent not under Sentinel protection</p>
                <p className="font-mono text-xs text-sentinel-gray-1 mt-2 break-all">{agent}</p>
              </div>
              <a
                href="/onboard"
                className="inline-block font-mono text-xs tracking-widest uppercase px-6 py-3 text-sentinel-white bg-sentinel-blue/90 border border-sentinel-blue shadow-glow hover:bg-sentinel-blue hover:shadow-glow-cyan transition-all"
              >
                Wrap this agent →
              </a>
            </div>
          </div>
        </main>
      </>
    );
  }

  const expBase = NETWORKS[net].explorerBase;
  const mntFormatted = formatUnits(data.nativeMntBalance, 18);

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-8">

          {/* Tripped alert banner */}
          {data.isPaused && (
            <div className="surface glow-box-danger border-sentinel-danger/60 bg-sentinel-danger/[0.06] p-4 flex items-center gap-3 animate-fade-up">
              <span className="text-sentinel-danger text-xl animate-pulse">⚡</span>
              <div className="font-mono text-xs">
                <p className="text-sentinel-danger font-bold tracking-wide">CIRCUIT BREAKER TRIPPED</p>
                <p className="text-sentinel-gray-1 mt-0.5">
                  This agent is paused. Funds are protected and can be rescued to the time-locked EmergencyVault.
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex gap-5 items-start animate-fade-up">
            {data.metadata?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.metadata.image}
                alt={data.metadata.name ?? 'agent'}
                className="w-20 h-20 border border-sentinel-blue/30 object-cover shrink-0 shadow-glow"
              />
            ) : (
              <div className="w-20 h-20 border border-sentinel-gray-2 shrink-0 flex items-center justify-center text-sentinel-cyan text-2xl shadow-glow bg-white/[0.02]">
                ◈
              </div>
            )}
            <div className="space-y-2.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-sans font-bold text-2xl text-sentinel-white tracking-tight">
                  {data.metadata?.name ?? 'Guarded Agent'}
                </h1>
                <StatusBadge paused={data.isPaused} active={data.config?.active ?? false} />
              </div>
              <p className="font-mono text-xs text-sentinel-gray-1 break-all">{agent}</p>
              {data.metadata?.description && (
                <p className="font-mono text-xs text-sentinel-gray-1 leading-relaxed">
                  {data.metadata.description}
                </p>
              )}
              <div className="flex gap-2 flex-wrap pt-1">
                <span className="font-mono text-[10px] text-sentinel-gray-1 border border-sentinel-gray-2 px-2 py-0.5">
                  Token #{data.config?.erc8004TokenId?.toString() ?? '—'}
                </span>
                {data.daysGuarded > 0 && (
                  <span className="font-mono text-[10px] text-sentinel-gray-1 border border-sentinel-gray-2 px-2 py-0.5">
                    Guarded {data.daysGuarded}d
                  </span>
                )}
                <a
                  href={`${expBase}/address/${agent}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-sentinel-blue hover:text-sentinel-cyan transition-colors border border-sentinel-blue/30 px-2 py-0.5"
                >
                  Mantlescan ↗
                </a>
              </div>
            </div>
          </div>

          {/* AI incident / status report (DGrid haiku) */}
          <AiIncidentReport agent={agent} net={net} paused={data.isPaused} />

          {/* Top grid: Reputation + Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reputation */}
            <div className="surface p-5 space-y-2">
              <p className="eyebrow">Reputation</p>
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
            <div className="surface p-5 space-y-3">
              <p className="eyebrow">Guard Balance</p>
              <div>
                <span className="font-mono font-bold text-3xl text-sentinel-cyan glow-blue tabular-nums">
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-mono font-bold text-xs text-sentinel-white uppercase tracking-[0.2em]">
                  Safety Rules
                </h2>
                {data.owner && (
                  <RulesEditorButton
                    rulesAddress={data.config.rulesContract}
                    owner={data.owner}
                    rules={data.rules}
                  />
                )}
              </div>
              <SafetyRulesDisplay
                rules={data.rules}
                rulesAddress={data.config.rulesContract}
                explorerBase={expBase}
              />
            </div>
          )}

          {/* Reputation events */}
          {data.reputation && data.reputation.history.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-mono font-bold text-xs text-sentinel-white uppercase tracking-[0.2em]">
                Reputation History
              </h2>
              <div className="surface overflow-hidden">
                <div className="grid grid-cols-[1fr_72px_72px] gap-2 px-4 py-2 border-b border-sentinel-gray-2 bg-white/[0.02] font-mono text-[10px] uppercase tracking-wider text-sentinel-gray-1">
                  <span>Date</span>
                  <span className="text-right">Δ</span>
                  <span className="text-right">Score</span>
                </div>
                {data.reputation.history.map((h, i) => {
                  const positive = h.delta >= 0;
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_72px_72px] gap-2 items-center px-4 py-2.5 font-mono text-xs border-b border-sentinel-gray-2/40 last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="text-sentinel-gray-1 flex items-center gap-2">
                        <span className={cn('h-1.5 w-1.5 rounded-full', positive ? 'bg-emerald-400' : 'bg-sentinel-danger')} />
                        {new Date(Number(h.timestamp) * 1000).toLocaleDateString()}
                      </span>
                      <span className={cn('text-right font-bold tabular-nums', positive ? 'text-emerald-400' : 'text-sentinel-danger')}>
                        {positive ? '+' : ''}{h.delta}
                      </span>
                      <span className="text-right text-sentinel-white tabular-nums">{h.scoreAfter}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
