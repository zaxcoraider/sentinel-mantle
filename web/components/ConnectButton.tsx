'use client';

import { ConnectButton as RKConnectButton } from '@rainbow-me/rainbowkit';
import { cn } from '@/lib/utils';

export function ConnectButton({
  className,
  variant = 'outline',
}: {
  className?: string;
  variant?: 'outline' | 'primary';
}) {
  return (
    <RKConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
            })}
            className={className}
          >
            {!connected ? (
              <button
                onClick={openConnectModal}
                className={cn(
                  'font-mono text-xs tracking-widest uppercase transition-all duration-200',
                  variant === 'primary'
                    ? 'px-6 py-3 text-sentinel-white bg-sentinel-blue/90 border border-sentinel-blue shadow-glow hover:bg-sentinel-blue hover:shadow-glow-cyan'
                    : 'px-4 py-2 border border-sentinel-blue text-sentinel-blue hover:bg-sentinel-blue hover:text-sentinel-white',
                )}
              >
                Connect Wallet ▸
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                className="font-mono text-xs px-4 py-2 border border-sentinel-danger text-sentinel-danger hover:bg-sentinel-danger hover:text-white transition-colors"
              >
                Wrong Network
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openChainModal}
                  className="font-mono text-xs text-sentinel-gray-1 hover:text-sentinel-white transition-colors hidden md:block"
                >
                  {chain.name}
                </button>
                <button
                  onClick={openAccountModal}
                  className="font-mono text-xs px-3 py-1 border border-sentinel-gray-2 text-sentinel-white hover:border-sentinel-blue transition-colors"
                >
                  {account.displayName} ▾
                </button>
              </div>
            )}
          </div>
        );
      }}
    </RKConnectButton.Custom>
  );
}
