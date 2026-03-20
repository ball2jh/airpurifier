import { Card } from '@/components/ui/card';
import { ALL_METRICS, TIERS } from './HistoryChart';
import { useTemperatureUnit, convertTemp } from '@/utils/temperature';
import { calculateAQI } from './AQICard';

function calculateStats(samples, metricKey, tempUnit) {
  const values = samples
    .map(s => {
      if (metricKey === 'aqi') return calculateAQI(s.pm2_5)?.aqi;
      if (metricKey === 'temperature' && s.temperature != null) return convertTemp(s.temperature, tempUnit);
      return s[metricKey];
    })
    .filter(v => v != null && !isNaN(v));

  if (values.length === 0) return null;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // Use true server-side min/max when available (archive data with _min/_max fields)
  const minKey = `${metricKey}_min`;
  const maxKey = `${metricKey}_max`;
  const hasServerRange = samples.some(s => s[minKey] != null);

  let min, max;
  if (hasServerRange) {
    if (metricKey === 'temperature') {
      min = Math.min(...samples.map(s => s[minKey] != null ? convertTemp(s[minKey], tempUnit) : Infinity));
      max = Math.max(...samples.map(s => s[maxKey] != null ? convertTemp(s[maxKey], tempUnit) : -Infinity));
    } else {
      min = Math.min(...samples.map(s => s[minKey] ?? Infinity).filter(v => v !== Infinity));
      max = Math.max(...samples.map(s => s[maxKey] ?? -Infinity).filter(v => v !== -Infinity));
    }
  } else if (metricKey === 'aqi') {
    // AQI is derived client-side — use server-side pm2_5 min/max if available
    const hasPmRange = samples.some(s => s.pm2_5_min != null);
    if (hasPmRange) {
      const aqiMins = samples.map(s => s.pm2_5_min != null ? calculateAQI(s.pm2_5_min)?.aqi : null).filter(v => v != null);
      const aqiMaxs = samples.map(s => s.pm2_5_max != null ? calculateAQI(s.pm2_5_max)?.aqi : null).filter(v => v != null);
      min = aqiMins.length > 0 ? Math.min(...aqiMins) : Math.min(...values);
      max = aqiMaxs.length > 0 ? Math.max(...aqiMaxs) : Math.max(...values);
    } else {
      min = Math.min(...values);
      max = Math.max(...values);
    }
  } else {
    min = Math.min(...values);
    max = Math.max(...values);
  }

  return { min, max, avg };
}

export default function StatisticsSummaryCard({ samples = [], visibleMetrics = [], tier }) {
  const { unit: tempUnitValue } = useTemperatureUnit();
  const tierInfo = TIERS.find(t => t.key === tier);

  if (visibleMetrics.length === 0) {
    return (
      <Card className="p-4 sm:p-5 border-surface-1 bg-mantle">
        <p className="text-xs font-medium text-subtext uppercase tracking-wider mb-2">Statistics</p>
        <p className="text-sm text-overlay">Select metrics to see statistics</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5 border-surface-1 bg-mantle">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-subtext uppercase tracking-wider">Statistics</p>
        <span className="text-xs text-overlay">{tierInfo?.label || tier}</span>
      </div>

      <div className="space-y-3">
        {visibleMetrics.map(metricKey => {
          const metric = ALL_METRICS.find(m => m.key === metricKey);
          const stats = calculateStats(samples, metricKey, tempUnitValue);

          if (!stats || !metric) return null;

          return (
            <div key={metricKey} className="border-b border-surface-1 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
                <span className="text-sm font-medium text-text">{metric.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-overlay uppercase">Min</p>
                  <p className="text-sm font-semibold tabular-nums text-text">
                    {stats.min.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-overlay uppercase">Avg</p>
                  <p className="text-sm font-semibold tabular-nums text-text">
                    {stats.avg.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-overlay uppercase">Max</p>
                  <p className="text-sm font-semibold tabular-nums text-text">
                    {stats.max.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
