import { Card } from '@/components/ui/card';

const PM_TYPES = [
  { key: 'pm1_0', label: 'PM1.0', good: 5, moderate: 15, metric: 'pm1' },
  { key: 'pm2_5', label: 'PM2.5', good: 12, moderate: 35, metric: 'pm25' },
  { key: 'pm4_0', label: 'PM4.0', good: 15, moderate: 40, metric: 'pm4' },
  { key: 'pm10', label: 'PM10', good: 20, moderate: 50, metric: 'pm10' },
];

function getColor(value, good, moderate) {
  if (value == null) return 'text-overlay';
  if (value <= good) return 'text-green';
  if (value <= moderate) return 'text-yellow';
  return 'text-red';
}

// Card background based on PM2.5 (primary air quality metric)
function getCardStatus(pm2_5) {
  if (pm2_5 == null) return { bg: 'bg-surface' };
  if (pm2_5 <= 12) return { bg: 'bg-green/10' };
  if (pm2_5 <= 35) return { bg: 'bg-yellow/10' };
  return { bg: 'bg-red/10' };
}

export default function PMDetails({ pm1_0, pm2_5, pm4_0, pm10, onMetricClick }) {
  const values = { pm1_0, pm2_5, pm4_0, pm10 };
  const cardStatus = getCardStatus(pm2_5);

  return (
    <Card className={`p-4 sm:p-5 border-0 ${cardStatus.bg} overflow-hidden`}>
      <p className="text-[10px] sm:text-xs font-medium text-subtext uppercase tracking-wider mb-1">Particulate Matter</p>
      <p className="text-[10px] sm:text-xs text-overlay mb-4">All particle sizes</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {PM_TYPES.map(pm => {
          const value = values[pm.key];
          const colorClass = getColor(value, pm.good, pm.moderate);

          return (
            <button
              key={pm.key}
              className="text-center p-2.5 sm:p-2 rounded-lg hover:bg-surface-1 transition-colors cursor-pointer"
              onClick={() => onMetricClick(pm.metric)}
            >
              <p className="text-[10px] sm:text-xs text-overlay mb-1">{pm.label}</p>
              <p className={`text-lg sm:text-xl font-semibold tabular-nums ${colorClass}`}>
                {value != null ? value.toFixed(1) : '--'}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] sm:text-xs text-overlay text-center mt-3">μg/m³</p>
    </Card>
  );
}
