import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          gap: '32px',
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#fafafa',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
          }}
        >
          SENTINEL
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 700,
            color: '#fafafa',
            textAlign: 'center',
            lineHeight: 1.1,
            maxWidth: '860px',
          }}
        >
          The circuit breaker for
          <br />
          autonomous AI agents.
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: '22px',
            color: '#737373',
            fontFamily: 'monospace',
          }}
        >
          Wrap your ERC-8004 agent. Sleep at night.
        </div>

        {/* Footer row */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 48px',
          }}
        >
          <div style={{ fontSize: '14px', color: '#737373', fontFamily: 'monospace' }}>
            sentinel.guard
          </div>
          <div
            style={{
              fontSize: '14px',
              color: '#2563eb',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
            }}
          >
            ON MANTLE
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
