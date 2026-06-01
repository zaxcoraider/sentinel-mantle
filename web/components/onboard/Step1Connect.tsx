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
    <div className="py-4">
      <div className="surface shadow-glow p-8 text-center space-y-5">
        <div className="text-sentinel-cyan text-3xl">◈</div>
        <div>
          <h2 className="font-sans font-bold text-xl text-sentinel-white">Connect your wallet</h2>
          <p className="mt-2 text-sm text-sentinel-gray-1 max-w-sm mx-auto leading-relaxed">
            You need a wallet to register your ERC-8004 agent with Sentinel and deploy its safety rules.
          </p>
        </div>
        <div className="flex justify-center">
          <ConnectButton variant="primary" />
        </div>
      </div>
    </div>
  );
}
