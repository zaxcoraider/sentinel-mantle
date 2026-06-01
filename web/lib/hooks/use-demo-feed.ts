'use client';

import { useEffect, useRef, useState } from 'react';
import type { WatchEvent, AgentLiveStatus, WatchStats } from './use-watch-events';

// A self-contained, scripted live feed used ONLY when no real monitor is
// reachable (e.g. the deployed site, where the monitor SSE is localhost).
// It produces a believable stream so the Watch wall is always cinematic —
// real monitor data always takes priority in the page.

const MAX_EVENTS = 20;

interface DemoAgent {
  agent: string;
  tokenId: string;
  name: string;
}

const AGENTS: DemoAgent[] = [
  { agent: '0xD4982BAFb9660Add2c32fA12b7Be6a3628db4442', tokenId: '0', name: 'yieldchaser' },
  { agent: '0xE4A5e51B5A050EfFb70cb4eBC8f9Bc7Ca95A9215', tokenId: '1', name: 'protocolhopper' },
  { agent: '0x7b4aC82be0D26A7a6c19e56a7CB3B825F6138f1D', tokenId: '2', name: 'insomniac' },
];

const TARGETS = [
  '0x1b81D678ffb9C0263b24A97847620C99d213eB14', // Merchant Moe-ish
  '0xAAAA45c9c43d3855A4f0E0e1B1A1aE2D7e3a1234',
  '0x5bE26527e817998A7206475496fDE1E68957c5A6', // USDY
];

const EXEC_MESSAGES = [
  'swap 1.24 MNT → mETH',
  'addLiquidity USDY/USDe',
  'harvest rewards',
  'rebalance vault position',
  'stake 0.8 mETH',
  'claim yield',
];

const ANOMALIES = [
  { type: 'MAX_DRAWDOWN', msg: 'drawdown -6.4% · approaching configured limit' },
  { type: 'MAX_TX_PER_HOUR', msg: 'tx-rate nearing cap · 4 of 5 this hour' },
  { type: 'ORACLE_DEVIATION', msg: 'price feed deviates 2.1% from last on-chain swap' },
];

const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const fakeTx = (): string =>
  '0x' + Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

type Step =
  | { kind: 'exec' }
  | { kind: 'warn' }
  | { kind: 'breaker' }
  | { kind: 'rescue' };

// Weighted script: mostly normal execs, periodic escalation to a dramatic breaker.
const SCRIPT: Step[] = [
  { kind: 'exec' }, { kind: 'exec' }, { kind: 'exec' },
  { kind: 'warn' }, { kind: 'exec' }, { kind: 'exec' },
  { kind: 'warn' }, { kind: 'breaker' }, { kind: 'rescue' },
  { kind: 'exec' }, { kind: 'exec' },
];

export interface DemoFeed {
  events: WatchEvent[];
  agents: Map<string, AgentLiveStatus>;
  stats: WatchStats;
}

export const useDemoFeed = (enabled: boolean): DemoFeed => {
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [agents, setAgents] = useState<Map<string, AgentLiveStatus>>(new Map());
  const [stats, setStats] = useState<WatchStats>({
    agentsGuarded: 0,
    totalEvents: 0,
    circuitBreakers: 0,
    uptimeSec: 0,
    lastBlock: '78421003',
  });
  const stepRef = useRef(0);
  const blockRef = useRef(78421003);
  const focusRef = useRef<DemoAgent>(AGENTS[0]);

  useEffect(() => {
    if (!enabled) return;

    // Seed the guarded agent roster + a "boot" line.
    const seeded = new Map<string, AgentLiveStatus>();
    for (const a of AGENTS) {
      seeded.set(a.agent, { agent: a.agent, status: 'guarded', tokenId: a.tokenId });
    }
    setAgents(seeded);
    setStats((s) => ({ ...s, agentsGuarded: AGENTS.length }));

    let timer: ReturnType<typeof setTimeout>;

    const setAgentStatus = (agent: string, status: AgentLiveStatus['status']): void => {
      setAgents((prev) => {
        const m = new Map(prev);
        const ex = m.get(agent);
        if (ex) m.set(agent, { ...ex, status, lastSeenMs: Date.now() });
        return m;
      });
    };

    const emit = (ev: WatchEvent, isBreaker = false): void => {
      setEvents((prev) => [ev, ...prev].slice(0, MAX_EVENTS));
      setStats((s) => ({
        ...s,
        totalEvents: s.totalEvents + 1,
        circuitBreakers: isBreaker ? s.circuitBreakers + 1 : s.circuitBreakers,
        uptimeSec: (s.uptimeSec ?? 0) + 2,
        lastBlock: String(blockRef.current),
      }));
    };

    const tick = (): void => {
      blockRef.current += Math.floor(Math.random() * 3) + 1;
      const step = SCRIPT[stepRef.current % SCRIPT.length];
      stepRef.current += 1;
      const now = Date.now();

      if (step.kind === 'exec') {
        const a = rand(AGENTS);
        emit({
          id: `${now}`,
          type: 'agent_tx',
          ts: now,
          agent: a.agent,
          target: rand(TARGETS),
          message: rand(EXEC_MESSAGES),
          block: String(blockRef.current),
        });
      } else if (step.kind === 'warn') {
        const a = rand(AGENTS);
        focusRef.current = a;
        const an = rand(ANOMALIES);
        setAgentStatus(a.agent, 'warn');
        emit({
          id: `${now}`,
          type: 'anomaly_warn',
          ts: now,
          agent: a.agent,
          anomalyType: an.type,
          message: an.msg,
          block: String(blockRef.current),
        });
      } else if (step.kind === 'breaker') {
        const a = focusRef.current;
        setAgentStatus(a.agent, 'tripped');
        emit(
          {
            id: `${now}`,
            type: 'circuit_breaker',
            ts: now,
            agent: a.agent,
            anomalyType: 'MAX_DRAWDOWN',
            message: 'agent paused · breaker fired by monitor',
            txHash: fakeTx(),
            block: String(blockRef.current),
          },
          true,
        );
      } else if (step.kind === 'rescue') {
        const a = focusRef.current;
        emit({
          id: `${now}`,
          type: 'agent_tx',
          ts: now,
          agent: a.agent,
          message: 'funds rescued → time-locked EmergencyVault',
          txHash: fakeTx(),
          block: String(blockRef.current),
        });
        // re-arm the agent after the drama
        setTimeout(() => setAgentStatus(a.agent, 'guarded'), 3500);
      }

      const delay = step.kind === 'breaker' ? 2200 : step.kind === 'rescue' ? 2600 : 1500 + Math.random() * 1200;
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, [enabled]);

  return { events, agents, stats };
};
