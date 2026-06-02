import { cn } from '@/lib/utils';
import type { Hex } from 'viem';

interface Props {
  hash: Hex;
  // Required: the selected network's explorer base. No default — a hardcoded
  // fallback caused links to point at the wrong network after the toggle.
  explorerBase: string;
  className?: string;
  label?: string;
}

export function TxLink({ hash, explorerBase, className, label }: Props) {
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
