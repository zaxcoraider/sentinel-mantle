import { cn } from '@/lib/utils';
import type { Address } from 'viem';

interface Props {
  address: Address;
  // Required: the selected network's explorer base. No default — a hardcoded
  // fallback caused links to point at the wrong network after the toggle.
  explorerBase: string;
  className?: string;
}

export function AddressLink({ address, explorerBase, className }: Props) {
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
