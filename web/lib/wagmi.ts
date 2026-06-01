// Client-only wagmi + RainbowKit config. Never import in server components.
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mantleMainnet, mantleSepolia } from './chains';
import { DEFAULT_NET } from './networks';

export { mantleSepolia, mantleMainnet } from './chains';

// Default network first (= what the wallet is prompted to use); both Mantle
// networks are supported so the in-app toggle can switch between them.
const chains =
  DEFAULT_NET === 'sepolia'
    ? ([mantleSepolia, mantleMainnet] as const)
    : ([mantleMainnet, mantleSepolia] as const);

export const wagmiConfig = getDefaultConfig({
  appName: 'Sentinel',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'demo',
  chains,
  transports: {
    [mantleMainnet.id]: http(),
    [mantleSepolia.id]: http(),
  },
  ssr: true,
});
