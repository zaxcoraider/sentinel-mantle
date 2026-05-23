// Pure viem chain definitions — no RainbowKit, safe for server and client.
import { defineChain } from 'viem';

export const mantleSepolia = defineChain({
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL ??
          'https://rpc.sepolia.mantle.xyz',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantlescan',
      url: 'https://explorer.sepolia.mantle.xyz',
    },
  },
  testnet: true,
});

export const mantleMainnet = defineChain({
  id: 5000,
  name: 'Mantle',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_MANTLE_RPC_URL ?? 'https://rpc.mantle.xyz',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Mantlescan', url: 'https://mantlescan.xyz' },
  },
});
