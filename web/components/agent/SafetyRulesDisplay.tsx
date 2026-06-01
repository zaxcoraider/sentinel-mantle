import type { SafetyRulesConfig } from '@/lib/agent-data';
import { EXPLORER_BASE } from '@/lib/network';

function RuleTile({ glyph, label, value }: { glyph: string; label: string; value: string }) {
  return (
    <div className="surface p-3.5">
      <div className="flex items-center gap-2 text-sentinel-gray-1">
        <span className="text-sentinel-cyan text-sm leading-none">{glyph}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className="font-mono text-base font-bold text-sentinel-white mt-2 tabular-nums">{value}</p>
    </div>
  );
}

export function SafetyRulesDisplay({
  rules,
  rulesAddress,
}: {
  rules: SafetyRulesConfig;
  rulesAddress: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <RuleTile glyph="↘" label="Max Drawdown" value={`${Number(rules.maxDrawdownBps) / 100}%`} />
        <RuleTile glyph="⚡" label="Max Tx / Hour" value={String(rules.maxTxPerHour)} />
        <RuleTile glyph="◎" label="Oracle Deviation" value={`${Number(rules.oracleDeviationBps) / 100}%`} />
        <RuleTile glyph="$" label="Daily Volume Cap" value={`$${Number(rules.dailyVolumeCapUsd).toLocaleString()}`} />
        <RuleTile glyph="◷" label="Active Hours UTC" value={`${rules.timeOfDayMin}:00–${rules.timeOfDayMax}:00`} />
        <RuleTile glyph="⬡" label="Allowed Protocols" value={String(rules.allowedProtocolCount)} />
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] text-sentinel-gray-1 px-1">
        <span>
          rules contract <span className="text-sentinel-white">{rulesAddress.slice(0, 10)}…</span>
        </span>
        <a
          href={`${EXPLORER_BASE}/address/${rulesAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sentinel-blue hover:underline"
        >
          View on Mantlescan ↗
        </a>
      </div>
    </div>
  );
}
