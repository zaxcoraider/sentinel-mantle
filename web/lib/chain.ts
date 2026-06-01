// Server-side viem public clients for SSR data fetching, one per network.
// Never import this in client components — use wagmi hooks there instead.
import { createPublicClient, fallback, http, type PublicClient } from 'viem';
import { NETWORKS, DEFAULT_NET, type NetKey } from './networks';

const cache = new Map<NetKey, PublicClient>();

export function publicClientFor(net: NetKey): PublicClient {
  const hit = cache.get(net);
  if (hit) return hit;
  const cfg = NETWORKS[net];
  const client = createPublicClient({
    chain: cfg.chain,
    transport: fallback([http(cfg.primaryRpc), http(cfg.fallbackRpc)]),
  }) as PublicClient;
  cache.set(net, client);
  return client;
}

// Default client (used where no explicit network is selected).
export const publicClient = publicClientFor(DEFAULT_NET);
