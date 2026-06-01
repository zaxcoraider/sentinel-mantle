// Server-side viem public client for SSR data fetching.
// Never import this in client components — use wagmi hooks there instead.
import { createPublicClient, fallback, http } from 'viem';
import { ACTIVE_CHAIN, PRIMARY_RPC, FALLBACK_RPC } from './network';

export const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: fallback([http(PRIMARY_RPC), http(FALLBACK_RPC)]),
});
