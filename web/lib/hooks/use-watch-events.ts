'use client';

import { useEffect, useRef, useState } from 'react';

export type WatchEventType =
  | 'agent_registered'
  | 'agent_deregistered'
  | 'agent_tx'
  | 'anomaly_warn'
  | 'circuit_breaker'
  | 'stats'
  | 'heartbeat';

export interface WatchEvent {
  id: string;
  type: WatchEventType;
  ts: number;
  agent?: string;
  txHash?: string;
  message?: string;
  anomalyType?: string;
  block?: string;
  target?: string;
}

export interface AgentLiveStatus {
  agent: string;
  status: 'guarded' | 'warn' | 'tripped';
  tokenId?: string;
  lastSeenMs?: number;
}

export interface WatchStats {
  agentsGuarded: number;
  totalEvents: number;
  circuitBreakers: number;
  uptimeSec?: number;
  lastBlock?: string;
}

const MAX_EVENTS = 20;

export const useWatchEvents = (monitorUrl: string) => {
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [agents, setAgents] = useState<Map<string, AgentLiveStatus>>(new Map());
  const [stats, setStats] = useState<WatchStats>({
    agentsGuarded: 0,
    totalEvents: 0,
    circuitBreakers: 0,
  });
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Fetch initial agent snapshot
    void fetch(`${monitorUrl}/agents`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.json())
      .then((data: AgentLiveStatus[]) => {
        if (!mountedRef.current) return;
        const m = new Map<string, AgentLiveStatus>();
        for (const a of data) m.set(a.agent, a);
        setAgents(m);
        setStats((prev) => ({ ...prev, agentsGuarded: m.size }));
      })
      .catch(() => { /* monitor offline — no-op */ });

    let retryTimeout: ReturnType<typeof setTimeout> | undefined;

    const connect = (): void => {
      if (!mountedRef.current) return;
      const es = new EventSource(`${monitorUrl}/events`);
      esRef.current = es;

      es.onopen = () => {
        if (mountedRef.current) setConnected(true);
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        retryTimeout = setTimeout(connect, 3000);
      };

      const push = (type: WatchEventType, raw: Record<string, unknown>): void => {
        if (!mountedRef.current) return;
        const ev: WatchEvent = {
          id: String(raw.ts ?? Date.now()),
          type,
          ts: typeof raw.ts === 'number' ? raw.ts : Date.now(),
          agent: typeof raw.agent === 'string' ? raw.agent : undefined,
          txHash: typeof raw.txHash === 'string' ? raw.txHash : undefined,
          message: typeof raw.message === 'string' ? raw.message : undefined,
          anomalyType: typeof raw.anomalyType === 'string' ? raw.anomalyType : undefined,
          block: typeof raw.block === 'string' ? raw.block : undefined,
          target: typeof raw.target === 'string' ? raw.target : undefined,
        };

        setEvents((prev) => [ev, ...prev].slice(0, MAX_EVENTS));
        setStats((prev) => ({
          ...prev,
          totalEvents: prev.totalEvents + 1,
          circuitBreakers:
            type === 'circuit_breaker'
              ? prev.circuitBreakers + 1
              : prev.circuitBreakers,
        }));

        if (type === 'agent_registered' && ev.agent) {
          setAgents((prev) => {
            const m = new Map(prev);
            m.set(ev.agent!, {
              agent: ev.agent!,
              status: 'guarded',
              tokenId: typeof raw.tokenId === 'string' ? raw.tokenId : undefined,
              lastSeenMs: ev.ts,
            });
            return m;
          });
          setStats((prev) => ({ ...prev, agentsGuarded: prev.agentsGuarded + 1 }));
        }

        if (type === 'agent_deregistered' && ev.agent) {
          setAgents((prev) => {
            const m = new Map(prev);
            m.delete(ev.agent!);
            return m;
          });
          setStats((prev) => ({
            ...prev,
            agentsGuarded: Math.max(0, prev.agentsGuarded - 1),
          }));
        }

        if (type === 'anomaly_warn' && ev.agent) {
          setAgents((prev) => {
            const m = new Map(prev);
            const existing = m.get(ev.agent!) ?? { agent: ev.agent!, status: 'guarded' };
            m.set(ev.agent!, { ...existing, status: 'warn', lastSeenMs: ev.ts });
            return m;
          });
        }

        if (type === 'circuit_breaker' && ev.agent) {
          setAgents((prev) => {
            const m = new Map(prev);
            const existing = m.get(ev.agent!) ?? { agent: ev.agent!, status: 'guarded' };
            m.set(ev.agent!, { ...existing, status: 'tripped', lastSeenMs: ev.ts });
            return m;
          });
        }
      };

      const makeHandler =
        (type: WatchEventType) =>
        (e: MessageEvent<string>): void => {
          try {
            const data = JSON.parse(e.data) as Record<string, unknown>;
            push(type, data);
          } catch { /* ignore malformed */ }
        };

      es.addEventListener('agent_registered', makeHandler('agent_registered'));
      es.addEventListener('agent_deregistered', makeHandler('agent_deregistered'));
      es.addEventListener('agent_tx', makeHandler('agent_tx'));
      es.addEventListener('anomaly_warn', makeHandler('anomaly_warn'));
      es.addEventListener('circuit_breaker', makeHandler('circuit_breaker'));

      es.addEventListener('stats', (e: MessageEvent<string>) => {
        try {
          const d = JSON.parse(e.data) as Record<string, unknown>;
          if (mountedRef.current) {
            setStats((prev) => ({
              ...prev,
              agentsGuarded:
                typeof d.agentsWatched === 'number' ? d.agentsWatched : prev.agentsGuarded,
              uptimeSec:
                typeof d.uptimeSec === 'number' ? d.uptimeSec : prev.uptimeSec,
              lastBlock:
                typeof d.lastBlock === 'string' ? d.lastBlock : prev.lastBlock,
            }));
          }
        } catch { /* ignore */ }
      });
    };

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimeout);
      esRef.current?.close();
    };
  }, [monitorUrl]);

  return { events, agents, stats, connected };
};
