'use client';

import { useState } from 'react';
import { Nav } from '@/components/Nav';
import { COMMON_PROTOCOLS } from '@/lib/protocols';

interface Rules {
  maxDrawdownBps: number;
  maxTxPerHour: number;
  oracleDeviationBps: number;
  dailyVolumeCapUsd: number;
  timeOfDayMin: number;
  timeOfDayMax: number;
  allowedProtocols: string[];
}

interface ParseResponse {
  rules?: Rules;
  notes?: string;
  error?: string;
}

const EXAMPLES = [
  "Don't lose more than 15% in a day, only Merchant Moe and Agni, max 10 swaps an hour, and pause if a stablecoin depegs 2%.",
  'Conservative stable-yield bot: 5% max drawdown, 20 tx/hour, trade only 9:00-17:00 UTC.',
  'Aggressive copy-trading agent: allow up to 40% drawdown, 200 tx/hour, any protocol.',
];

const labelForProtocol = (addr: string): string =>
  COMMON_PROTOCOLS.find((p) => p.address.toLowerCase() === addr.toLowerCase())?.label ??
  `${addr.slice(0, 6)}...${addr.slice(-4)}`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-4">
      <p className="eyebrow">{label}</p>
      <p className="font-mono text-lg text-sentinel-cyan glow-blue tabular-nums mt-1">{value}</p>
    </div>
  );
}

export default function PlaygroundPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<Rules | null>(null);
  const [notes, setNotes] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const run = async (prompt?: string) => {
    const body = (prompt ?? text).trim();
    if (body.length < 3) return;
    if (prompt) setText(prompt);
    setLoading(true);
    setError(undefined);
    setNotes(undefined);
    setRules(null);
    try {
      const res = await fetch('/api/parse-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      });
      const data = (await res.json()) as ParseResponse;
      if (!res.ok || !data.rules) {
        setError(data.error ?? 'Could not generate rules. Try again.');
        return;
      }
      setRules(data.rules);
      setNotes(data.notes);
    } catch {
      setError('Network error reaching the AI. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 space-y-6">
          <div>
            <p className="eyebrow text-sentinel-cyan">✦ AI Rule Builder</p>
            <h1 className="font-sans font-bold text-3xl text-sentinel-white tracking-tight mt-1">
              Describe your agent&apos;s risk limits in plain English
            </h1>
            <p className="text-sm text-sentinel-gray-1 mt-2 leading-relaxed">
              Sentinel uses Claude (via the DGrid AI gateway) to compile a sentence into an
              on-chain <span className="text-sentinel-white">SafetyRules</span> config — the same
              step that powers onboarding. No wallet needed; try it below.
            </p>
          </div>

          <div className="surface px-4 py-4 border border-sentinel-cyan/30 glow-box-cyan space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="e.g. Don't let it lose more than 15% in a day, only trade on Merchant Moe and Agni, max 10 swaps an hour."
              className="w-full font-mono text-xs bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-cyan px-3 py-2 outline-none text-sentinel-white resize-none"
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => run(ex)}
                  disabled={loading}
                  className="font-mono text-[10px] text-sentinel-gray-1 border border-sentinel-gray-2 px-2 py-1 hover:border-sentinel-cyan/60 hover:text-sentinel-white transition-colors disabled:opacity-40"
                >
                  {ex.slice(0, 38)}…
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => run()}
              disabled={loading || text.trim().length < 3}
              className="font-mono text-xs tracking-widest uppercase px-5 py-2.5 text-sentinel-white bg-sentinel-cyan/20 border border-sentinel-cyan/60 hover:bg-sentinel-cyan/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Compiling…' : 'Generate rules with AI'}
            </button>
            {error && <p className="font-mono text-xs text-sentinel-danger">{error}</p>}
          </div>

          {rules && (
            <div className="space-y-4 animate-fade-up">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat label="Max drawdown" value={`${rules.maxDrawdownBps / 100}%`} />
                <Stat label="Max tx / hour" value={`${rules.maxTxPerHour}`} />
                <Stat label="Oracle deviation" value={`${rules.oracleDeviationBps / 100}%`} />
                <Stat
                  label="Daily volume cap"
                  value={`$${rules.dailyVolumeCapUsd.toLocaleString()}`}
                />
                <Stat
                  label="Active hours (UTC)"
                  value={`${rules.timeOfDayMin}:00–${rules.timeOfDayMax}:00`}
                />
                <Stat
                  label="Allowed protocols"
                  value={
                    rules.allowedProtocols.length === 0
                      ? 'Any'
                      : `${rules.allowedProtocols.length}`
                  }
                />
              </div>
              {rules.allowedProtocols.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {rules.allowedProtocols.map((a) => (
                    <span
                      key={a}
                      className="font-mono text-[10px] text-sentinel-white border border-sentinel-cyan/40 px-2 py-0.5"
                    >
                      {labelForProtocol(a)}
                    </span>
                  ))}
                </div>
              )}
              {notes && (
                <div className="surface p-4">
                  <p className="eyebrow text-sentinel-cyan">AI notes</p>
                  <p className="font-mono text-xs text-sentinel-gray-1 leading-relaxed mt-1">
                    {notes}
                  </p>
                </div>
              )}
              <p className="font-mono text-[10px] text-sentinel-gray-1 text-center">
                In onboarding, this prefills your agent&apos;s on-chain SafetyRules — which you
                review and deploy yourself.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
