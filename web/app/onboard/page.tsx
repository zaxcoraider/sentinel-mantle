'use client';

import { useOnboardStore } from '@/lib/store/onboard-store';
import { Stepper } from '@/components/onboard/Stepper';
import { Step1Connect } from '@/components/onboard/Step1Connect';
import { Step2Agent } from '@/components/onboard/Step2Agent';
import { Step3Rules } from '@/components/onboard/Step3Rules';
import { Step4Deposit } from '@/components/onboard/Step4Deposit';
import { Step5Confirm } from '@/components/onboard/Step5Confirm';
import { Step6Success } from '@/components/onboard/Step6Success';
import { Nav } from '@/components/Nav';
import { useAccount } from 'wagmi';
import { useEffect } from 'react';

export default function OnboardPage() {
  const { isConnected } = useAccount();
  const { step, setStep } = useOnboardStore();

  // If wallet disconnects mid-flow, send back to step 1
  useEffect(() => {
    if (!isConnected && step > 1) setStep(1);
  }, [isConnected, step, setStep]);

  const STEP_MAP = {
    1: <Step1Connect />,
    2: <Step2Agent />,
    3: <Step3Rules />,
    4: <Step4Deposit />,
    5: <Step5Confirm />,
    6: <Step6Success />,
  } as const;

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-10">
          <div className="mb-8">
            <h1 className="font-mono font-bold text-xl text-sentinel-white tracking-wide">
              Wrap your agent
            </h1>
            <p className="font-mono text-xs text-sentinel-gray-1 mt-1">
              Set safety rules. Activate the circuit breaker.
            </p>
          </div>

          <Stepper current={step} />

          <div className="min-h-[320px]">
            {STEP_MAP[step]}
          </div>
        </div>
      </main>
    </>
  );
}
