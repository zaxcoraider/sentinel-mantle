import { cn } from '@/lib/utils';
import type { Hex } from 'viem';

interface Props {
  hash: Hex;
  explorerBase?: string;
  className?: string;
  label?: string;
}

export function TxLink({
  hash,
  explorerBase = 'https://explorer.sepolia.mantle.xyz',
  className,
  label,
}: Props) {
  const short = label ?? `${hash.slice(0, 8)}…${hash.slice(-4)}`;
  return (
    <a
      href={`${explorerBase}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'font-mono text-xs text-sentinel-blue hover:underline',
        className,
      )}
    >
      {short} ↗
    </a>
  );
}
