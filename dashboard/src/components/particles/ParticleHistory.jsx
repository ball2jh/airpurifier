import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { TIERS } from '@/components/HistoryChart';
import { getPmNumberArchiveQuery } from '@/api/esp32';
import StackedDistributionChart from './StackedDistributionChart';
import HeatmapCanvas from './HeatmapCanvas';

const PARTICLES_TIERS = TIERS.filter(t => t.source === 'archive');
const DEFAULT_PARTICLES_TIER = 'medium';

export default function ParticleHistory() {
  const [tier, setTier] = useState(DEFAULT_PARTICLES_TIER);
  const [mode, setMode] = useState('stacked');

  const tierConfig = PARTICLES_TIERS.find(t => t.key === tier) || PARTICLES_TIERS[0];

  const { data, isLoading, error } = useQuery({
    queryKey: ['particlesHistory', tier],
    queryFn: () => {
      const now = Math.floor(Date.now() / 1000);
      const from = tierConfig.maxAge > 0 ? now - tierConfig.maxAge : 0;
      return getPmNumberArchiveQuery(from, now, tierConfig.resolution);
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  const samples = data?.samples || [];

  return (
    <Card className="p-3 sm:p-4 md:p-6 border-surface-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 mb-4 sm:mb-6">
        <h3 className="text-lg font-semibold text-text">Particle History</h3>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex bg-mantle rounded-lg p-1 gap-0.5">
            <button
              onClick={() => setMode('stacked')}
              className={`px-3 py-2 sm:py-1.5 text-sm sm:text-xs font-medium rounded-md transition-colors ${
                mode === 'stacked' ? 'bg-blue text-base' : 'text-subtext hover:text-text'
              }`}
            >
              Stacked
            </button>
            <button
              onClick={() => setMode('heatmap')}
              className={`px-3 py-2 sm:py-1.5 text-sm sm:text-xs font-medium rounded-md transition-colors ${
                mode === 'heatmap' ? 'bg-blue text-base' : 'text-subtext hover:text-text'
              }`}
            >
              Heatmap
            </button>
          </div>

          {/* Tier selector */}
          <div className="relative min-w-0">
            <div className="flex gap-0.5 bg-mantle rounded-lg p-1 overflow-x-auto no-scrollbar">
              {PARTICLES_TIERS.map(t => (
                <button
                  key={t.key}
                  className={`inline-flex items-center justify-center px-2.5 sm:px-3 py-2 sm:py-1.5 text-sm sm:text-xs min-w-[36px] font-medium rounded-md transition-colors whitespace-nowrap ${
                    tier === t.key
                      ? 'bg-blue text-base'
                      : 'text-subtext hover:text-text hover:bg-surface'
                  }`}
                  onClick={() => setTier(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading/Error */}
      {isLoading && !data && (
        <div className="skeleton h-[300px] w-full" />
      )}
      {error && !data && (
        <div className="flex items-center justify-center h-[300px] text-red">
          Failed to load particle history
        </div>
      )}

      {/* Charts */}
      {!isLoading && !error && (
        mode === 'stacked'
          ? <StackedDistributionChart samples={samples} />
          : <HeatmapCanvas samples={samples} />
      )}

      {/* Info footer */}
      {data && samples.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-overlay">
          <span>{data.count} samples</span>
          <span className="text-surface-1">•</span>
          <span>{tierConfig.resolutionLabel} intervals</span>
        </div>
      )}
    </Card>
  );
}
