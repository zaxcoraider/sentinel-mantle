// Client-only wagmi + RainbowKit config. Never import in server components.
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mantleMainnet, mantleSepolia } from './chains';
import { IS_MAINNET } from './network';

export { mantleSepolia, mantleMainnet } from './chains';

// Active network first (= the default the wallet is prompted to use); keep the
// other Mantle network available so wrong-network detection still works.
const chains = IS_MAINNET
  ? ([mantleMainnet, mantleSepolia] as const)
  : ([mantleSepolia, mantleMainnet] as const);

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
