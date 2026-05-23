export type AgentStatus = 'guarded' | 'warn' | 'tripped' | 'unguarded';

export interface StatusMeta {
  color: string;       // Tailwind text color class
  bg: string;          // Tailwind bg color class
  dot: string;         // glyph
  label: string;
}

export const STATUS_META: Record<AgentStatus, StatusMeta> = {
  guarded: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-400',
    dot: '●',
    label: 'Guarded',
  },
  warn: {
    color: 'text-amber-400',
    bg: 'bg-amber-400',
    dot: '⚠',
    label: 'Warning',
  },
  tripped: {
    color: 'text-sentinel-danger',
    bg: 'bg-sentinel-danger',
    dot: '✕',
    label: 'Tripped',
  },
  unguarded: {
    color: 'text-sentinel-gray-1',
    bg: 'bg-sentinel-gray-1',
    dot: '○',
    label: 'Unguarded',
  },
};

export const deriveStatus = (isPaused: boolean, hasWarn: boolean): AgentStatus => {
  if (isPaused) return 'tripped';
  if (hasWarn) return 'warn';
  return 'guarded';
};
