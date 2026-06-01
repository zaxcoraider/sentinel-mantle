'use client';

import Link from 'next/link';
import { useOnboardStore } from '@/lib/store/onboard-store';
import { EXPLORER_BASE } from '@/lib/network';

export function Step6Success() {
  const store = useOnboardStore();
  const { selectedAgent, registeredTxHash, deployedRulesAddress } = store;

  const explorerBase = EXPLORER_BASE;
  const agentUrl = selectedAgent ? `/agent/${selectedAgent}` : '/dashboard';

  const tweetText = encodeURIComponent(
    `Just wrapped my AI agent with @SentinelGuard on @0xMantle. Circuit breaker deployed.\n\nAgent: ${selectedAgent?.slice(0, 10)}…\nRules: ${deployedRulesAddress?.slice(0, 10)}…\n\nsee it live →`,
  );

  return (
    <div className="space-y-6 py-4">
      <div className="surface p-6 space-y-3" style={{ boxShadow: '0 0 30px -8px rgba(52,211,153,0.35)' }}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-400/10 text-emerald-400 text-lg">
            ✓
          </span>
          <p className="font-mono text-[11px] text-emerald-400 tracking-[0.2em] uppercase">
            Agent guarded
          </p>
        </div>
        <h2 className="font-sans font-bold text-2xl text-sentinel-white tracking-tight">
          Sentinel is watching.
        </h2>
        <p className="text-sm text-sentinel-gray-1 leading-relaxed">
          Your agent is now protected. The monitor will pause it before any rule
          violation compounds.
        </p>
      </div>

      <div className="surface p-4 font-mono text-xs space-y-2">
        <div className="flex justify-between text-sentinel-gray-1">
          <span>Agent address</span>
          <span className="text-sentinel-white truncate max-w-[240px]">{selectedAgent ?? '—'}</span>
        </div>
        {deployedRulesAddress && (
          <div className="flex justify-between text-sentinel-gray-1">
            <span>SafetyRules contract</span>
            <a
              href={`${explorerBase}/address/${deployedRulesAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sentinel-blue hover:underline"
            >
              {deployedRulesAddress.slice(0, 10)}… ↗
            </a>
          </div>
        )}
        {registeredTxHash && (
          <div className="flex justify-between text-sentinel-gray-1">
            <span>Registration tx</span>
            <a
              href={`${explorerBase}/tx/${registeredTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sentinel-blue hover:underline"
            >
              {registeredTxHash.slice(0, 10)}… ↗
            </a>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={agentUrl}
          className="flex-1 text-center font-mono text-xs tracking-widest uppercase px-6 py-3 text-sentinel-white bg-sentinel-blue/90 border border-sentinel-blue shadow-glow hover:bg-sentinel-blue hover:shadow-glow-cyan transition-all"
        >
          View agent dashboard →
        </Link>
        <a
          href={`https://x.com/intent/tweet?text=${tweetText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center font-mono text-xs px-6 py-3 border border-sentinel-gray-2 text-sentinel-gray-1 hover:text-sentinel-white hover:border-sentinel-white transition-colors"
        >
          Share on X
        </a>
      </div>

      <button
        onClick={() => store.reset()}
        className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors"
      >
        Wrap another agent →
      </button>
    </div>
  );
}
