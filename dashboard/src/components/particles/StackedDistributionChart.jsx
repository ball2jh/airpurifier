import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BIN_COLORS, BIN_LABELS } from '@/utils/particleSource';
import { useWindowWidth } from '@/components/HistoryChart';

function formatTimestamp(unixSeconds, forTooltip = false) {
  const date = new Date(unixSeconds * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (forTooltip) {
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return timeStr;
    if (isYesterday) return `Yesterday ${timeStr}`;
    return `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${timeStr}`;
  }

  if (isToday) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const dataPoint = payload[0]?.payload;
  const total = dataPoint?._total || 0;

  return (
    <div className="bg-surface border border-surface-1 rounded-lg p-3 shadow-lg">
      <div className="text-xs text-overlay mb-2">{formatTimestamp(label, true)}</div>
      {payload.filter(e => e.value > 0).reverse().map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-subtext">{entry.name}:</span>
          <span className="text-text font-medium tabular-nums">
            {entry.value.toFixed(0)}
            {total > 0 && <span className="text-overlay font-normal"> ({(entry.value / total * 100).toFixed(0)}%)</span>}
          </span>
        </div>
      ))}
      <div className="border-t border-surface-1 mt-1.5 pt-1.5 text-xs text-overlay">
        Total: <span className="text-text font-medium">{total.toFixed(0)}</span> #/cm³
      </div>
    </div>
  );
}

export default function StackedDistributionChart({ samples }) {
  const windowWidth = useWindowWidth();

  const chartData = useMemo(() => {
    if (!samples?.length) return [];
    return samples.map(s => {
      const nc0_5 = s.nc_pm0_5 ?? 0;
      const nc1_0 = s.nc_pm1_0 ?? 0;
      const nc2_5 = s.nc_pm2_5 ?? 0;
      const nc4_0 = s.nc_pm4_0 ?? 0;
      const nc10 = s.nc_pm10 ?? 0;

      const bin0 = Math.max(0, nc0_5);
      const bin1 = Math.max(0, nc1_0 - nc0_5);
      const bin2 = Math.max(0, nc2_5 - nc1_0);
      const bin3 = Math.max(0, nc4_0 - nc2_5);
      const bin4 = Math.max(0, nc10 - nc4_0);

      return {
        timestamp: s.timestamp,
        bin0, bin1, bin2, bin3, bin4,
        _total: bin0 + bin1 + bin2 + bin3 + bin4,
      };
    });
  }, [samples]);

  const chartHeight = windowWidth < 640 ? 250 : 320;
  const tickCount = windowWidth < 400 ? 5 : windowWidth < 640 ? 7 : 10;

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-overlay">
        No particle count data for this time range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: windowWidth < 640 ? -5 : -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
        <XAxis
          dataKey="timestamp"
          stroke="#6c7086"
          tick={{ fontSize: windowWidth < 640 ? 9 : 10 }}
          tickFormatter={(v) => formatTimestamp(v)}
          type="number"
          domain={['dataMin', 'dataMax']}
          tickCount={tickCount}
        />
        <YAxis
          stroke="#6c7086"
          tick={{ fontSize: windowWidth < 640 ? 9 : 11 }}
          width={windowWidth < 640 ? 35 : 45}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        {windowWidth >= 640 && (
          <Legend
            wrapperStyle={{ paddingTop: '0.5rem' }}
            formatter={(value) => <span className="text-sm text-subtext">{value}</span>}
          />
        )}
        {BIN_LABELS.map((label, i) => (
          <Area
            key={i}
            type="monotone"
            dataKey={`bin${i}`}
            name={label}
            stackId="1"
            fill={BIN_COLORS[i]}
            fillOpacity={0.7}
            stroke={BIN_COLORS[i]}
            strokeWidth={1}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
