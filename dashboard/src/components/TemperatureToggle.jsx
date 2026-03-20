import { useTemperatureUnit } from '../utils/temperature';

export default function TemperatureToggle() {
  const { unit, setUnit } = useTemperatureUnit();
  return (
    <div className="flex items-center justify-between p-4 bg-mantle rounded-lg">
      <div>
        <p className="text-sm font-medium text-text">Temperature Unit</p>
        <p className="text-xs text-overlay mt-1">Display temperatures in Fahrenheit or Celsius</p>
      </div>
      <div className="flex bg-surface rounded-lg p-1 gap-1">
        <button
          onClick={() => setUnit('F')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            unit === 'F' ? 'bg-blue text-base' : 'text-subtext hover:text-text'
          }`}
        >
          °F
        </button>
        <button
          onClick={() => setUnit('C')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            unit === 'C' ? 'bg-blue text-base' : 'text-subtext hover:text-text'
          }`}
        >
          °C
        </button>
      </div>
    </div>
  );
}
