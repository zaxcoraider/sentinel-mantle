'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPublicClient, fallback, http, type PublicClient } from 'viem';
import { NET_COOKIE, DEFAULT_NET, NETWORKS, toNetKey, type NetKey } from '../networks';

export function readNetCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp('(?:^|; )' + NET_COOKIE + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}

// Selected network on the client. Starts at DEFAULT_NET for SSR/hydration parity,
// then syncs to the cookie after mount.
export function useClientNet(): NetKey {
  const [net, setNet] = useState<NetKey>(DEFAULT_NET);
  useEffect(() => {
    setNet(toNetKey(readNetCookie()));
  }, []);
  return net;
}

// A read-only viem client bound to the SELECTED network (cookie), independent of
// the wallet's connected chain — so data reads always match the toggle even if
// the wallet is momentarily on a different chain.
export function useNetPublicClient(): { net: NetKey; client: PublicClient } {
  const net = useClientNet();
  const client = useMemo(() => {
    const cfg = NETWORKS[net];
    return createPublicClient({
      chain: cfg.chain,
      transport: fallback([http(cfg.primaryRpc), http(cfg.fallbackRpc)]),
    }) as PublicClient;
  }, [net]);
  return { net, client };
}
