import { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card } from '@/components/ui/card';
import { calculateAQI } from './AQICard';
import { useTemperatureUnit, convertTemp, tempUnit } from '@/utils/temperature';

// Hook to get window width for responsive tick count
export function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 800);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

export const TIERS = [
  { key: '15m', label: '15m', resolution: 2, resolutionLabel: '2s', apiKey: 'raw', maxAge: 900 },
  { key: '30m', label: '30m', resolution: 2, resolutionLabel: '2s', apiKey: 'raw', maxAge: 1800 },
  { key: 'raw', label: '1h', resolution: 2, resolutionLabel: '2s' },
  { key: 'fine', label: '6h', resolution: 60, resolutionLabel: '1m' },
  { key: 'medium', label: '24h', resolution: 600, resolutionLabel: '10m' },
  { key: 'coarse', label: '7d', resolution: 3600, resolutionLabel: '1h' },
  { key: 'daily', label: '30d', resolution: 21600, resolutionLabel: '6h' },
  { key: 'archive', label: '3y', resolution: 86400, resolutionLabel: '24h' },
];

export const METRIC_GROUPS = [
  {
    name: 'Air Quality',
    unit: '',
    yAxis: 'left',
    metrics: [
      { key: 'aqi', label: 'AQI', color: '#89b4fa', unit: '' },
    ],
  },
  {
    name: 'Particulates',
    unit: 'μg/m³',
    yAxis: 'left',
    metrics: [
      { key: 'pm1_0', label: 'PM1.0', color: '#f5c2e7' },
      { key: 'pm2_5', label: 'PM2.5', color: '#f38ba8' },
      { key: 'pm4_0', label: 'PM4.0', color: '#eba0ac' },
      { key: 'pm10', label: 'PM10', color: '#fab387' },
    ],
  },
  {
    name: 'Gas Index',
    unit: '(0-500)',
    yAxis: 'left',
    metrics: [
      { key: 'voc_index', label: 'VOC', color: '#a6e3a1' },
      { key: 'nox_index', label: 'NOx', color: '#cba6f7' },
    ],
  },
  {
    name: 'Environment',
    unit: '',
    yAxis: 'left',
    metrics: [
      { key: 'temperature', label: 'Temp', color: '#f9e2af', unit: '°F' },
      { key: 'humidity', label: 'Humidity', color: '#89b4fa', unit: '%' },
    ],
  },
  {
    name: 'Fan',
    unit: '',
    yAxis: 'right',
    metrics: [
      { key: 'fan_speed', label: 'Speed', color: '#94e2d5', unit: '%' },
      { key: 'fan_rpm', label: 'RPM', color: '#74c7ec', unit: ' RPM' },
    ],
  },
];

export const ALL_METRICS = METRIC_GROUPS.flatMap(g => g.metrics.map(m => ({ ...m, group: g.name, unit: m.unit || g.unit, yAxis: g.yAxis })));

function formatTimestamp(unixSeconds, tier, forTooltip = false) {
  const date = new Date(unixSeconds * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  // For tooltip - show more detail based on tier
  if (forTooltip) {
    const timeOpts = (tier === 'raw' || tier === '15m' || tier === '30m')
      ? { hour: 'numeric', minute: '2-digit', second: '2-digit' }
      : { hour: 'numeric', minute: '2-digit' };
    const timeStr = date.toLocaleTimeString([], timeOpts);

    if (isToday) return timeStr;
    if (isYesterday) return `Yesterday ${timeStr}`;
    const dayName = date.toLocaleDateString([], { weekday: 'short' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dayName} ${dateStr} ${timeStr}`;
  }

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // For axis labels - keep compact based on tier
  if (tier === 'raw' || tier === '15m' || tier === '30m' || tier === 'fine') {
    return timeStr;
  }
  if (tier === 'medium') {
    if (isToday) return timeStr;
    return date.toLocaleDateString([], { weekday: 'short', hour: 'numeric' });
  }
  if (tier === 'coarse') {
    return date.toLocaleDateString([], { weekday: 'short', hour: 'numeric' });
  }
  // daily/archive - show month and day
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label, normalized, metricRanges, tier, tempUnitLabel }) {
  if (!active || !payload?.length) return null;

  // label is timestamp (unix seconds)
  const timeLabel = formatTimestamp(label, tier, true);

  return (
    <div className="bg-surface border border-surface-1 rounded-lg p-3 shadow-lg">
      <div className="text-xs text-overlay mb-2">{timeLabel}</div>
      {payload.map((entry) => {
        // Get the base key (remove _norm suffix if present)
        const baseKey = entry.dataKey.replace('_norm', '');
        const metric = ALL_METRICS.find(m => m.key === baseKey);
        const unit = baseKey === 'temperature' ? tempUnitLabel : (metric?.unit || '');

        // If normalized, show both the percentage and actual value
        let displayValue;
        if (normalized && entry.dataKey.endsWith('_norm')) {
          const range = metricRanges?.[baseKey];
          const actualValue = range ? (entry.value / 100) * range.range + range.min : entry.value;
          displayValue = `${actualValue.toFixed(1)}${unit} (${entry.value.toFixed(0)}%)`;
        } else {
          displayValue = `${typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}${unit}`;
        }

        return (
          <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-subtext">{metric?.label || entry.name}:</span>
            <span className="text-text font-medium">{displayValue}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function HistoryChart({ tier, setTier, visibleMetrics, setVisibleMetrics, data, isLoading, error }) {
  const [normalized, setNormalized] = useState(false);
  const [autoScale, setAutoScale] = useState(false);
  const windowWidth = useWindowWidth();
  const { unit: tempUnitValue } = useTemperatureUnit();

  // Only animate on initial mount - Recharts internally generates a new animationId
  // every time the points array reference changes (via useAnimationId), which replays
  // the full entrance animation. We disable animation after the first render with data
  // so tier changes and refetches get instant updates instead of replaying the slide.
  const hasInitiallyAnimated = useRef(false);
  useEffect(() => {
    if (data?.samples?.length > 0 && !hasInitiallyAnimated.current) {
      const timer = setTimeout(() => {
        hasInitiallyAnimated.current = true;
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [data]);

  // Dynamic tick count based on screen width
  const tickCount = windowWidth < 400 ? 5 : windowWidth < 640 ? 7 : windowWidth < 1024 ? 10 : 14;
  const chartHeight = windowWidth < 640 ? 250 : 320;

  const toggleMetric = (key) => {
    setVisibleMetrics(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const samples = data?.samples || [];

  // Calculate min/max for each visible metric (for normalization)
  const metricRanges = {};
  if (samples.length > 0) {
    visibleMetrics.forEach(key => {
      const values = samples
        .map(s => {
          if (key === 'temperature' && s.temperature != null) {
            return convertTemp(s.temperature, tempUnitValue);
          }
          if (key === 'aqi') {
            return calculateAQI(s.pm2_5)?.aqi ?? null;
          }
          return s[key];
        })
        .filter(v => v != null && !isNaN(v));
      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        metricRanges[key] = { min, max, range: max - min || 1 };
      }
    });
  }

  const chartData = samples.map(s => {
    const aqiResult = calculateAQI(s.pm2_5);
    const base = {
      ...s,
      temperature: convertTemp(s.temperature, tempUnitValue),
      aqi: aqiResult?.aqi ?? null,
    };

    if (normalized) {
      // Add normalized versions of each visible metric
      visibleMetrics.forEach(key => {
        const range = metricRanges[key];
        const value = key === 'temperature' ? base.temperature : base[key];
        if (range && value != null) {
          base[`${key}_norm`] = ((value - range.min) / range.range) * 100;
        }
      });
    }

    return base;
  });

  const hasData = chartData.length > 0;

  // Check if any right-axis metrics are visible (only matters when not normalized)
  const hasRightAxis = !normalized && visibleMetrics.some(key => {
    const metric = ALL_METRICS.find(m => m.key === key);
    return metric?.yAxis === 'right';
  });

  // Need multiple axes when not normalized and metrics have different scales
  const needsMultipleAxes = !normalized && visibleMetrics.length > 1;

  return (
    <Card className="p-3 sm:p-4 md:p-6 border-surface-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 mb-4 sm:mb-6">
        <h3 className="text-lg font-semibold text-text">History</h3>

        <div className="flex items-center gap-2">
          {/* Auto-scale Toggle */}
          <button
            onClick={() => setAutoScale(!autoScale)}
            className={`px-3 py-2.5 sm:py-2 text-sm sm:text-xs font-medium rounded-lg sm:rounded-md transition-colors ${
              autoScale
                ? 'bg-cyan text-base'
                : 'bg-surface text-subtext hover:text-text'
            }`}
            title="Fit Y-axis to data range (shows small changes better)"
          >
            {windowWidth < 640 ? '⇕' : 'Fit'}
          </button>

          {/* Normalize Toggle */}
          <button
            onClick={() => setNormalized(!normalized)}
            className={`px-3 py-2.5 sm:py-2 text-sm sm:text-xs font-medium rounded-lg sm:rounded-md transition-colors ${
              normalized
                ? 'bg-purple text-base'
                : 'bg-surface text-subtext hover:text-text'
            }`}
            title="Normalize all metrics to 0-100% for comparison"
          >
            {windowWidth < 640 ? '%' : 'Normalize'}
          </button>

          {/* Tier Selector */}
          <div className="relative min-w-0">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-mantle to-transparent rounded-l-lg z-10 sm:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-mantle to-transparent rounded-r-lg z-10 sm:hidden" />
            <div className="flex gap-0.5 bg-mantle rounded-lg p-1 overflow-x-auto no-scrollbar">
              {TIERS.map(t => (
                <button
                  key={t.key}
                  className={`px-2.5 sm:px-3 py-2.5 sm:py-1.5 text-sm sm:text-xs min-w-[40px] font-medium rounded-md transition-colors whitespace-nowrap ${
                    tier === t.key
                      ? 'bg-blue text-base'
                      : 'text-subtext hover:text-text hover:bg-surface'
                  }`}
                  onClick={() => setTier(t.key)}
                  title={t.duration}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Metric Toggles */}
      <div className="relative mb-4 sm:mb-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-mantle to-transparent z-10 sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-mantle to-transparent z-10 sm:hidden" />
        <div className="flex overflow-x-auto no-scrollbar items-center gap-1.5 sm:gap-2 sm:flex-wrap pb-1 sm:pb-0">
          {METRIC_GROUPS.map((group, groupIndex) => (
            <div key={group.name} className="contents">
              {groupIndex > 0 && (
                <div className="w-px h-7 bg-surface-1 mx-1 hidden sm:block" />
              )}
              <div className="flex items-center gap-1.5 sm:gap-2 sm:bg-mantle rounded-full sm:p-1">
                {group.metrics.map(m => {
                  const isActive = visibleMetrics.includes(m.key);
                  return (
                    <button
                      key={m.key}
                      onClick={() => toggleMetric(m.key)}
                      className={`px-3 py-2 sm:py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
                        isActive
                          ? 'text-base shadow-sm'
                          : 'text-overlay hover:text-subtext bg-mantle sm:bg-transparent'
                      }`}
                      style={{
                        backgroundColor: isActive ? m.color : undefined,
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading/Error States */}
      {isLoading && !data && (
        <div className="space-y-2 p-4">
          <div className="skeleton h-[300px] w-full" />
        </div>
      )}
      {error && !data && (
        <div className="flex items-center justify-center h-[300px] text-red">
          Failed to load data
        </div>
      )}
      {!isLoading && !error && !hasData && (
        <div className="flex items-center justify-center h-[300px] text-overlay">
          No data yet for this time range
        </div>
      )}

      
      {/* Chart */}
      {hasData && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: windowWidth < 640 ? -5 : -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
            <XAxis
              dataKey="timestamp"
              stroke="#6c7086"
              tick={{ fontSize: windowWidth < 640 ? 9 : 10 }}
              tickFormatter={(v) => formatTimestamp(v, tier)}
              type="number"
              domain={['dataMin', 'dataMax']}
              tickCount={tickCount}
            />
            {normalized ? (
              <YAxis
                yAxisId="left"
                stroke="#cba6f7"
                tick={{ fontSize: windowWidth < 640 ? 9 : 11 }}
                width={windowWidth < 640 ? 35 : 45}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
            ) : (
              <>
                <YAxis
                  yAxisId="left"
                  stroke="#6c7086"
                  tick={{ fontSize: windowWidth < 640 ? 9 : 11 }}
                  width={windowWidth < 640 ? 35 : 45}
                  domain={autoScale ? [dataMin => Math.floor(dataMin * 0.95), dataMax => Math.ceil(dataMax * 1.05)] : [0, 'auto']}
                  allowDecimals={false}
                />
                {hasRightAxis && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#94e2d5"
                    tick={{ fontSize: windowWidth < 640 ? 9 : 11 }}
                    width={windowWidth < 640 ? 35 : 45}
                    domain={autoScale ? [dataMin => Math.floor(dataMin * 0.95), dataMax => Math.ceil(dataMax * 1.05)] : [0, 'auto']}
                    allowDecimals={false}
                  />
                )}
              </>
            )}
            <Tooltip
              content={<CustomTooltip normalized={normalized} metricRanges={metricRanges} tier={tier} tempUnitLabel={tempUnit(tempUnitValue)} />}
            />
            {windowWidth >= 640 && (
              <Legend
                wrapperStyle={{ paddingTop: '0.5rem' }}
                formatter={(value) => <span className="text-sm text-subtext">{value}</span>}
              />
            )}
            {ALL_METRICS.filter(m => visibleMetrics.includes(m.key)).map(m => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={normalized ? `${m.key}_norm` : m.key}
                name={m.label}
                stroke={m.color}
                dot={false}
                strokeWidth={2}
                yAxisId={normalized ? 'left' : m.yAxis}
                isAnimationActive={!hasInitiallyAnimated.current}
                animateNewValues={false}
                animationDuration={300}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Chart Info */}
      {data && chartData.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-overlay">
          <span>{data.count} samples</span>
          <span className="text-surface-1">•</span>
          <span>{TIERS.find(t => t.key === tier)?.resolutionLabel} intervals</span>
          <span className="text-surface-1">•</span>
          <span>
            {(() => {
              const timestamps = chartData.map(d => d.timestamp).filter(Boolean);
              if (timestamps.length === 0) return '';
              const startDate = new Date(Math.min(...timestamps) * 1000);
              const endDate = new Date(Math.max(...timestamps) * 1000);
              const sameDay = startDate.toDateString() === endDate.toDateString();
              if (sameDay) {
                const timeOpts = { hour: 'numeric', minute: '2-digit' };
                return `${startDate.toLocaleTimeString([], timeOpts)} – ${endDate.toLocaleTimeString([], timeOpts)}`;
              }
              return `${startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
            })()}
          </span>
        </div>
      )}
    </Card>
  );
}
