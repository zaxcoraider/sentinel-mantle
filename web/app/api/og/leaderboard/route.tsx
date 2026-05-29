import { ImageResponse } from 'next/og';
import { getLeaderboard } from '@/lib/agent-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const entries = (await getLeaderboard()).slice(0, 10);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0a0a0a',
          color: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'monospace',
          padding: '40px 48px',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #2a2a2a',
            paddingBottom: '16px',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '0.3em',
              color: '#fafafa',
            }}
          >
            SENTINEL · LEADERBOARD
          </div>
          <div
            style={{
              fontSize: '14px',
              color: '#2563eb',
              letterSpacing: '0.1em',
            }}
          >
            MANTLE SEPOLIA
          </div>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'flex',
            fontSize: '12px',
            color: '#737373',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '16px 0 8px',
            borderBottom: '1px solid #2a2a2a',
          }}
        >
          <div style={{ width: '60px' }}>Rank</div>
          <div style={{ flex: 1 }}>Agent</div>
          <div style={{ width: '120px', textAlign: 'right' }}>Score</div>
          <div style={{ width: '100px', textAlign: 'right' }}>Days</div>
          <div style={{ width: '120px', textAlign: 'right' }}>Status</div>
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {entries.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: '#737373',
                fontSize: '16px',
              }}
            >
              No agents registered yet.
            </div>
          ) : (
            entries.map((e) => {
              const n = Number(e.score);
              const scoreColor =
                n >= 700 ? '#34d399' : n >= 400 ? '#facc15' : '#ef4444';
              const rankColor =
                e.rank === 1 ? '#facc15' :
                e.rank === 2 ? '#a3a3a3' :
                e.rank === 3 ? '#d97706' : '#737373';
              return (
                <div
                  key={e.agent}
                  style={{
                    display: 'flex',
                    fontSize: '18px',
                    padding: '12px 0',
                    borderBottom: '1px solid #1a1a1a',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ width: '60px', color: rankColor, fontWeight: 700 }}>
                    {String(e.rank).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1, color: '#fafafa' }}>
                    {e.agent.slice(0, 14)}…{e.agent.slice(-6)}
                  </div>
                  <div
                    style={{
                      width: '120px',
                      textAlign: 'right',
                      color: scoreColor,
                      fontWeight: 700,
                    }}
                  >
                    {n}
                  </div>
                  <div style={{ width: '100px', textAlign: 'right', color: '#a3a3a3' }}>
                    {e.daysGuarded}d
                  </div>
                  <div
                    style={{
                      width: '120px',
                      textAlign: 'right',
                      color: e.isPaused ? '#ef4444' : '#34d399',
                      fontSize: '14px',
                    }}
                  >
                    {e.isPaused ? 'TRIPPED' : 'GUARDED'}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid #2a2a2a',
            paddingTop: '16px',
            fontSize: '14px',
            color: '#737373',
          }}
        >
          <div>agentsentinel.vercel.app/leaderboard</div>
          <div style={{ color: '#2563eb' }}>
            Circuit breakers for autonomous AI agents
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
