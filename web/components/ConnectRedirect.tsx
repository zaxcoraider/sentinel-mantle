'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

// After the user connects from the landing page, send them to /dashboard.
// The dashboard shows an onboard CTA if they have no agents.
export function ConnectRedirect() {
  const router = useRouter();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard');
    }
  }, [isConnected, router]);

  return null;
}
