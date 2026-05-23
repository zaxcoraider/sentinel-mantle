'use client';

import { useOnboardStore } from '@/lib/store/onboard-store';
import { ConnectButton } from '@/components/ConnectButton';
import { useAccount } from 'wagmi';
import { useEffect } from 'react';

export function Step1Connect() {
  const { isConnected } = useAccount();
  const setStep = useOnboardStore((s) => s.setStep);

  useEffect(() => {
    if (isConnected) setStep(2);
  }, [isConnected, setStep]);

  return (
    <div className="space-y-6 py-4">
      <div>
        <h2 className="font-mono font-bold text-lg text-sentinel-white">
          Connect your wallet
        </h2>
        <p className="mt-1 text-sm text-sentinel-gray-1">
          You need a wallet to register your ERC-8004 agent with Sentinel.
        </p>
      </div>
      <ConnectButton />
    </div>
  );
}
