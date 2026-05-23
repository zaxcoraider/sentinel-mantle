import type { SafetyRulesConfig } from '@/lib/agent-data';
import { DEPLOYMENTS } from '@/lib/contracts';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-sentinel-gray-2/50 last:border-0">
      <span className="font-mono text-xs text-sentinel-gray-1">{label}</span>
      <span className="font-mono text-xs text-sentinel-white">{value}</span>
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
    <div className="border border-sentinel-gray-2 p-4 space-y-0">
      <Row label="Max drawdown" value={`${Number(rules.maxDrawdownBps) / 100}%`} />
      <Row label="Max tx/hour" value={String(rules.maxTxPerHour)} />
      <Row label="Oracle deviation" value={`${Number(rules.oracleDeviationBps) / 100}%`} />
      <Row label="Daily volume cap" value={`$${Number(rules.dailyVolumeCapUsd).toLocaleString()}`} />
      <Row label="Active hours (UTC)" value={`${rules.timeOfDayMin}:00 – ${rules.timeOfDayMax}:00`} />
      <Row label="Allowed protocols" value={String(rules.allowedProtocolCount)} />
      <Row
        label="Rules contract"
        value={rulesAddress.slice(0, 10) + '…'}
      />
      <div className="pt-2">
        <a
          href={`${DEPLOYMENTS.sepolia.explorerBase}/address/${rulesAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-sentinel-blue hover:underline"
        >
          View on Mantlescan ↗
        </a>
      </div>
    </div>
  );
}
