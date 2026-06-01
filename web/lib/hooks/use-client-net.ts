'use client';

import { useEffect, useState } from 'react';
import { NET_COOKIE, DEFAULT_NET, toNetKey, type NetKey } from '../networks';

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
