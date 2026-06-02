import { NextResponse } from 'next/server';
import { isAddress, getAddress } from 'viem';
import { getAgentDetail } from '@/lib/agent-data';
import { NETWORKS, toNetKey } from '@/lib/networks';

// ERC-8004 Agent Registration File — the JSON an identity's tokenURI resolves
// to (EIP-8004). We serve it over HTTPS so a Sentinel-guarded agent is a
// browsable, indexable ERC-8004 citizen. Standard top-level fields per the
// spec, plus a namespaced `sentinel` extension carrying the on-chain safety
// attestation (the part that makes this a *guarded* agent).
//
// GET /api/agent/<agentAddress>/registration?net=mainnet|sepolia

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGISTRATION_TYPE =
  'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const raw = params.id;
  if (!isAddress(raw)) {
    return NextResponse.json({ error: 'Invalid agent address.' }, { status: 400 });
  }
  const agent = getAddress(raw);

  const net = toNetKey(new URL(req.url).searchParams.get('net'));
  const cfg = NETWORKS[net];

  const data = await getAgentDetail(agent, net);
  if (!data.isGuarded || !data.config) {
    return NextResponse.json(
      { error: `Not a Sentinel-guarded agent on ${cfg.label}.` },
      { status: 404 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentsentinel.space';
  const short = `${agent.slice(0, 6)}...${agent.slice(-4)}`;
  const expl = cfg.explorerBase;

  const safetyRules = data.rules
    ? {
        maxDrawdownBps: Number(data.rules.maxDrawdownBps),
        maxTxPerHour: Number(data.rules.maxTxPerHour),
        oracleDeviationBps: Number(data.rules.oracleDeviationBps),
        dailyVolumeCapUsd: Number(data.rules.dailyVolumeCapUsd),
        activeHoursUtc: [data.rules.timeOfDayMin, data.rules.timeOfDayMax],
        allowedProtocolCount: Number(data.rules.allowedProtocolCount),
      }
    : null;

  const reputation = data.reputation
    ? {
        score: Number(data.reputation.score),
        eventCount: Number(data.reputation.eventCount),
        lastUpdated: Number(data.reputation.lastUpdated),
      }
    : null;

  const status = !data.config.active
    ? 'deregistered'
    : data.isPaused
      ? 'circuit-tripped'
      : 'guarded';

  const description =
    data.metadata?.description ??
    `Autonomous agent ${short} guarded by Sentinel on ${cfg.label}. Sentinel is a ` +
      `non-custodial circuit breaker: it enforces on-chain SafetyRules (drawdown, ` +
      `transaction rate, protocol allowlist, oracle deviation) and auto-pauses the ` +
      `agent (rescuing its funds to a time-locked vault) the moment it misbehaves.`;

  const registration = {
    type: REGISTRATION_TYPE,
    name: data.metadata?.name ?? `Sentinel-guarded agent ${short}`,
    description,
    image: data.metadata?.image ?? `${appUrl}/logo-mark.png`,
    active: data.config.active && !data.isPaused,
    x402Support: false,
    services: [
      {
        name: 'Sentinel Dashboard',
        endpoint: `${appUrl}/agent/${agent}?net=${net}`,
      },
    ],
    registrations: [
      {
        agentId: data.config.erc8004TokenId.toString(),
        agentAddress: agent,
        agentRegistry: cfg.deployments.AgentIdentityRegistry,
        chainId: cfg.chainId,
      },
    ],
    supportedTrust: reputation ? ['reputation'] : [],
    // Sentinel extension — the on-chain safety attestation. Namespaced so it
    // never collides with standard ERC-8004 fields.
    sentinel: {
      guarded: true,
      paused: data.isPaused,
      status,
      network: cfg.label,
      chainId: cfg.chainId,
      owner: data.owner,
      daysGuarded: data.daysGuarded,
      registry: cfg.deployments.AgentRegistry,
      guardContract: data.config.guardContract,
      rulesContract: data.config.rulesContract,
      safetyRules,
      reputation,
      explorer: {
        agent: `${expl}/address/${agent}`,
        guard: `${expl}/address/${data.config.guardContract}`,
        rules: `${expl}/address/${data.config.rulesContract}`,
      },
    },
  };

  return NextResponse.json(registration, {
    headers: {
      // Public, machine-readable metadata — allow cross-origin reads by indexers.
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=30, s-maxage=30',
    },
  });
}
