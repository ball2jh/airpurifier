import { computeDifferentialBins } from '@/utils/particleSource';

export default function MassCountComparison({ sensor }) {
  const pm = sensor || {};
  const nc = pm.pm_number || {};
  // Use sum of rounded differential bins so the total matches DistributionBar
  const bins = computeDifferentialBins(nc);
  const totalCount = bins
    ? bins.reduce((s, b) => s + Math.round(b.count), 0)
    : nc.nc_pm10;

  return (
    <div className="bg-surface rounded-xl p-4 sm:p-5">
      <p className="text-xs sm:text-sm font-medium text-subtext uppercase tracking-wider mb-3">Mass vs Count</p>

      <div className="grid grid-cols-2 gap-4">
        {/* Mass side */}
        <div>
          <p className="text-xs text-overlay mb-2">Mass (µg/m³)</p>
          <div className="space-y-1.5">
            {[
              { label: 'PM1', value: pm.pm1_0 },
              { label: 'PM2.5', value: pm.pm2_5 },
              { label: 'PM4', value: pm.pm4_0 },
              { label: 'PM10', value: pm.pm10 },
            ].map(m => (
              <div key={m.label} className="flex items-baseline justify-between">
                <span className="text-xs text-overlay">{m.label}</span>
                <span className="text-sm font-semibold text-text tabular-nums">
                  {m.value != null ? m.value.toFixed(1) : '--'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Count side */}
        <div>
          <p className="text-xs text-overlay mb-2">Count (#/cm³)</p>
          <div className="flex flex-col items-center justify-center h-[calc(100%-1.5rem)]">
            <span className="text-3xl font-bold text-text tabular-nums">
              {totalCount != null ? totalCount.toFixed(0) : '--'}
            </span>
            <span className="text-xs text-overlay mt-1">total particles</span>
            {pm.pm2_5 != null && totalCount != null && totalCount > 0 && (
              <span className="text-xs text-overlay mt-2">
                {(pm.pm2_5 / totalCount).toFixed(3)} µg per particle
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
