import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// EPA AQI breakpoints for PM2.5 (24-hour average, but we use instantaneous)
const AQI_BREAKPOINTS = [
  { cLow: 0, cHigh: 12.0, iLow: 0, iHigh: 50, category: 'Good', color: 'green', description: 'Air quality is satisfactory' },
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100, category: 'Moderate', color: 'yellow', description: 'Unusually sensitive people should limit outdoor exertion' },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150, category: 'Unhealthy for Sensitive Groups', color: 'orange', description: 'Sensitive groups may experience effects' },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200, category: 'Unhealthy', color: 'red', description: 'Everyone may experience health effects' },
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300, category: 'Very Unhealthy', color: 'purple', description: 'Health alert: risk increased for everyone' },
  { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500, category: 'Hazardous', color: 'maroon', description: 'Emergency conditions' },
];

export function calculateAQI(pm25) {
  if (pm25 == null || pm25 < 0) return null;

  // Truncate to 1 decimal place per EPA spec (breakpoints are designed for truncated values)
  pm25 = Math.floor(pm25 * 10) / 10;

  // Find the appropriate breakpoint
  const bp = AQI_BREAKPOINTS.find(b => pm25 >= b.cLow && pm25 <= b.cHigh);

  if (!bp) {
    // Above scale - return max AQI with hazardous category
    return { aqi: 500, ...AQI_BREAKPOINTS[5] };
  }

  // Linear interpolation: AQI = ((iHigh - iLow) / (cHigh - cLow)) * (C - cLow) + iLow
  const aqi = Math.round(((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow);
  return { aqi, ...bp };
}

function getTrend(samples) {
  if (!samples || samples.length < 10) return null;
  const values = samples.map(s => s?.pm2_5).filter(v => v != null);
  if (values.length < 10) return null;
  const halfLen = Math.floor(values.length / 2);
  const oldAvg = values.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen;
  const newAvg = values.slice(-halfLen).reduce((a, b) => a + b, 0) / halfLen;
  if (oldAvg === 0) return null;
  const change = ((newAvg - oldAvg) / oldAvg) * 100;
  if (Math.abs(change) < 5) return { direction: 'stable', percent: 0 };
  return change > 0
    ? { direction: 'up', percent: Math.round(change) }
    : { direction: 'down', percent: Math.round(Math.abs(change)) };
}

function Sparkline({ samples, color }) {
  if (!samples || samples.length < 2) return null;
  const validSamples = samples.filter(s => s?.pm2_5 != null);
  if (validSamples.length < 2) return null;

  // Convert PM2.5 values to AQI for the sparkline
  const aqiValues = validSamples.map(s => calculateAQI(s.pm2_5)?.aqi).filter(v => v != null);
  if (aqiValues.length < 2) return null;

  // Get time range from samples
  const timestamps = validSamples.map(s => s.timestamp).filter(Boolean);
  const startTime = timestamps.length > 0 ? new Date(Math.min(...timestamps) * 1000) : null;
  const endTime = timestamps.length > 0 ? new Date(Math.max(...timestamps) * 1000) : null;
  const timeOpts = { hour: 'numeric', minute: '2-digit' };
  const startLabel = startTime?.toLocaleTimeString([], timeOpts) || '';
  const endLabel = endTime?.toLocaleTimeString([], timeOpts) || 'now';

  // Downsample to ~60 points
  const targetPoints = 60;
  const chunkSize = Math.max(1, Math.ceil(aqiValues.length / targetPoints));
  const downsampled = [];
  for (let i = 0; i < aqiValues.length; i += chunkSize) {
    const chunk = aqiValues.slice(i, i + chunkSize);
    const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
    downsampled.push(avg);
  }

  // Auto-scale with padding
  const dataMin = Math.min(...downsampled);
  const dataMax = Math.max(...downsampled);
  const dataRange = dataMax - dataMin;
  const minRange = 10;
  const padding_v = Math.max((minRange - dataRange) / 2, dataRange * 0.15);
  const minScale = Math.max(0, dataMin - padding_v);
  const maxScale = dataMax + padding_v;
  const range = maxScale - minScale;

  const height = 60;
  const width = 240;

  const points = downsampled.map((v, i) => ({
    x: (i / (downsampled.length - 1)) * width,
    y: height - ((v - minScale) / range) * (height - 8) - 4,
  }));

  // Smooth bezier curve
  const smoothing = 0.18;
  const line = (pointA, pointB) => {
    const lenX = pointB.x - pointA.x;
    const lenY = pointB.y - pointA.y;
    return { length: Math.sqrt(lenX ** 2 + lenY ** 2), angle: Math.atan2(lenY, lenX) };
  };

  const controlPoint = (current, previous, next, reverse) => {
    const p = previous || current;
    const n = next || current;
    const o = line(p, n);
    const angle = o.angle + (reverse ? Math.PI : 0);
    const length = o.length * smoothing;
    return { x: current.x + Math.cos(angle) * length, y: current.y + Math.sin(angle) * length };
  };

  const bezierPath = points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const cp1 = controlPoint(arr[i - 1], arr[i - 2], point, false);
    const cp2 = controlPoint(point, arr[i - 1], arr[i + 1], true);
    return `${acc} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${point.x},${point.y}`;
  }, '');

  const areaPath = `${bezierPath} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[60px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="aqiSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#aqiSparkGrad)" />
        <path
          d={bezierPath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-overlay mt-1">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

export default function AQICard({ pm25, samples, onClick, onPM25Click }) {
  const aqiData = calculateAQI(pm25);
  const trend = useMemo(() => getTrend(samples), [samples]);

  // Progress bar: 0-500 AQI scale, but cap visual at 300 for better UX
  const percent = aqiData ? Math.min(100, (aqiData.aqi / 300) * 100) : 0;

  const colorMap = {
    green: { bg: 'bg-green/10', text: 'text-green', bar: 'bg-green', hex: '#a6e3a1' },
    yellow: { bg: 'bg-yellow/10', text: 'text-yellow', bar: 'bg-yellow', hex: '#f9e2af' },
    orange: { bg: 'bg-orange/10', text: 'text-orange', bar: 'bg-orange', hex: '#fab387' },
    red: { bg: 'bg-red/10', text: 'text-red', bar: 'bg-red', hex: '#f38ba8' },
    purple: { bg: 'bg-purple/10', text: 'text-purple', bar: 'bg-purple', hex: '#cba6f7' },
    maroon: { bg: 'bg-red/20', text: 'text-red', bar: 'bg-red', hex: '#f38ba8' },
    gray: { bg: 'bg-surface-1/50', text: 'text-overlay', bar: 'bg-overlay', hex: '#6c7086' },
  };

  const colors = colorMap[aqiData?.color || 'gray'];

  const badgeVariant = aqiData?.color === 'green' ? 'good' :
                       aqiData?.color === 'yellow' ? 'moderate' : 'poor';

  return (
    <Card className={`relative overflow-hidden ${colors.bg} border-0 cursor-pointer hover:ring-2 hover:ring-surface-1 transition-shadow`} onClick={onClick}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${colors.bar}`} />

      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs sm:text-sm font-medium text-subtext uppercase tracking-wider">Air Quality Index</p>
            <p className="text-[10px] sm:text-xs text-overlay mt-1">US EPA Standard</p>
          </div>

          {trend && (
            <div className={`flex items-center gap-1 text-xs sm:text-sm ${
              trend.direction === 'up' ? 'text-red' :
              trend.direction === 'down' ? 'text-green' : 'text-overlay'
            }`}>
              {trend.direction === 'up' && <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />}
              {trend.direction === 'down' && <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
              {trend.direction === 'stable' && <Minus className="w-3 h-3 sm:w-4 sm:h-4" />}
              {trend.percent > 0 && <span>{trend.percent}%</span>}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 sm:gap-3 mb-2">
          <span className={`text-5xl sm:text-6xl md:text-7xl font-bold tabular-nums ${colors.text}`}>
            {aqiData ? aqiData.aqi : '--'}
          </span>
          <span className="text-lg sm:text-xl text-overlay">AQI</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-4">
          <Badge variant={badgeVariant}>
            {aqiData?.category || 'Unknown'}
          </Badge>
          <span className="text-xs sm:text-sm text-subtext">{aqiData?.description || 'No data available'}</span>
        </div>

        {/* PM2.5 source value */}
        <button
          className="flex items-center gap-2 mb-4 px-3 py-2 -mx-3 rounded-lg hover:bg-surface-1/50 transition-colors group"
          onClick={(e) => { e.stopPropagation(); onPM25Click?.(); }}
        >
          <span className="text-xs text-overlay uppercase tracking-wider">PM2.5</span>
          <span className="text-lg font-semibold text-text tabular-nums">
            {pm25 != null ? pm25.toFixed(1) : '--'}
          </span>
          <span className="text-xs text-overlay">µg/m³</span>
          <span className="text-[10px] text-overlay opacity-0 group-hover:opacity-100 transition-opacity ml-1">→ details</span>
        </button>

        <div className="mb-4">
          <Sparkline samples={samples} color={colors.hex} />
        </div>

        <Progress
          value={percent}
          className="h-2"
          indicatorClassName={`${colors.bar} shadow-lg`}
          style={{ '--tw-shadow-color': colors.hex }}
        />

        <div className="flex justify-between text-[10px] text-overlay mt-2">
          <span>0</span>
          <span>50</span>
          <span>100</span>
          <span>150</span>
          <span>200</span>
          <span>300+</span>
        </div>
      </div>
    </Card>
  );
}
