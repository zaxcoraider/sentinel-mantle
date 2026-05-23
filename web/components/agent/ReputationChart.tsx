'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
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
  const points = history.map((h, i) => ({
    t: i,
    score: h.scoreAfter,
  }));
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
  const scoreColor =
    currentScore >= 700 ? '#34d399' : currentScore >= 400 ? '#fbbf24' : '#dc2626';

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono font-bold text-3xl" style={{ color: scoreColor }}>
          {currentScore}
        </span>
        <span className="font-mono text-xs text-sentinel-gray-1">/ 1000</span>
      </div>

      {data.length > 1 && (
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <YAxis domain={[0, 1000]} hide />
            <ReferenceLine y={500} stroke="#262626" strokeDasharray="3 3" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                return (
                  <div className="font-mono text-[10px] bg-sentinel-black border border-sentinel-gray-2 px-2 py-1">
                    score: {payload[0].value}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={scoreColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="font-mono text-[10px] text-sentinel-gray-1">
        {history.length > 0
          ? `${history.length} reputation events recorded`
          : 'No reputation events yet'}
      </div>
    </div>
  );
}
