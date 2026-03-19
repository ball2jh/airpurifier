import { Thermometer, Droplets } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

function getTempStatus(value, unit) {
  if (value == null) return { label: '--', color: 'overlay', bg: 'bg-surface-1/30' };
  const cool = unit === '°C' ? 18 : 65;
  const warm = unit === '°C' ? 26 : 78;
  if (value < cool) return { label: 'Cool', color: 'blue', bg: 'bg-blue/10' };
  if (value <= warm) return { label: 'Comfortable', color: 'green', bg: 'bg-green/10' };
  return { label: 'Warm', color: 'orange', bg: 'bg-orange/10' };
}

function getHumidityStatus(value) {
  if (value == null) return { label: '--', color: 'overlay', bg: 'bg-surface-1/30' };
  if (value < 30) return { label: 'Dry', color: 'orange', bg: 'bg-orange/10' };
  if (value <= 60) return { label: 'Comfortable', color: 'green', bg: 'bg-green/10' };
  return { label: 'Humid', color: 'cyan', bg: 'bg-cyan/10' };
}

function EnvironmentCard({ icon: Icon, label, value, unit, status, percent, onClick }) {
  const colorClasses = {
    blue: { text: 'text-blue', bar: 'bg-blue', icon: 'text-blue' },
    green: { text: 'text-green', bar: 'bg-green', icon: 'text-green' },
    orange: { text: 'text-orange', bar: 'bg-orange', icon: 'text-orange' },
    cyan: { text: 'text-cyan', bar: 'bg-cyan', icon: 'text-cyan' },
    overlay: { text: 'text-overlay', bar: 'bg-overlay', icon: 'text-overlay' },
  };

  const colors = colorClasses[status.color];

  return (
    <Card className={`p-4 sm:p-5 border-0 overflow-hidden ${status.bg} cursor-pointer hover:ring-2 hover:ring-surface-1 transition-shadow`} onClick={onClick}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-1 sm:gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.icon}`} />
          <span className="text-[10px] sm:text-xs font-medium text-subtext uppercase tracking-wider">{label}</span>
        </div>
        <span className={`text-[10px] sm:text-xs font-semibold uppercase ${colors.text}`}>{status.label}</span>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className={`text-3xl sm:text-4xl font-bold tabular-nums ${colors.text}`}>
          {value != null ? ((unit === '°F' || unit === '°C') ? value.toFixed(1) : value.toFixed(0)) : '--'}
        </span>
        <span className="text-base sm:text-lg text-overlay">{unit}</span>
      </div>

      <Progress
        value={percent}
        className="h-1.5"
        indicatorClassName={colors.bar}
      />
    </Card>
  );
}

export default function EnvironmentStrip({ temperature, humidity, onMetricClick, tempUnitLabel = '°F' }) {
  const tempStatus = getTempStatus(temperature, tempUnitLabel);
  const humidityStatus = getHumidityStatus(humidity);

  // Temperature progress bar range
  const tempMin = tempUnitLabel === '°C' ? 0 : 32;
  const tempMax = tempUnitLabel === '°C' ? 38 : 100;
  const tempPercent = temperature != null
    ? Math.min(100, Math.max(0, ((temperature - tempMin) / (tempMax - tempMin)) * 100))
    : 0;

  // Humidity: 0-100% range
  const humidityPercent = humidity != null ? Math.min(100, Math.max(0, humidity)) : 0;

  return (
    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-4">
      <EnvironmentCard
        icon={Thermometer}
        label="Temperature"
        value={temperature}
        unit={tempUnitLabel}
        status={tempStatus}
        percent={tempPercent}
        onClick={() => onMetricClick('temperature')}
      />
      <EnvironmentCard
        icon={Droplets}
        label="Humidity"
        value={humidity}
        unit="%"
        status={humidityStatus}
        percent={humidityPercent}
        onClick={() => onMetricClick('humidity')}
      />
    </div>
  );
}
