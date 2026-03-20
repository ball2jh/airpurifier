import { Card } from '@/components/ui/card';

const NC_TYPES = [
  { key: 'nc_pm0_5', label: 'NC 0.5', good: 100, moderate: 500, metric: 'nc_pm05' },
  { key: 'nc_pm1_0', label: 'NC 1.0', good: 100, moderate: 500, metric: 'nc_pm10_nc' },
  { key: 'nc_pm2_5', label: 'NC 2.5', good: 50, moderate: 200, metric: 'nc_pm25' },
  { key: 'nc_pm4_0', label: 'NC 4.0', good: 50, moderate: 200, metric: 'nc_pm40' },
  { key: 'nc_pm10', label: 'NC 10', good: 50, moderate: 200, metric: 'nc_pm100' },
  { key: 'typical_size', label: 'Size', good: null, moderate: null, metric: 'typical_size', unit: 'µm' },
];

function getColor(value, good, moderate) {
  if (value == null) return 'text-overlay';
  if (good == null) return 'text-text';
  if (value <= good) return 'text-green';
  if (value <= moderate) return 'text-yellow';
  return 'text-red';
}

export default function NumberConcentration({ pmNumber, onMetricClick }) {
  if (!pmNumber) return null;

  return (
    <Card className="p-4 sm:p-5 border-0 bg-surface overflow-hidden">
      <p className="text-[10px] sm:text-xs font-medium text-subtext uppercase tracking-wider mb-1">Particle Counts</p>
      <p className="text-[10px] sm:text-xs text-overlay mb-4">Number concentration by size</p>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {NC_TYPES.map(nc => {
          const value = pmNumber[nc.key];
          const colorClass = getColor(value, nc.good, nc.moderate);

          return (
            <button
              key={nc.key}
              className="text-center p-2.5 sm:p-2 rounded-lg hover:bg-surface-1 transition-colors cursor-pointer"
              onClick={() => onMetricClick(nc.metric)}
            >
              <p className="text-[10px] sm:text-xs text-overlay mb-1">{nc.label}</p>
              <p className={`text-lg sm:text-xl font-semibold tabular-nums ${colorClass}`}>
                {value != null ? (nc.key === 'typical_size' ? value.toFixed(2) : value.toFixed(0)) : '--'}
              </p>
              {nc.unit && <p className="text-[10px] text-overlay mt-0.5">{nc.unit}</p>}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] sm:text-xs text-overlay text-center mt-3">#/cm³ (size in µm)</p>
    </Card>
  );
}
