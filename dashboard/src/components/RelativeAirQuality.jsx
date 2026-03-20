import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { STATUS_COLORS } from '../constants/colors';

const TIMESPAN_OPTIONS = [
  { key: 'hour', label: '1h', tier: 'raw' },
  { key: 'sixhour', label: '6h', tier: 'fine' },
  { key: 'day', label: '24h', tier: 'medium' },
  { key: 'week', label: '7d', tier: 'coarse' },
  { key: 'month', label: '30d', tier: 'daily' },
  { key: 'all', label: 'All', tier: 'archive' },
];

// Calculate percentile of a value within a sorted array using midpoint method
function getPercentile(sortedValues, value) {
  if (sortedValues.length === 0 || value == null) return null;

  let below = 0, equal = 0;
  for (const v of sortedValues) {
    if (v < value) below++;
    else if (v === value) equal++;
    else break; // Array is sorted, so we can stop early
  }

  return ((below + 0.5 * equal) / sortedValues.length) * 100;
}

// Calculate specific percentile value from sorted array with linear interpolation
function percentileValue(sortedValues, percentile) {
  if (sortedValues.length === 0) return null;
  const pos = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sortedValues[lower];
  const frac = pos - lower;
  return sortedValues[lower] * (1 - frac) + sortedValues[upper] * frac;
}

// Get status based on percentile (for air quality, lower is better)
function getStatus(percentile) {
  if (percentile == null) return { label: 'Unknown', color: 'overlay', description: 'Not enough data' };

  // Lower percentile = better air quality (fewer readings were better than this)
  if (percentile <= 25) return {
    label: 'Excellent',
    color: 'green',
    description: 'Better than most of your readings'
  };
  if (percentile <= 50) return {
    label: 'Good',
    color: 'green',
    description: 'Better than usual'
  };
  if (percentile <= 75) return {
    label: 'Typical',
    color: 'yellow',
    description: 'Around your normal range'
  };
  if (percentile <= 90) return {
    label: 'Elevated',
    color: 'orange',
    description: 'Worse than usual'
  };
  return {
    label: 'High',
    color: 'red',
    description: 'Among your worst readings'
  };
}

function DistributionGauge({ percentile, minValue, maxValue, avgValue }) {
  // Position on the gauge (0-100%)
  const position = percentile != null ? Math.min(100, Math.max(0, percentile)) : 50;

  return (
    <div className="mt-4 mb-2">
      {/* Gauge bar with ball */}
      <div className="relative h-4 flex items-center">
        {/* Background gradient bar */}
        <div className="absolute inset-x-0 h-3 rounded-full bg-gradient-to-r from-green via-yellow via-60% to-red opacity-40" />

        {/* Percentile zone indicators */}
        <div
          className="absolute h-5 border-l border-surface-1/50"
          style={{ left: '25%' }}
        />
        <div
          className="absolute h-5 border-l-2 border-overlay/50"
          style={{ left: '50%' }}
        />
        <div
          className="absolute h-5 border-l border-surface-1/50"
          style={{ left: '75%' }}
        />

        {/* Current value marker (ball) */}
        <div
          className="absolute -translate-x-1/2 transition-all duration-500"
          style={{ left: `${position}%` }}
        >
          <div className="w-4 h-4 rounded-full bg-text border-2 border-base shadow-lg" />
        </div>
      </div>

      {/* Scale labels with values */}
      <div className="flex justify-between mt-3 text-xs">
        <div className="text-left">
          <span className="text-green font-semibold tabular-nums">{minValue?.toFixed(1)}</span>
          <span className="text-overlay ml-1">best</span>
        </div>
        <div className="text-center">
          <span className="text-subtext tabular-nums">{avgValue?.toFixed(1)}</span>
          <span className="text-overlay ml-1">avg</span>
        </div>
        <div className="text-right">
          <span className="text-red font-semibold tabular-nums">{maxValue?.toFixed(1)}</span>
          <span className="text-overlay ml-1">worst</span>
        </div>
      </div>
    </div>
  );
}

export default function RelativeAirQuality({ rawSamples = [], fineSamples = [], mediumSamples = [], coarseSamples = [], dailySamples = [], archiveSamples = [] }) {
  const [timespan, setTimespan] = useState('month');

  const analysis = useMemo(() => {
    const timespanConfig = TIMESPAN_OPTIONS.find(t => t.key === timespan);
    const tier = timespanConfig?.tier || 'archive';

    // Choose data source based on tier
    const tierMap = {
      raw: rawSamples,
      fine: fineSamples,
      medium: mediumSamples,
      coarse: coarseSamples,
      daily: dailySamples,
      archive: archiveSamples,
    };
    const sourceSamples = tierMap[tier] || archiveSamples;

    // Extract and sort PM2.5 values, filtering out nulls
    const pm25Values = sourceSamples
      .map(s => s.pm2_5)
      .filter(v => v != null && !isNaN(v))
      .sort((a, b) => a - b);

    // Handle empty or single value cases
    if (pm25Values.length === 0) {
      return { sampleCount: 0 };
    }

    // Get the most recent sample from this tier as the "current" value
    const mostRecentSample = sourceSamples.reduce((latest, s) =>
      s.timestamp > (latest?.timestamp ?? 0) ? s : latest, null);
    const currentValue = mostRecentSample?.pm2_5;

    // Calculate percentiles and average
    const p25 = percentileValue(pm25Values, 25);
    const p50 = percentileValue(pm25Values, 50); // median
    const p75 = percentileValue(pm25Values, 75);
    const minValue = pm25Values[0];
    const maxValue = pm25Values[pm25Values.length - 1];
    const avgValue = pm25Values.reduce((a, b) => a + b, 0) / pm25Values.length;

    // Calculate current value's percentile
    const currentPercentile = getPercentile(pm25Values, currentValue);

    // For display: "Better than X%" means (100 - percentile) of readings were worse
    const betterThanPercent = currentPercentile != null ? Math.round(100 - currentPercentile) : null;

    return {
      currentValue,
      percentile: currentPercentile,
      betterThanPercent,
      p25,
      p50,
      p75,
      minValue,
      maxValue,
      avgValue,
      sampleCount: pm25Values.length,
    };
  }, [rawSamples, fineSamples, mediumSamples, coarseSamples, dailySamples, archiveSamples, timespan]);

  const status = getStatus(analysis.percentile);

  const colors = STATUS_COLORS[status.color];
  const hasData = analysis.sampleCount > 0;

  return (
    <Card className={`relative overflow-hidden ${hasData ? colors.bg : 'bg-mantle'} border-0`}>
      {hasData && <div className={`absolute top-0 left-0 right-0 h-1 ${colors.bar}`} />}

      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
          <div>
            <p className="text-xs sm:text-sm font-medium text-subtext uppercase tracking-wider">
              Compared to Your History
            </p>
            <p className="text-xs text-overlay mt-1">
              Based on {analysis.sampleCount.toLocaleString()} reading{analysis.sampleCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Trend indicator — fixed width so buttons don't shift */}
            <div className={`w-5 flex items-center justify-center ${hasData ? colors.text : ''}`}>
              {hasData && analysis.percentile <= 40 && <TrendingDown className="w-4 h-4" />}
              {hasData && analysis.percentile > 40 && analysis.percentile < 60 && <Minus className="w-4 h-4" />}
              {hasData && analysis.percentile >= 60 && <TrendingUp className="w-4 h-4" />}
            </div>

            {/* Timespan selector */}
            <div className="flex gap-0.5 bg-mantle rounded-lg p-1 overflow-x-auto no-scrollbar">
              {TIMESPAN_OPTIONS.map(t => (
                <button
                  key={t.key}
                  className={`px-2.5 sm:px-3 py-2 sm:py-1 text-xs font-medium rounded-md transition-colors ${
                    timespan === t.key
                      ? 'bg-blue text-base'
                      : 'text-subtext hover:text-text hover:bg-surface'
                  }`}
                  onClick={() => setTimespan(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {hasData ? (
          <>
            <div className="flex items-baseline gap-3 mb-1">
              <span className={`text-3xl sm:text-4xl font-bold ${colors.text}`}>
                {status.label}
              </span>
              <span className="text-xl sm:text-2xl font-semibold text-text tabular-nums">
                {analysis.currentValue?.toFixed(1) || '--'}
              </span>
              <span className="text-sm text-overlay">µg/m³</span>
            </div>

            <p className="text-sm text-subtext mb-2">{status.description}</p>

            {analysis.betterThanPercent != null && (
              <p className="text-xs text-overlay">
                Better than <span className="font-semibold text-text">{analysis.betterThanPercent}%</span> of your readings
              </p>
            )}

            <DistributionGauge
              percentile={analysis.percentile}
              minValue={analysis.minValue}
              maxValue={analysis.maxValue}
              avgValue={analysis.avgValue}
            />

            {/* Median and typical range */}
            <div className="flex justify-between mt-4 pt-3 border-t border-surface-1/50 text-xs text-overlay">
              <span>Median: <span className="text-subtext font-medium">{analysis.p50?.toFixed(1)}</span></span>
              <span>Typical: <span className="text-subtext font-medium">{analysis.p25?.toFixed(1)}–{analysis.p75?.toFixed(1)}</span></span>
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            <p className="text-sm text-overlay">No historical data for this timespan yet</p>
            <p className="text-xs text-overlay mt-1">Data will appear as readings are collected</p>
          </div>
        )}
      </div>
    </Card>
  );
}
