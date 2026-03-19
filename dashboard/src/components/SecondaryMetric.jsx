import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const RANGES = {
  voc: { good: 100, moderate: 200, max: 500, label: 'VOC Index', desc: 'Volatile organic compounds' },
  nox: { good: 10, moderate: 20, max: 100, label: 'NOx Index', desc: 'Nitrogen oxides' },
};

function getStatus(type, value) {
  const range = RANGES[type];
  if (value == null) return { level: 'unknown', label: '--', color: 'overlay', bg: 'bg-surface' };
  if (value <= range.good) return { level: 'good', label: 'Good', color: 'green', bg: 'bg-green/10' };
  if (value <= range.moderate) return { level: 'moderate', label: 'Moderate', color: 'yellow', bg: 'bg-yellow/10' };
  return { level: 'poor', label: 'Poor', color: 'red', bg: 'bg-red/10' };
}

export default function SecondaryMetric({ type, value, onClick }) {
  const range = RANGES[type];
  const status = getStatus(type, value);
  const percent = value != null ? Math.min(100, (value / range.max) * 100) : 0;

  const colorClasses = {
    green: { text: 'text-green', bar: 'bg-green' },
    yellow: { text: 'text-yellow', bar: 'bg-yellow' },
    red: { text: 'text-red', bar: 'bg-red' },
    overlay: { text: 'text-overlay', bar: 'bg-overlay' },
  };

  const colors = colorClasses[status.color];

  return (
    <Card className={`p-4 sm:p-5 border-0 ${status.bg} overflow-hidden cursor-pointer hover:ring-2 hover:ring-surface-1 transition-shadow`} onClick={onClick}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-1 sm:gap-2">
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-subtext uppercase tracking-wider">{range.label}</p>
          <p className="text-[10px] sm:text-xs text-overlay mt-0.5">{range.desc}</p>
        </div>
        <Badge variant={status.level === 'good' ? 'good' : status.level === 'moderate' ? 'moderate' : 'poor'}>
          {status.label}
        </Badge>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${colors.text}`}>
          {value != null ? Math.round(value) : '--'}
        </span>
      </div>

      <Progress
        value={percent}
        className="h-1.5"
        indicatorClassName={colors.bar}
      />
    </Card>
  );
}
