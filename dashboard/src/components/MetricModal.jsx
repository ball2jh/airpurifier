import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useTemperatureUnit, tempUnit as getTempUnit } from '@/utils/temperature';

const METRIC_INFO = {
  pm25: {
    title: 'PM2.5',
    subtitle: 'Fine Particulate Matter',
    description: 'Tiny particles less than 2.5 micrometers in diameter that can penetrate deep into the lungs and bloodstream.',
    scale: [
      { range: '0-12', level: 'Good', description: 'Air quality is satisfactory with little to no risk.' },
      { range: '12-35', level: 'Moderate', description: 'Acceptable for most, but sensitive individuals may experience effects.' },
      { range: '35-55', level: 'Unhealthy for Sensitive Groups', description: 'Sensitive groups (elderly, children, respiratory conditions) may be affected.' },
      { range: '55-150', level: 'Unhealthy', description: 'Everyone may begin to experience health effects.' },
      { range: '150+', level: 'Very Unhealthy', description: 'Health alert - everyone may experience serious effects.' },
    ],
    unit: 'μg/m³',
    sources: 'Combustion (vehicles, fires), dust, industrial emissions, cooking',
  },
  aqi: {
    title: 'Air Quality Index',
    subtitle: 'US EPA Standard',
    description: 'The Air Quality Index (AQI) is the EPA\'s standardized measure for reporting daily air quality. It tells you how clean or polluted your air is and what associated health effects might be a concern. The AQI is calculated from PM2.5 concentration using EPA-defined breakpoints.',
    scale: [
      { range: '0-50', level: 'Good', description: 'Air quality is satisfactory, and air pollution poses little or no risk.' },
      { range: '51-100', level: 'Moderate', description: 'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.' },
      { range: '101-150', level: 'Unhealthy for Sensitive Groups', description: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.' },
      { range: '151-200', level: 'Unhealthy', description: 'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.' },
      { range: '201-300', level: 'Very Unhealthy', description: 'Health alert: The risk of health effects is increased for everyone.' },
      { range: '301+', level: 'Hazardous', description: 'Health warning of emergency conditions: everyone is more likely to be affected.' },
    ],
    unit: 'AQI',
    sources: 'Calculated from PM2.5 using EPA AQI breakpoints: Good (0-12 µg/m³), Moderate (12.1-35.4), USG (35.5-55.4), Unhealthy (55.5-150.4), Very Unhealthy (150.5-250.4), Hazardous (250.5+)',
  },
  voc: {
    title: 'VOC Index',
    subtitle: 'Volatile Organic Compounds',
    description: 'The VOC Index mimics how a human nose perceives odors, comparing current conditions to a 24-hour average baseline of 100.',
    scale: [
      { range: '0-100', level: 'Below Average', description: 'Fewer VOCs than normal - fresh air or well-ventilated space.' },
      { range: '100', level: 'Average', description: 'Normal baseline - typical indoor VOC background from off-gassing materials.' },
      { range: '100-150', level: 'Slightly Elevated', description: 'Minor VOC event detected.' },
      { range: '150-250', level: 'Moderate', description: 'Noticeable VOC event - cooking, cleaning products, or new materials.' },
      { range: '250-400', level: 'High', description: 'Significant VOC presence - consider ventilation.' },
      { range: '400-500', level: 'Very High', description: 'Strong VOC event - increase ventilation immediately.' },
    ],
    unit: 'Index (1-500)',
    sources: 'Cooking, cleaning products, paints, adhesives, furniture off-gassing, personal care products, breathing',
  },
  nox: {
    title: 'NOx Index',
    subtitle: 'Nitrogen Oxides',
    description: 'The NOx Index detects oxidizing gases relative to a 24-hour baseline of 1. Unlike VOCs, NOx is typically absent indoors unless there\'s a specific source.',
    scale: [
      { range: '1', level: 'Normal', description: 'No significant NOx detected - this is the typical indoor state.' },
      { range: '1-10', level: 'Low', description: 'Minor NOx presence detected.' },
      { range: '10-20', level: 'Moderate', description: 'Noticeable NOx - possibly from gas appliance use.' },
      { range: '20-100', level: 'Elevated', description: 'Significant NOx event - likely gas stove or heating in use.' },
      { range: '100-500', level: 'High', description: 'High NOx levels - ensure proper ventilation when using gas appliances.' },
    ],
    unit: 'Index (1-500)',
    sources: 'Gas stoves, gas water heaters, gas furnaces, vehicle exhaust (from attached garage)',
  },
  temperature: (unit) => ({
    title: 'Temperature',
    subtitle: 'Ambient Air Temperature',
    description: 'The current air temperature in the monitored space.',
    scale: unit === '°C' ? [
      { range: 'Below 18°C', level: 'Cool', description: 'Below typical comfort range - may feel chilly.' },
      { range: '18-26°C', level: 'Comfortable', description: 'Ideal temperature range for most people.' },
      { range: 'Above 26°C', level: 'Warm', description: 'Above typical comfort range - may feel warm.' },
    ] : [
      { range: 'Below 65°F', level: 'Cool', description: 'Below typical comfort range - may feel chilly.' },
      { range: '65-78°F', level: 'Comfortable', description: 'Ideal temperature range for most people.' },
      { range: 'Above 78°F', level: 'Warm', description: 'Above typical comfort range - may feel warm.' },
    ],
    unit,
    sources: 'HVAC systems, sunlight, appliances, body heat, outdoor conditions',
  }),
  humidity: {
    title: 'Humidity',
    subtitle: 'Relative Humidity',
    description: 'The amount of water vapor in the air relative to the maximum it can hold at the current temperature.',
    scale: [
      { range: 'Below 30%', level: 'Dry', description: 'Low humidity - may cause dry skin, static electricity, and respiratory irritation.' },
      { range: '30-60%', level: 'Comfortable', description: 'Ideal humidity range for comfort and health.' },
      { range: 'Above 60%', level: 'Humid', description: 'High humidity - may feel muggy and promote mold growth.' },
    ],
    unit: '%',
    sources: 'Weather, cooking, showering, breathing, houseplants, HVAC systems',
  },
  pm1: {
    title: 'PM1.0',
    subtitle: 'Ultrafine Particles',
    description: 'The smallest measured particles (< 1 micrometer). These can penetrate deepest into the respiratory system.',
    scale: [
      { range: '0-5', level: 'Good', description: 'Low levels of ultrafine particles.' },
      { range: '5-15', level: 'Moderate', description: 'Moderate ultrafine particle levels.' },
      { range: '15+', level: 'Elevated', description: 'Elevated ultrafine particles - consider ventilation.' },
    ],
    unit: 'μg/m³',
    sources: 'Combustion, cooking, candles, vehicle emissions',
  },
  pm4: {
    title: 'PM4.0',
    subtitle: 'Fine Particles',
    description: 'Particles smaller than 4 micrometers that can reach the lower respiratory tract.',
    scale: [
      { range: '0-15', level: 'Good', description: 'Low particle levels.' },
      { range: '15-40', level: 'Moderate', description: 'Moderate particle levels.' },
      { range: '40+', level: 'Elevated', description: 'Elevated particles - consider ventilation.' },
    ],
    unit: 'μg/m³',
    sources: 'Dust, pollen, mold spores, combustion',
  },
  pm10: {
    title: 'PM10',
    subtitle: 'Coarse Particles',
    description: 'Particles smaller than 10 micrometers including dust, pollen, and mold spores.',
    scale: [
      { range: '0-20', level: 'Good', description: 'Low coarse particle levels.' },
      { range: '20-50', level: 'Moderate', description: 'Moderate coarse particle levels.' },
      { range: '50+', level: 'Elevated', description: 'Elevated coarse particles - may affect sensitive individuals.' },
    ],
    unit: 'μg/m³',
    sources: 'Dust, pollen, mold, construction, road dust',
  },
  nc_pm05: {
    title: 'NC PM0.5',
    subtitle: 'Number Concentration (< 0.5 µm)',
    description: 'Count of particles smaller than 0.5 micrometers per cubic centimeter. Number concentration is more sensitive to low-level events than mass concentration. Many small particles indicate combustion or smoke.',
    scale: [
      { range: '0-100', level: 'Low', description: 'Minimal ultrafine particle counts.' },
      { range: '100-500', level: 'Moderate', description: 'Moderate ultrafine particle activity.' },
      { range: '500+', level: 'Elevated', description: 'Significant ultrafine particle presence — likely combustion event.' },
    ],
    unit: '#/cm³',
    sources: 'Combustion, cooking, candles, vehicle emissions',
  },
  nc_pm10_nc: {
    title: 'NC PM1.0',
    subtitle: 'Number Concentration (< 1.0 µm)',
    description: 'Count of particles smaller than 1.0 micrometer per cubic centimeter. Includes ultrafine particles from combustion plus slightly larger aerosols.',
    scale: [
      { range: '0-100', level: 'Low', description: 'Minimal fine particle counts.' },
      { range: '100-500', level: 'Moderate', description: 'Moderate fine particle activity.' },
      { range: '500+', level: 'Elevated', description: 'Significant fine particle presence.' },
    ],
    unit: '#/cm³',
    sources: 'Combustion, cooking, candles, ambient aerosol',
  },
  nc_pm25: {
    title: 'NC PM2.5',
    subtitle: 'Number Concentration (< 2.5 µm)',
    description: 'Count of particles smaller than 2.5 micrometers per cubic centimeter. More sensitive to low-level PM events than mass concentration.',
    scale: [
      { range: '0-50', level: 'Low', description: 'Minimal particle counts.' },
      { range: '50-200', level: 'Moderate', description: 'Moderate particle activity.' },
      { range: '200+', level: 'Elevated', description: 'Significant particle presence.' },
    ],
    unit: '#/cm³',
    sources: 'Combustion, dust, cooking, industrial emissions',
  },
  nc_pm40: {
    title: 'NC PM4.0',
    subtitle: 'Number Concentration (< 4.0 µm)',
    description: 'Count of particles smaller than 4.0 micrometers per cubic centimeter. Includes respirable dust and pollen fragments in addition to finer combustion particles.',
    scale: [
      { range: '0-50', level: 'Low', description: 'Minimal particle counts.' },
      { range: '50-200', level: 'Moderate', description: 'Moderate particle activity.' },
      { range: '200+', level: 'Elevated', description: 'Significant particle presence — likely dust or mixed sources.' },
    ],
    unit: '#/cm³',
    sources: 'Dust, pollen, combustion, cooking',
  },
  nc_pm100: {
    title: 'NC PM10',
    subtitle: 'Number Concentration (< 10 µm)',
    description: 'Count of particles smaller than 10 micrometers per cubic centimeter. Includes all inhalable particles — from ultrafine combustion to coarse dust and pollen.',
    scale: [
      { range: '0-50', level: 'Low', description: 'Minimal coarse particle counts.' },
      { range: '50-200', level: 'Moderate', description: 'Moderate coarse particle activity.' },
      { range: '200+', level: 'Elevated', description: 'Significant coarse particle presence.' },
    ],
    unit: '#/cm³',
    sources: 'Dust, pollen, mold spores, construction activity',
  },
  typical_size: {
    title: 'Typical Particle Size',
    subtitle: 'Average Particle Diameter',
    description: 'The typical (average) diameter of particles in the air. Helps distinguish event types: cooking smoke produces many small particles (< 0.5 µm) while dust produces fewer, larger ones (> 2.5 µm).',
    scale: [
      { range: '< 0.5 µm', level: 'Very Fine', description: 'Ultrafine particles — likely combustion or smoke.' },
      { range: '0.5-1.0 µm', level: 'Fine', description: 'Fine particles — mix of combustion and ambient aerosol.' },
      { range: '1.0-2.5 µm', level: 'Medium', description: 'Medium particles — could be dust, pollen, or mixed sources.' },
      { range: '> 2.5 µm', level: 'Coarse', description: 'Coarse particles — likely dust, pollen, or mold spores.' },
    ],
    unit: 'µm',
    sources: 'Particle size depends on source: smoke/combustion (< 0.5 µm), cooking (0.3-1 µm), dust (1-10 µm), pollen (10-100 µm)',
  },
  fan_speed: {
    title: 'Fan Speed (PWM)',
    subtitle: 'Pulse Width Modulation Duty Cycle',
    description: 'The PWM duty cycle controls how much power is delivered to the fan motor. 0% means the fan is off, 100% means full speed. The ESP32 generates a 25 kHz PWM signal that the fan\'s built-in controller uses to regulate motor speed.',
    scale: [
      { range: '0%', level: 'Off', description: 'Fan is not spinning. No air filtration.' },
      { range: '1-25%', level: 'Low', description: 'Quiet operation. Suitable for sleeping or low-pollution conditions.' },
      { range: '26-50%', level: 'Medium', description: 'Balanced airflow and noise. Good for general use.' },
      { range: '51-75%', level: 'High', description: 'Strong airflow. Noticeably louder but effective for elevated PM.' },
      { range: '76-100%', level: 'Max', description: 'Maximum filtration. Use during cooking, smoke events, or high outdoor pollution.' },
    ],
    unit: '%',
    sources: 'Set manually via presets/gauge or automatically by auto mode based on PM2.5 levels',
  },
  fan_rpm: {
    title: 'Fan RPM',
    subtitle: 'Actual Rotational Speed',
    description: 'The measured rotational speed of the Arctic P14 Pro fan in revolutions per minute. The fan reports its speed via a tachometer signal. RPM may differ slightly from the expected value for a given PWM due to bearing friction, air resistance, and filter loading.',
    scale: [
      { range: '0', level: 'Stopped', description: 'Fan is not spinning. Below ~4% PWM the fan cannot start.' },
      { range: '426-831', level: 'Low (4-25%)', description: 'Quiet operation, ~426-831 RPM.' },
      { range: '832-1386', level: 'Medium (26-50%)', description: 'Moderate speed, ~832-1386 RPM.' },
      { range: '1387-1944', level: 'High (51-75%)', description: 'Strong airflow, ~1387-1944 RPM.' },
      { range: '1945-2472', level: 'Max (76-100%)', description: 'Full speed, up to 2472 RPM.' },
    ],
    unit: 'RPM',
    sources: 'Arctic P14 Pro 140mm fan with tachometer output. Stall detection triggers when RPM reads 0 at >3% PWM',
  },
  fan_pq_curve: {
    title: 'Pressure vs Airflow',
    subtitle: 'Fan Performance Curve (PQ Curve)',
    description: 'The PQ curve shows the tradeoff between static pressure and airflow volume. As the filter loads with particles, backpressure increases and airflow decreases — the operating point moves left along the curve. A fan with higher static pressure capability maintains better airflow through dirty filters.',
    scale: [
      { range: '107 CFM @ 0 mmH\u2082O', level: 'Free Air', description: 'Maximum airflow with no restriction (no filter).' },
      { range: '~80 CFM @ 2.2 mmH\u2082O', level: 'Clean Filter', description: 'Typical operating point with a clean HEPA filter.' },
      { range: '~40 CFM @ 3.4 mmH\u2082O', level: 'Loaded Filter', description: 'Filter is accumulating particles, airflow reduced.' },
      { range: '0 CFM @ 4.2 mmH\u2082O', level: 'Stall Pressure', description: 'Maximum static pressure — no airflow (completely blocked).' },
    ],
    unit: 'CFM / mmH\u2082O',
    sources: 'Arctic P14 Pro specs: 107 CFM max airflow, 4.2 mmH\u2082O max static pressure at 2472 RPM',
  },
  fan_auto_mode: {
    title: 'Auto Mode',
    subtitle: 'PM2.5-Based Automatic Fan Control',
    description: 'In auto mode, the firmware continuously maps PM2.5 concentration to fan speed using a linear gradient from 5 to 35 \u00b5g/m\u00b3 (25% to 100%). Floor is the WHO annual guideline (excellent air); ceiling is the EPA boundary where air becomes unhealthy for sensitive groups. Speed changes are slew-rate limited at 2% per second for smooth, quiet transitions.',
    scale: [
      { range: 'PM2.5 \u2264 5', level: 'Minimum (25%)', description: 'Below WHO annual guideline \u2014 air is excellent, gentle circulation only.' },
      { range: 'PM2.5 \u2248 15', level: 'Low (50%)', description: 'At WHO 24-hour guideline \u2014 moderate speed for steady filtration.' },
      { range: 'PM2.5 \u2248 25', level: 'Moderate (75%)', description: 'Approaching EPA Moderate ceiling \u2014 higher speed to bring levels down.' },
      { range: 'PM2.5 \u2265 35', level: 'Maximum (100%)', description: 'EPA Unhealthy for Sensitive Groups boundary \u2014 maximum speed.' },
    ],
    unit: '\u00b5g/m\u00b3 \u2192 %',
    sources: 'Firmware auto mode with continuous linear mapping (5\u201335 \u00b5g/m\u00b3 \u2192 25\u2013100%) based on WHO/EPA guidelines. 2%/s slew rate. Manual override returns to auto after a timeout period',
  },
};

function getCurrentLevel(metric, value, tempUnit) {
  if (value == null) return null;

  const thresholds = {
    pm25: [12, 35, 55, 150],
    aqi: [50, 100, 150, 200, 300],
    voc: [100, 100, 150, 250, 400],
    nox: [1, 10, 20, 100],
    temperature: tempUnit === 'C' ? [18, 26] : [65, 78],
    humidity: [30, 60],
    pm1: [5, 15],
    pm4: [15, 40],
    pm10: [20, 50],
    nc_pm05: [100, 500],
    nc_pm10_nc: [100, 500],
    nc_pm25: [50, 200],
    nc_pm40: [50, 200],
    nc_pm100: [50, 200],
    typical_size: [0.5, 1.0, 2.5],
    fan_speed: [0, 25, 50, 75],
    fan_rpm: [0, 831, 1386, 1944],
    fan_auto_mode: [15, 25, 35],
  };

  const levels = thresholds[metric];
  if (!levels) return 0;

  for (let i = 0; i < levels.length; i++) {
    if (value <= levels[i]) return i;
  }
  return levels.length;
}

export default function MetricModal({ metric, value, onClose }) {
  const { unit: tempUnitValue } = useTemperatureUnit();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const raw = METRIC_INFO[metric];
  const info = typeof raw === 'function' ? raw(getTempUnit(tempUnitValue)) : raw;

  if (!info) return null;

  const currentLevelIndex = getCurrentLevel(metric, value, tempUnitValue);
  const reversedScale = [...info.scale].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface border-surface-1 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-surface-1 hover:bg-mantle transition-colors"
        >
          <X className="w-5 h-5 text-subtext" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-text">{info.title}</h2>
          <p className="text-sm text-subtext">{info.subtitle}</p>
        </div>

        <p className="text-sm text-text mb-6">{info.description}</p>

        <div className="mb-6">
          <h3 className="text-xs font-semibold text-subtext uppercase tracking-wider mb-3">Scale ({info.unit})</h3>
          <div className="space-y-2">
            {reversedScale.map((item, i) => {
              const originalIndex = info.scale.length - 1 - i;
              const isCurrentLevel = currentLevelIndex === originalIndex;

              return (
                <div
                  key={i}
                  className={`p-3 rounded-lg transition-colors ${
                    isCurrentLevel
                      ? 'bg-blue/20 ring-2 ring-blue'
                      : 'bg-mantle'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${isCurrentLevel ? 'text-blue' : 'text-text'}`}>
                      {item.level}
                      {isCurrentLevel && <span className="ml-2 text-xs">(Current)</span>}
                    </span>
                    <span className="text-xs text-overlay">{item.range}</span>
                  </div>
                  <p className="text-xs text-subtext">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">Common Sources</h3>
          <p className="text-sm text-overlay">{info.sources}</p>
        </div>
      </Card>
    </div>
  );
}
