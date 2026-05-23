// Server-side viem public client for SSR data fetching.
// Never import this in client components — use wagmi hooks there instead.
import { createPublicClient, http } from 'viem';
import { mantleSepolia } from './chains';

export const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http(
    process.env.MANTLE_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.mantle.xyz',
  ),
});
