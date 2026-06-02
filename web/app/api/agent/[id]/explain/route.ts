import { NextResponse } from 'next/server';
import { isAddress, getAddress } from 'viem';
import { chat, fastModel, DgridError, type ChatMessage } from '@/lib/ai/dgrid';
import { getAgentDetail } from '@/lib/agent-data';
import { NETWORKS, toNetKey } from '@/lib/networks';

// AI incident explainer — turns a guarded agent's on-chain state into a short
// plain-English status/incident note using the fast DGrid model (haiku).
// Read-only and non-authoritative: it only *describes* state the contracts
// already decided. GET /api/agent/<address>/explain?net=mainnet|sepolia

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENT_NAMES = [
  'CleanDay',
  'RuleViolation',
  'CircuitBreaker',
  'SuccessfulRecovery',
  'SlashingEvent',
] as const;

const eventName = (ordinal: number): string =>
  EVENT_NAMES[ordinal] ?? `Event#${ordinal}`;

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!isAddress(params.id)) {
    return NextResponse.json({ error: 'Invalid agent address.' }, { status: 400 });
  }
  const agent = getAddress(params.id);
  const net = toNetKey(new URL(req.url).searchParams.get('net'));
  const cfg = NETWORKS[net];

  const data = await getAgentDetail(agent, net);
  if (!data.isGuarded || !data.config) {
    return NextResponse.json(
      { error: `Not a Sentinel-guarded agent on ${cfg.label}.` },
      { status: 404 },
    );
  }

  const status = !data.config.active
    ? 'deregistered'
    : data.isPaused
      ? 'circuit-tripped'
      : 'guarded';

  // Compact, factual snapshot for the model. We do NOT feed it free rein —
  // it must ground its prose only in these facts and invent no numbers.
  const facts = {
    network: cfg.label,
    status,
    daysGuarded: data.daysGuarded,
    rules: data.rules
      ? {
          maxDrawdownPct: Number(data.rules.maxDrawdownBps) / 100,
          maxTxPerHour: Number(data.rules.maxTxPerHour),
          oracleDeviationPct: Number(data.rules.oracleDeviationBps) / 100,
          dailyVolumeCapUsd: Number(data.rules.dailyVolumeCapUsd),
          activeHoursUtc: `${data.rules.timeOfDayMin}:00-${data.rules.timeOfDayMax}:00`,
          allowedProtocolCount: Number(data.rules.allowedProtocolCount),
        }
      : null,
    reputation: data.reputation
      ? {
          score: Number(data.reputation.score),
          eventCount: Number(data.reputation.eventCount),
          recentEvents: data.reputation.history
            .slice(-4)
            .map((h) => eventName(h.eventType)),
        }
      : null,
  };

  const systemPrompt = `You are Sentinel's incident analyst. Sentinel is a non-custodial circuit breaker for autonomous on-chain AI agents on Mantle. Given a factual JSON snapshot of one guarded agent, write a SHORT plain-English status note for a dashboard.

Strict rules:
- Use ONLY the facts provided. Do NOT invent numbers, percentages, dollar amounts, times, or causes that are not in the JSON.
- 1-2 sentences, <= 45 words, calm security-ops tone. No preamble, no markdown, output only the note.
- If status is "circuit-tripped": state that Sentinel's monitor paused the agent for a safety-rule breach and that its funds are protected (rescuable to the time-locked vault). Reference a specific rule ONLY if the recentEvents/rules clearly imply it; otherwise speak generally.
- If status is "guarded": one reassuring line noting it is operating within its on-chain SafetyRules (you may mention which limits are active).
- If status is "deregistered": note it is no longer under Sentinel protection.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify(facts) },
  ];

  let explanation: string;
  try {
    explanation = (await chat(messages, { model: fastModel(), maxTokens: 160 })).trim();
  } catch (e) {
    const code = e instanceof DgridError ? e.status : 502;
    const message = e instanceof Error ? e.message : 'AI request failed.';
    return NextResponse.json({ error: message }, { status: code });
  }

  return NextResponse.json(
    { status, explanation },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } },
  );
}
