import { NextResponse } from 'next/server';
import { isAddress, getAddress } from 'viem';
import { fetchAgentDetail } from '@/lib/agent-data';
import { NETWORKS, toNetKey } from '@/lib/networks';

// ERC-721-style metadata JSON for a guarded agent, with a generated image (the
// on-chain tokenURI is empty). GET /api/agent/<address>/nft?net=mainnet|sepolia

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Attribute {
  trait_type: string;
  value: string | number;
}

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentsentinel.space';
  const short = `${agent.slice(0, 6)}...${agent.slice(-4)}`;

  const data = await fetchAgentDetail(agent, net);
  const status = !data.isGuarded
    ? 'unguarded'
    : !data.config?.active
      ? 'deregistered'
      : data.isPaused
        ? 'circuit-tripped'
        : 'guarded';

  const attributes: Attribute[] = [
    { trait_type: 'Status', value: status },
    { trait_type: 'Network', value: cfg.label },
    { trait_type: 'Agent Address', value: agent },
  ];
  if (data.config) attributes.push({ trait_type: 'Token ID', value: data.config.erc8004TokenId.toString() });
  if (data.rules) {
    attributes.push({ trait_type: 'Max Drawdown %', value: Number(data.rules.maxDrawdownBps) / 100 });
    attributes.push({ trait_type: 'Max Tx / Hour', value: Number(data.rules.maxTxPerHour) });
  }
  if (data.reputation) attributes.push({ trait_type: 'Reputation', value: Number(data.reputation.score) });

  return NextResponse.json(
    {
      name: data.metadata?.name ?? `Sentinel Agent ${short}`,
      description: `Autonomous agent ${short} guarded by Sentinel on ${cfg.label} - a non-custodial circuit breaker enforcing on-chain SafetyRules.`,
      image: `${appUrl}/api/agent/${agent}/nft-image?net=${net}`,
      external_url: `${appUrl}/agent/${agent}?net=${net}`,
      attributes,
    },
    { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60, s-maxage=60' } },
  );
}
