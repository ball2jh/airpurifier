import { memo } from 'react';
import AirColumnSimulation from './particles/AirColumnSimulation';
import DistributionBar from './particles/DistributionBar';
import TypicalSizeGauge from './particles/TypicalSizeGauge';
import MassCountComparison from './particles/MassCountComparison';
import ParticleHistory from './particles/ParticleHistory';

export default memo(function ParticlesView({ sensor, onMetricClick }) {
  const pmNumber = sensor?.pm_number;

  return (
    <div className="space-y-4">
      <AirColumnSimulation pmNumber={pmNumber} />
      <DistributionBar pmNumber={pmNumber} onMetricClick={onMetricClick} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TypicalSizeGauge typicalSize={pmNumber?.typical_size} onMetricClick={onMetricClick} />
        <MassCountComparison sensor={sensor} onMetricClick={onMetricClick} />
      </div>
      <ParticleHistory />
    </div>
  );
});
