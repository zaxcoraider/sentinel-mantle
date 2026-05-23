// Client-only wagmi + RainbowKit config. Never import in server components.
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mantleSepolia } from './chains';

export { mantleSepolia, mantleMainnet } from './chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'Sentinel',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'demo',
  chains: [mantleSepolia],
  transports: { [mantleSepolia.id]: http() },
  ssr: true,
});
