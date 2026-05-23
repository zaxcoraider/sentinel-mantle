import { cn } from '@/lib/utils';
import type { Address } from 'viem';

interface Props {
  address: Address;
  explorerBase?: string;
  className?: string;
}

export function AddressLink({
  address,
  explorerBase = 'https://explorer.sepolia.mantle.xyz',
  className,
}: Props) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <a
      href={`${explorerBase}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'font-mono text-sm text-sentinel-gray-1 hover:text-sentinel-white transition-colors',
        className,
      )}
    >
      {short}
    </a>
  );
}
