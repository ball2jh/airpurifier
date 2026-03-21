import { useState, useMemo, useRef, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { getStatus, getHealth, getAllHistoryBinary, getArchiveQuery, getPmNumberArchiveQuery } from './api/esp32';
import { useTemperatureUnit, TemperatureUnitProvider, convertTemp, tempUnit } from './utils/temperature';
import AQICard, { calculateAQI } from './components/AQICard';
import SecondaryMetric from './components/SecondaryMetric';
import PMDetails from './components/PMDetails';
import EnvironmentStrip from './components/EnvironmentStrip';
import FanControl from './components/FanControl';
import HistoryChart, { TIERS, DEFAULT_TIER, DEFAULT_METRICS } from './components/HistoryChart';
import RelativeAirQuality from './components/RelativeAirQuality';
import StatisticsSummaryCard from './components/StatisticsSummaryCard';
import PeakEventsCard from './components/PeakEventsCard';
import PeriodComparisonCard, { TIER_DURATIONS } from './components/PeriodComparisonCard';
import SettingsPanel from './components/SettingsPanel';
import ParticlesView from './components/ParticlesView';
import MetricModal from './components/MetricModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 1000,
      staleTime: 1000,
      // Keep showing previous data while refetching or on error
      placeholderData: (previousData) => previousData,
    },
  },
});

function Dashboard() {
  const [view, setView] = useState('dashboard');
  const [selectedMetric, setSelectedMetric] = useState(null);
  const lastValidSensor = useRef(null);

  // History state (shared with HistoryChart and summary cards)
  const [historyTier, setHistoryTier] = useState(DEFAULT_TIER);
  const [visibleMetrics, setVisibleMetrics] = useState(DEFAULT_METRICS);

  const { data: status, isLoading, error, isFetching } = useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
    refetchInterval: 1000,
    refetchOnWindowFocus: false,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 10000,
  });

  // Single combined binary history query (replaces 6 separate CSV queries)
  const allHistoryRef = useRef(null);
  const lastServerTsRef = useRef(0);

  const TIER_CAPACITIES = useRef({ raw: 1800, fine: 360, medium: 144, coarse: 168, daily: 120, archive: 1095 }).current;

  const { data: allHistory, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ['history', 'all'],
    queryFn: async () => {
      const sinceTs = lastServerTsRef.current;
      const result = await getAllHistoryBinary(sinceTs);

      // Detect history reset: all tiers empty in incremental response, or server timestamp went backward
      const totalNewSamples = Object.values(result.tiers).reduce((sum, t) => sum + t.count, 0);
      const wasReset = result.isIncremental && totalNewSamples === 0 && allHistoryRef.current;
      if (wasReset) {
        // Server was reset — clear refs and re-fetch full data next cycle
        lastServerTsRef.current = 0;
        allHistoryRef.current = null;
        return result.tiers;  // Empty tiers this cycle, full fetch next
      }

      if (!result.isIncremental || !allHistoryRef.current) {
        // Full response — use as-is
        lastServerTsRef.current = result.serverTimestamp;
        allHistoryRef.current = result.tiers;
        return result.tiers;
      }

      // Incremental — merge new samples with existing data
      const merged = {};
      for (const tierName of Object.keys(result.tiers)) {
        const existing = allHistoryRef.current[tierName]?.samples || [];
        const newSamples = result.tiers[tierName].samples;
        if (newSamples.length === 0) {
          merged[tierName] = allHistoryRef.current[tierName] || { samples: [], count: 0 };
          continue;
        }
        const lastExistingTs = existing.length > 0 ? existing[existing.length - 1].timestamp : 0;
        const deduped = newSamples.filter(s => s.timestamp > lastExistingTs);
        const combined = [...existing, ...deduped];
        const capacity = TIER_CAPACITIES[tierName] || combined.length;
        const trimmed = combined.length > capacity
          ? combined.slice(combined.length - capacity)
          : combined;
        merged[tierName] = { samples: trimmed, count: trimmed.length };
      }

      lastServerTsRef.current = result.serverTimestamp;
      allHistoryRef.current = merged;
      return merged;
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
  });

  // Derive per-tier data from combined result
  const rawHistory = allHistory?.raw;
  const fineHistory = allHistory?.fine;
  const mediumHistory = allHistory?.medium;
  const coarseHistory = allHistory?.coarse;
  const dailyHistory = allHistory?.daily;
  const archiveData = allHistory?.archive;

  // Resolve tier config and determine data source
  const tierConfig = TIERS.find(t => t.key === historyTier);
  const isArchiveTier = tierConfig?.source === 'archive';

  // Archive query for collector-backed tiers
  const { data: archiveQueryDataRaw, isLoading: archiveLoading, error: archiveError } = useQuery({
    queryKey: ['archive', historyTier],
    queryFn: () => {
      const now = Math.floor(Date.now() / 1000);
      const from = tierConfig.maxAge > 0 ? now - tierConfig.maxAge : 0;
      return getArchiveQuery(from, now, tierConfig.resolution);
    },
    enabled: isArchiveTier,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  // PM number archive query (same time range as main archive)
  const { data: pmNumberData } = useQuery({
    queryKey: ['pmNumber', historyTier],
    queryFn: () => {
      const now = Math.floor(Date.now() / 1000);
      const from = tierConfig.maxAge > 0 ? now - tierConfig.maxAge : 0;
      return getPmNumberArchiveQuery(from, now, tierConfig.resolution);
    },
    enabled: isArchiveTier,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  // Merge PM number data into archive data by timestamp bucket
  const archiveQueryData = useMemo(() => {
    if (!archiveQueryDataRaw) return archiveQueryDataRaw;
    if (!pmNumberData?.samples?.length) return archiveQueryDataRaw;

    const ncByTs = new Map(pmNumberData.samples.map(s => [s.timestamp, s]));
    const merged = archiveQueryDataRaw.samples.map(s => {
      const nc = ncByTs.get(s.timestamp);
      return nc ? { ...s, ...nc } : s;
    });
    return { ...archiveQueryDataRaw, samples: merged };
  }, [archiveQueryDataRaw, pmNumberData]);

  // Separate query for PeriodComparisonCard: fetches 2x tier duration so splitPeriods() has a previous period
  const comparisonDuration = TIER_DURATIONS[historyTier] || 0;
  const { data: comparisonData } = useQuery({
    queryKey: ['comparison', historyTier],
    queryFn: () => {
      const now = Math.floor(Date.now() / 1000);
      const from = now - comparisonDuration * 2;
      const resolution = Math.max(tierConfig.resolution, Math.floor(comparisonDuration / 100));
      return getArchiveQuery(from, now, resolution);
    },
    enabled: !!tierConfig && comparisonDuration > 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  // ESP32 tier resolution for non-archive tiers
  const apiTier = tierConfig?.apiKey || historyTier;
  const esp32DataRaw = allHistory?.[apiTier] || null;

  // Filter data client-side for virtual tiers (15m, 30m)
  const esp32Data = useMemo(() => {
    if (!esp32DataRaw || !tierConfig?.maxAge) return esp32DataRaw;
    const samples = esp32DataRaw.samples;
    if (samples.length === 0) return esp32DataRaw;
    const maxTs = samples[samples.length - 1].timestamp;
    const cutoff = maxTs - tierConfig.maxAge;
    const filtered = samples.filter(s => s.timestamp >= cutoff);
    return { samples: filtered, count: filtered.length };
  }, [esp32DataRaw, historyTier]);

  // Pick the right data source
  const historyData = isArchiveTier ? archiveQueryData : esp32Data;

  // Connected = no current error, Disconnected = error (but we may still have cached data)
  const isConnected = !error;
  const hasData = !!status;

  // Track data freshness
  const lastUpdatedRef = useRef(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (status && !error) {
      lastUpdatedRef.current = Date.now();
    }
  }, [status, error]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdatedRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track last valid sensor data - only update when sensor reports valid data
  const rawSensor = status?.sensor || {};
  useEffect(() => {
    if (rawSensor.valid !== false && rawSensor.pm2_5 != null) {
      lastValidSensor.current = rawSensor;
    }
  }, [status]);

  // Use last valid sensor data, falling back to current (possibly invalid) data
  const sensor = lastValidSensor.current || rawSensor;

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-5xl lg:max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-base md:text-xl font-semibold text-text">Air Purifier</span>
            <span className="w-2 h-2 rounded-full bg-yellow animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-8 w-20" />
            <div className="skeleton h-8 w-16" />
            <div className="skeleton h-8 w-12" />
          </div>
        </div>
        <p className="text-sm text-overlay mb-4 animate-pulse">Connecting to device...</p>
        <div className="skeleton h-64 w-full mb-4" />
        <div className="skeleton h-40 w-full mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
        </div>
      </div>
    );
  }

  // Only show error screen if we've never successfully loaded data
  if (error && !hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-8">
        <h2 className="text-2xl font-semibold text-red mb-2">Connection Error</h2>
        <p className="text-text">Unable to reach ESP32</p>
        <p className="text-overlay text-sm mt-4">Make sure you're on the same network and the device is powered on.</p>
      </div>
    );
  }

  const fan = status?.fan || {};
  const { unit: tempUnitValue } = useTemperatureUnit();
  const temperature = convertTemp(sensor.temperature, tempUnitValue);

  const navClass = (name) =>
    `px-3 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
      view === name
        ? 'bg-blue text-base'
        : 'bg-surface text-subtext hover:bg-surface-1 hover:text-text'
    }`;

  return (
    <div className="min-h-screen flex flex-col p-4 pb-12 md:p-6 lg:p-8 max-w-5xl lg:max-w-6xl xl:max-w-screen-xl mx-auto overflow-x-hidden">
      <header className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-base md:text-xl font-semibold text-text truncate">Air Purifier</h1>
          <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green shadow-[0_0_6px_#a6e3a1]' : 'bg-red shadow-[0_0_6px_#f38ba8]'}`} />
          <span className={`text-xs tabular-nums hidden sm:inline transition-opacity ${secondsAgo > 5 ? 'opacity-100' : 'opacity-0'} ${secondsAgo > 10 ? 'text-yellow' : 'text-overlay'}`}>
            {secondsAgo}s ago
          </span>
        </div>

        <nav className="flex gap-1 sm:gap-2">
          <button className={navClass('dashboard')} onClick={() => setView('dashboard')}>
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden">Home</span>
          </button>
          <button className={navClass('particles')} onClick={() => setView('particles')}>
            <span className="hidden sm:inline">Particles</span>
            <span className="sm:hidden">PM</span>
          </button>
          <button className={navClass('history')} onClick={() => setView('history')}>History</button>
          <button className={navClass('fan')} onClick={() => setView('fan')}>Fan</button>
        </nav>

        <button
          className={`p-2 rounded-lg transition-colors ${
            view === 'system'
              ? 'bg-blue text-base'
              : 'bg-surface text-subtext hover:bg-surface-1 hover:text-text'
          }`}
          onClick={() => setView('system')}
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1">
      {view === 'dashboard' && (
        <main className="space-y-4">
          {/* Hero: AQI with integrated PM2.5 */}
          <AQICard
            pm25={sensor.pm2_5}
            samples={fineHistory?.samples || []}
            onClick={() => setSelectedMetric('aqi')}
            onPM25Click={() => setSelectedMetric('pm25')}
          />

          {/* Personal Context: How you're doing compared to history */}
          <RelativeAirQuality
            rawSamples={rawHistory?.samples || []}
            fineSamples={fineHistory?.samples || []}
            mediumSamples={mediumHistory?.samples || []}
            coarseSamples={coarseHistory?.samples || []}
            dailySamples={dailyHistory?.samples || []}
            archiveSamples={archiveData?.samples || []}
          />

          {/* Environment: Temperature & Humidity */}
          <EnvironmentStrip temperature={temperature} humidity={sensor.humidity} onMetricClick={setSelectedMetric} tempUnitLabel={tempUnit(tempUnitValue)} />

          {/* Air Quality Details: VOC, NOx, All PM sizes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SecondaryMetric type="voc" value={sensor.voc_index} onClick={() => setSelectedMetric('voc')} />
            <SecondaryMetric type="nox" value={sensor.nox_index} onClick={() => setSelectedMetric('nox')} />
            <PMDetails pm1_0={sensor.pm1_0} pm2_5={sensor.pm2_5} pm4_0={sensor.pm4_0} pm10={sensor.pm10} onMetricClick={setSelectedMetric} />
          </div>

        </main>
      )}

      {selectedMetric && (
        <MetricModal
          metric={selectedMetric}
          value={
            selectedMetric === 'pm25' ? sensor.pm2_5 :
            selectedMetric === 'aqi' ? calculateAQI(sensor.pm2_5)?.aqi :
            selectedMetric === 'voc' ? sensor.voc_index :
            selectedMetric === 'nox' ? sensor.nox_index :
            selectedMetric === 'temperature' ? temperature :
            selectedMetric === 'humidity' ? sensor.humidity :
            selectedMetric === 'pm1' ? sensor.pm1_0 :
            selectedMetric === 'pm4' ? sensor.pm4_0 :
            selectedMetric === 'pm10' ? sensor.pm10 :
            selectedMetric === 'nc_pm05' ? sensor.pm_number?.nc_pm0_5 :
            selectedMetric === 'nc_pm10_nc' ? sensor.pm_number?.nc_pm1_0 :
            selectedMetric === 'nc_pm25' ? sensor.pm_number?.nc_pm2_5 :
            selectedMetric === 'nc_pm40' ? sensor.pm_number?.nc_pm4_0 :
            selectedMetric === 'nc_pm100' ? sensor.pm_number?.nc_pm10 :
            selectedMetric === 'typical_size' ? sensor.pm_number?.typical_size :
            selectedMetric === 'fan_speed' ? fan.speed_percent :
            selectedMetric === 'fan_rpm' ? fan.rpm :
            selectedMetric === 'fan_auto_mode' ? sensor.pm2_5 :
            null
          }
          onClose={() => setSelectedMetric(null)}
        />
      )}

      {view === 'particles' && (
        <main>
          <ParticlesView sensor={sensor} onMetricClick={setSelectedMetric} />
        </main>
      )}

      {view === 'history' && (
        <main className="space-y-6">
          <HistoryChart
            tier={historyTier}
            setTier={setHistoryTier}
            visibleMetrics={visibleMetrics}
            setVisibleMetrics={setVisibleMetrics}
            data={historyData}
            isLoading={isArchiveTier ? archiveLoading : historyLoading}
            error={isArchiveTier ? archiveError : historyError}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <StatisticsSummaryCard
              samples={historyData?.samples || []}
              visibleMetrics={visibleMetrics}
              tier={historyTier}
            />
            <PeakEventsCard
              samples={historyData?.samples || []}
              tier={historyTier}
            />
            <PeriodComparisonCard
              samples={comparisonData?.samples || historyData?.samples || []}
              visibleMetrics={visibleMetrics}
              tier={historyTier}
            />
          </div>
        </main>
      )}

      {view === 'fan' && (
        <main>
          <FanControl onMetricClick={setSelectedMetric} />
        </main>
      )}

      {view === 'system' && (
        <main>
          <SettingsPanel health={health} />
        </main>
      )}
      </div>

      <footer className="mt-auto pt-6 sm:pt-10 py-3 sm:py-5 border-t border-surface-1">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-overlay">
          <span>© {new Date().getFullYear()} Nettarion LLC</span>
          <span>Air Purifier</span>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <TemperatureUnitProvider>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </TemperatureUnitProvider>
  );
}

export default App;
