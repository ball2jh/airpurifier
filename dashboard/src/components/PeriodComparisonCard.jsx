import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ALL_METRICS, TIERS } from './HistoryChart';
import { useTemperatureUnit, convertTemp } from '@/utils/temperature';

// Duration in seconds for each tier (matched to backend time windows)
const TIER_DURATIONS = {
  raw: 3600,       // 1h
  fine: 21600,     // 6h
  medium: 86400,   // 24h
  coarse: 604800,  // 7d
  daily: 2592000,  // 30d
  archive: 94608000, // 3y
};

function calculateAverage(samples, metricKey, unit) {
  const values = samples
    .map(s => metricKey === 'temperature'
      ? convertTemp(s.temperature, unit)
      : s[metricKey])
    .filter(v => v != null && !isNaN(v));

  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function splitPeriods(samples, tier) {
  if (!samples || samples.length === 0) return { current: [], previous: [] };

  const duration = TIER_DURATIONS[tier] || 86400;
  // Use current Unix time for filtering
  const nowUnix = Math.floor(Date.now() / 1000);

  const current = samples.filter(s =>
    nowUnix - s.timestamp <= duration
  );
  const previous = samples.filter(s =>
    nowUnix - s.timestamp > duration && nowUnix - s.timestamp <= duration * 2
  );

  return { current, previous };
}

function compareMetric(currentSamples, previousSamples, metricKey, unit) {
  const currentAvg = calculateAverage(currentSamples, metricKey, unit);
  const previousAvg = calculateAverage(previousSamples, metricKey, unit);

  if (currentAvg == null || previousAvg == null) {
    return null;
  }

  if (previousAvg === 0) {
    if (currentAvg === 0) return { currentAvg, previousAvg, change: 0, direction: 'stable' };
    return { currentAvg, previousAvg, change: 100, direction: 'up' };
  }

  const change = ((currentAvg - previousAvg) / previousAvg) * 100;
  return {
    currentAvg,
    previousAvg,
    change,
    direction: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
  };
}

// For air quality metrics, lower is better (except temperature/humidity which are contextual)
function isImprovement(metricKey, direction) {
  const lowerIsBetter = ['pm1_0', 'pm2_5', 'pm4_0', 'pm10', 'voc_index', 'nox_index'];
  if (lowerIsBetter.includes(metricKey)) {
    return direction === 'down';
  }
  // For temp/humidity/fan, direction doesn't indicate improvement
  return null;
}

export default function PeriodComparisonCard({ samples = [], visibleMetrics = [], tier }) {
  const { unit: tempUnitValue } = useTemperatureUnit();
  const tierInfo = TIERS.find(t => t.key === tier);
  const { current, previous } = splitPeriods(samples, tier);

  const hasPreviousData = previous.length > 0;

  if (visibleMetrics.length === 0) {
    return (
      <Card className="p-4 sm:p-5 border-surface-1 bg-mantle">
        <p className="text-xs font-medium text-subtext uppercase tracking-wider mb-2">vs Previous</p>
        <p className="text-sm text-overlay">Select metrics to compare</p>
      </Card>
    );
  }

  if (!hasPreviousData) {
    return (
      <Card className="p-4 sm:p-5 border-surface-1 bg-mantle">
        <p className="text-xs font-medium text-subtext uppercase tracking-wider mb-2">
          vs Previous {tierInfo?.label || tier}
        </p>
        <p className="text-sm text-overlay">Not enough historical data</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5 border-surface-1 bg-mantle">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-subtext uppercase tracking-wider">
          vs Previous {tierInfo?.label || tier}
        </p>
      </div>
      <p className="text-[10px] text-overlay mb-4">Period-over-period comparison</p>

      <div className="space-y-3">
        {visibleMetrics.map(metricKey => {
          const metric = ALL_METRICS.find(m => m.key === metricKey);
          const comparison = compareMetric(current, previous, metricKey, tempUnitValue);

          if (!comparison || !metric) return null;

          const improvement = isImprovement(metricKey, comparison.direction);
          const colorClass = improvement === true ? 'text-green' :
                            improvement === false ? 'text-red' :
                            'text-subtext';

          return (
            <div
              key={metricKey}
              className="flex items-center justify-between py-2 border-b border-surface-1 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
                <span className="text-sm text-subtext">{metric.label}</span>
              </div>
              <div className={`flex items-center gap-1 ${colorClass}`}>
                {comparison.direction === 'up' && <TrendingUp className="w-4 h-4" />}
                {comparison.direction === 'down' && <TrendingDown className="w-4 h-4" />}
                {comparison.direction === 'stable' && <Minus className="w-4 h-4 text-overlay" />}
                <span className="text-sm font-medium tabular-nums">
                  {comparison.direction === 'stable' ? '~' : `${Math.abs(comparison.change).toFixed(0)}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
