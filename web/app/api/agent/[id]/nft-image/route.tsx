import { ImageResponse } from 'next/og';
import { isAddress, getAddress } from 'viem';
import { fetchAgentDetail } from '@/lib/agent-data';
import { toNetKey, NETWORKS } from '@/lib/networks';

// Dynamic NFT/card image for a guarded agent. The on-chain identity NFT has an
// empty tokenURI (the registry doesn't override it), so this is the branded
// image our app + the ERC-8004 registration file use instead of a blank.
// edge runtime: @vercel/og loads its bundled font correctly here (the node
// runtime hits a font-path bug on Windows). fetchAgentDetail is fetch-based
// (viem http), so it runs on edge. Uncached fetcher avoids unstable_cache's
// BigInt-serialization error.

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
): Promise<ImageResponse> {
  const net = toNetKey(new URL(req.url).searchParams.get('net'));
  const cfg = NETWORKS[net];
  const valid = isAddress(params.id);
  const agent = valid ? getAddress(params.id) : '0x0000000000000000000000000000000000000000';
  const short = `${agent.slice(0, 6)}...${agent.slice(-4)}`;

  const data = valid ? await fetchAgentDetail(agent, net) : null;
  const guarded = data?.isGuarded ?? false;
  const active = data?.config?.active ?? false;
  const paused = data?.isPaused ?? false;

  const status = !guarded
    ? 'UNGUARDED'
    : !active
      ? 'DEREGISTERED'
      : paused
        ? 'CIRCUIT TRIPPED'
        : 'GUARDED';
  const accent = !guarded || !active ? '#737373' : paused ? '#ef4444' : '#22d3ee';
  const name = data?.metadata?.name ?? (guarded ? 'Guarded Agent' : 'Sentinel Agent');
  const tokenId = data?.config ? data.config.erc8004TokenId.toString() : null;
  const drawdownPct = data?.rules ? Number(data.rules.maxDrawdownBps) / 100 : null;
  const rep = data?.reputation ? Number(data.reputation.score) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '512px',
          height: '512px',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: 'monospace',
          color: '#fafafa',
          border: `2px solid ${accent}`,
          padding: '36px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '18px',
            letterSpacing: '0.2em',
            fontWeight: 700,
          }}
        >
          <div style={{ display: 'flex' }}>SENTINEL</div>
          <div style={{ display: 'flex', color: '#22d3ee', fontSize: '13px' }}>ON MANTLE</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '92px',
              height: '92px',
              border: `6px solid ${accent}`,
              transform: 'rotate(45deg)',
              display: 'flex',
            }}
          />
          <div style={{ display: 'flex', fontSize: '30px', fontWeight: 700 }}>{name}</div>
          <div style={{ display: 'flex', fontSize: '17px', color: '#737373' }}>
            {tokenId !== null ? `${short}  ·  Token #${tokenId}` : short}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '19px',
              fontWeight: 700,
              color: accent,
              border: `1px solid ${accent}`,
              padding: '6px 18px',
              letterSpacing: '0.15em',
            }}
          >
            {status}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '15px',
            color: '#a3a3a3',
          }}
        >
          <div style={{ display: 'flex' }}>
            {drawdownPct !== null ? `Max drawdown ${drawdownPct}%` : 'ERC-8004 identity'}
          </div>
          <div style={{ display: 'flex' }}>{rep !== null ? `Reputation ${rep}` : cfg.label}</div>
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
