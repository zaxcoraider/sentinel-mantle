import { cn } from '@/lib/utils';
import type { WallEvent } from '@/lib/landing-data';
import { TxLink } from './TxLink';

const EVENT_COLOR: Record<WallEvent['type'], string> = {
  GUARDED: 'text-emerald-400',
  EXEC: 'text-sentinel-gray-1',
  CIRCUIT_BREAKER: 'text-sentinel-danger',
  RESCUED: 'text-sentinel-danger',
  PAUSED: 'text-amber-400',
};

const EVENT_PREFIX: Record<WallEvent['type'], string> = {
  GUARDED: '+',
  EXEC: '→',
  CIRCUIT_BREAKER: '✕',
  RESCUED: '↓',
  PAUSED: '⚠',
};

interface Props {
  event: WallEvent;
  explorerBase?: string;
}

export function EventRow({ event, explorerBase = 'https://explorer.sepolia.mantle.xyz' }: Props) {
  const shortAgent = `${event.agent.slice(0, 6)}…${event.agent.slice(-4)}`;

  return (
    <div
      className={cn(
        'grid grid-cols-[1.5rem_5rem_1fr_auto] gap-3 py-2 px-3 items-baseline',
        'border-b border-sentinel-gray-2 last:border-b-0',
        'text-xs font-mono',
        event.type === 'CIRCUIT_BREAKER' && 'bg-sentinel-danger/10',
      )}
    >
      <span className={cn('text-xs', EVENT_COLOR[event.type])}>
        {EVENT_PREFIX[event.type]}
      </span>
      <span className="text-sentinel-gray-1">{shortAgent}</span>
      <span className={cn('truncate', EVENT_COLOR[event.type])}>
        {event.label}
        {event.meta && (
          <span className="text-sentinel-gray-1 ml-2">{event.meta}</span>
        )}
      </span>
      {event.txHash && (
        <TxLink hash={event.txHash} explorerBase={explorerBase} label="↗" />
      )}
    </div>
  );
}
