'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useSwitchChain } from 'wagmi';
import { NET_COOKIE, NET_KEYS, NETWORKS, DEFAULT_NET, toNetKey, type NetKey } from '@/lib/networks';
import { readNetCookie } from '@/lib/hooks/use-client-net';
import { cn } from '@/lib/utils';

// Site-wide network switch. Persists the choice in a cookie (so server-rendered
// pages read it), switches the connected wallet's chain, and refreshes the route
// so the new network's data loads. Lets users try everything on free Sepolia
// before trusting real funds on Mainnet.
export function NetworkToggle() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const [net, setNet] = useState<NetKey>(DEFAULT_NET);

  useEffect(() => {
    setNet(toNetKey(readNetCookie()));
  }, []);

  const pick = (k: NetKey): void => {
    if (k === net) return;
    document.cookie = `${NET_COOKIE}=${k};path=/;max-age=31536000;samesite=lax`;
    setNet(k);
    if (isConnected && switchChain) {
      try {
        switchChain({ chainId: NETWORKS[k].chainId });
      } catch {
        /* user can switch manually in the wallet */
      }
    }
    router.refresh();
  };

  return (
    <div
      className="flex items-center border border-sentinel-gray-2 overflow-hidden font-mono text-[10px]"
      role="group"
      aria-label="Select network"
    >
      {NET_KEYS.map((k) => {
        const active = net === k;
        return (
          <button
            key={k}
            onClick={() => pick(k)}
            aria-pressed={active}
            className={cn(
              'px-2.5 py-1 uppercase tracking-wide transition-colors flex items-center gap-1.5',
              active
                ? 'bg-sentinel-blue/15 text-sentinel-cyan'
                : 'text-sentinel-gray-1 hover:text-sentinel-white',
            )}
          >
            {active && <span className="h-1.5 w-1.5 rounded-full bg-sentinel-cyan animate-glow-pulse" />}
            {NETWORKS[k].short}
          </button>
        );
      })}
    </div>
  );
}
