'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  YAxis,
  ReferenceLine,
} from 'recharts';
import type { RepHistory } from '@/lib/agent-data';

interface DataPoint {
  t: number;
  score: number;
}

function buildChartData(history: RepHistory[], currentScore: number): DataPoint[] {
  if (history.length === 0) {
    return [{ t: 0, score: currentScore }];
  }
  const points = history.map((h, i) => ({ t: i, score: h.scoreAfter }));
  return [...points, { t: points.length, score: currentScore }];
}

export function ReputationChart({
  score,
  history,
}: {
  score: bigint;
  history: RepHistory[];
}) {
  const data = buildChartData(history, Number(score));
  const currentScore = Number(score);
  const color =
    currentScore >= 700 ? '#34d399' : currentScore >= 400 ? '#fbbf24' : '#dc2626';
  const gradId = `rep-grad-${currentScore}`;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono font-bold text-4xl tabular-nums"
          style={{ color, textShadow: `0 0 18px ${color}66` }}
        >
          {currentScore}
        </span>
        <span className="font-mono text-xs text-sentinel-gray-1">/ 1000</span>
      </div>

      {data.length > 1 && (
        <ResponsiveContainer width="100%" height={88}>
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 1000]} hide />
            <ReferenceLine y={500} stroke="#262626" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ stroke: '#404040', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                return (
                  <div className="font-mono text-[10px] bg-sentinel-black border border-sentinel-gray-2 px-2 py-1">
                    score: <span style={{ color }}>{payload[0].value}</span>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke={color}
              strokeWidth={1.75}
              fill={`url(#${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <div className="font-mono text-[10px] text-sentinel-gray-1">
        {history.length > 0
          ? `${history.length} reputation event${history.length !== 1 ? 's' : ''} recorded`
          : 'No reputation events yet'}
      </div>
    </div>
  );
}
