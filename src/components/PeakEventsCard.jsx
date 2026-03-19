import { Card } from '@/components/ui/card';
import { TIERS } from './HistoryChart';

const PM25_THRESHOLDS = [
  { level: 12, label: 'Moderate', color: 'yellow', bgClass: 'bg-yellow', textClass: 'text-yellow' },
  { level: 35, label: 'USG', color: 'orange', bgClass: 'bg-orange', textClass: 'text-orange' },
  { level: 55, label: 'Unhealthy', color: 'red', bgClass: 'bg-red', textClass: 'text-red' },
];

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatTimestamp(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return timeStr;
  if (isYesterday) return `Yesterday ${timeStr}`;
  const dayName = date.toLocaleDateString([], { weekday: 'short' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dayName} ${dateStr} ${timeStr}`;
}

function analyzePeakEvents(samples, tier) {
  const tierInfo = TIERS.find(t => t.key === tier);
  const resolution = tierInfo?.resolution || 60;

  // Find peak PM2.5 sample
  const peakSample = samples.reduce((max, s) =>
    (s.pm2_5 != null && s.pm2_5 > (max?.pm2_5 ?? -1)) ? s : max, null);

  // Analyze each threshold
  const thresholds = PM25_THRESHOLDS.map(threshold => {
    const exceedances = samples.filter(s => s.pm2_5 != null && s.pm2_5 > threshold.level);
    const durationSeconds = exceedances.length * resolution;

    return {
      ...threshold,
      count: exceedances.length,
      duration: durationSeconds,
    };
  });

  return {
    thresholds,
    peak: peakSample?.pm2_5,
    peakTimestamp: peakSample?.timestamp,
  };
}

export default function PeakEventsCard({ samples = [], tier }) {
  const tierInfo = TIERS.find(t => t.key === tier);
  const analysis = analyzePeakEvents(samples, tier);

  const hasAnyExceedance = analysis.thresholds.some(t => t.count > 0);

  return (
    <Card className="p-4 sm:p-5 border-surface-1 bg-mantle">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-subtext uppercase tracking-wider">Peak Events</p>
        <span className="text-xs text-overlay">{tierInfo?.label || tier}</span>
      </div>

      <div className="space-y-2">
        {analysis.thresholds.map(t => (
          <div
            key={t.level}
            className="flex items-center justify-between py-2 border-b border-surface-1 last:border-0"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${t.bgClass}`} />
              <span className="text-sm text-subtext">&gt;{t.level} PM2.5</span>
            </div>
            <span className={`text-sm font-medium ${t.count > 0 ? t.textClass : 'text-overlay'}`}>
              {t.count > 0 ? formatDuration(t.duration) : 'None'}
            </span>
          </div>
        ))}
      </div>

      {analysis.peak != null && (
        <div className="mt-4 pt-3 border-t border-surface-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-overlay">Peak reading</span>
            <div className="text-right">
              <span className="text-sm font-semibold text-text tabular-nums">
                {analysis.peak.toFixed(1)} <span className="text-xs text-overlay">µg/m³</span>
              </span>
              {analysis.peakTimestamp != null && (
                <p className="text-[10px] text-overlay">{formatTimestamp(analysis.peakTimestamp)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasAnyExceedance && samples.length > 0 && (
        <div className="mt-3 text-center">
          <span className="text-xs text-green">All readings within healthy range</span>
        </div>
      )}
    </Card>
  );
}
