import { useState, useMemo, useRef, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { getStatus, getHealth, getHistory } from './api/esp32';
import { useTemperatureUnit, TemperatureUnitProvider, convertTemp, tempUnit } from './utils/temperature';
import AQICard, { calculateAQI } from './components/AQICard';
import SecondaryMetric from './components/SecondaryMetric';
import PMDetails from './components/PMDetails';
import EnvironmentStrip from './components/EnvironmentStrip';
import FanControl from './components/FanControl';
import HistoryChart, { TIERS } from './components/HistoryChart';
import RelativeAirQuality from './components/RelativeAirQuality';
import StatisticsSummaryCard from './components/StatisticsSummaryCard';
import PeakEventsCard from './components/PeakEventsCard';
import PeriodComparisonCard from './components/PeriodComparisonCard';
import SystemInfo from './components/SystemInfo';
import DataManagement from './components/DataManagement';
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

function TemperatureToggle() {
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

function SettingsPanel({ health }) {
  const [tab, setTab] = useState('system');

  const tabClass = (name) =>
    `px-4 py-2.5 sm:py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === name
        ? 'bg-blue text-base'
        : 'bg-surface text-subtext hover:bg-surface-1 hover:text-text'
    }`;

  return (
    <div className="w-full">
      <div className="flex gap-2 mb-4">
        <button className={tabClass('system')} onClick={() => setTab('system')}>System</button>
        <button className={tabClass('data')} onClick={() => setTab('data')}>Data</button>
        <button className={tabClass('errors')} onClick={() => setTab('errors')}>Errors</button>
      </div>

      {tab === 'system' && (
        <div className="space-y-4">
          <SystemInfo health={health} />
          <TemperatureToggle />
        </div>
      )}
      {tab === 'data' && <DataManagement />}
      {tab === 'errors' && <ErrorsPanel health={health} />}
    </div>
  );
}

function ErrorsPanel({ health }) {
  const hasErrors = health && (
    health.sensor?.crc_errors > 0 ||
    health.sensor?.i2c_errors > 0 ||
    health.fan?.stall_events > 0 ||
    health.wifi?.disconnect_count > 0
  );

  return (
    <div className="bg-surface rounded-xl p-6">
      <h2 className="text-xl font-semibold text-text mb-6">Error Log</h2>

      {!health && <p className="text-center text-overlay py-8">Loading health data...</p>}

      {health && !hasErrors && (
        <div className="text-center py-12 text-green">
          <span className="text-4xl block mb-4">&#10003;</span>
          <p className="text-lg">No errors recorded</p>
        </div>
      )}

      {health?.sensor && (health.sensor.crc_errors > 0 || health.sensor.i2c_errors > 0) && (
        <div className="mb-6 p-4 bg-mantle rounded-lg">
          <h3 className="text-base font-medium text-text border-b border-surface-1 pb-2 mb-4">Sensor Errors</h3>
          <div className="flex flex-wrap gap-6">
            {health.sensor.crc_errors > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-overlay uppercase">CRC Errors</span>
                <span className="text-2xl font-semibold text-red">{health.sensor.crc_errors}</span>
              </div>
            )}
            {health.sensor.i2c_errors > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-overlay uppercase">I2C Errors</span>
                <span className="text-2xl font-semibold text-red">{health.sensor.i2c_errors}</span>
              </div>
            )}
            {health.sensor.recoveries > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-overlay uppercase">Recovery Attempts</span>
                <span className="text-2xl font-semibold text-yellow">{health.sensor.recoveries}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {health?.fan && health.fan.stall_events > 0 && (
        <div className="mb-6 p-4 bg-mantle rounded-lg">
          <h3 className="text-base font-medium text-text border-b border-surface-1 pb-2 mb-4">Fan Errors</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Stall Events</span>
              <span className="text-2xl font-semibold text-red">{health.fan.stall_events}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Recovery Attempts</span>
              <span className="text-2xl font-semibold text-yellow">{health.fan.recovery_attempts}</span>
            </div>
          </div>
        </div>
      )}

      {health?.wifi && health.wifi.disconnect_count > 0 && (
        <div className="mb-6 p-4 bg-mantle rounded-lg">
          <h3 className="text-base font-medium text-text border-b border-surface-1 pb-2 mb-4">WiFi Errors</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Disconnections</span>
              <span className="text-2xl font-semibold text-red">{health.wifi.disconnect_count}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Reconnections</span>
              <span className="text-2xl font-semibold text-text">{health.wifi.connect_count}</span>
            </div>
          </div>
        </div>
      )}

      {health && (
        <div className="mt-6 pt-6 border-t border-surface-1">
          <h3 className="text-base font-medium text-text mb-4">Read Statistics</h3>
          <div className="flex flex-wrap gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Total Reads</span>
              <span className="text-xl font-semibold text-text">{health.sensor?.total_reads || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Successful</span>
              <span className="text-xl font-semibold text-text">{health.sensor?.successful_reads || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Success Rate</span>
              <span className="text-xl font-semibold text-text">
                {health.sensor?.total_reads > 0
                  ? ((health.sensor.successful_reads / health.sensor.total_reads) * 100).toFixed(2)
                  : 0}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const [view, setView] = useState('dashboard');
  const [selectedMetric, setSelectedMetric] = useState(null);
  const lastValidSensor = useRef(null);

  // History state (shared with HistoryChart and summary cards)
  const [historyTier, setHistoryTier] = useState('fine');
  const [visibleMetrics, setVisibleMetrics] = useState(['pm2_5']);

  const { data: status, isLoading, error, isFetching } = useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
    refetchInterval: 2000,
    refetchOnWindowFocus: false,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 10000,
  });

  const { data: fineHistory } = useQuery({
    queryKey: ['history', 'fine'],
    queryFn: () => getHistory('fine'),
    refetchInterval: 60000,
  });

  // Raw tier for short-term comparison (1h view)
  const { data: rawHistory } = useQuery({
    queryKey: ['history', 'raw'],
    queryFn: () => getHistory('raw'),
    refetchInterval: 5000,
  });

  // Resolve virtual tiers (15m, 30m) to their API tier
  const tierConfig = TIERS.find(t => t.key === historyTier);
  const apiTier = tierConfig?.apiKey || historyTier;

  // History data for selected tier (used by HistoryChart and summary cards)
  const { data: historyDataRaw, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ['history', apiTier],
    queryFn: () => getHistory(apiTier),
    refetchInterval: apiTier === 'raw' ? 5000 : 30000,
    retry: 2,
    staleTime: 5000,
  });

  // Filter data client-side for virtual tiers (15m, 30m)
  const historyData = useMemo(() => {
    if (!historyDataRaw || !tierConfig?.maxAge) return historyDataRaw;
    const samples = historyDataRaw.samples;
    if (samples.length === 0) return historyDataRaw;
    const maxTs = samples[samples.length - 1].timestamp;
    const cutoff = maxTs - tierConfig.maxAge;
    const filtered = samples.filter(s => s.timestamp >= cutoff);
    return { samples: filtered, count: filtered.length };
  }, [historyDataRaw, historyTier]);

  // Medium tier for 24h view
  const { data: mediumHistory } = useQuery({
    queryKey: ['history', 'medium'],
    queryFn: () => getHistory('medium'),
    refetchInterval: 60000,
  });

  // Coarse tier for 7d view
  const { data: coarseHistory } = useQuery({
    queryKey: ['history', 'coarse'],
    queryFn: () => getHistory('coarse'),
    refetchInterval: 5 * 60 * 1000,
  });

  // Daily tier for 30d view
  const { data: dailyHistory } = useQuery({
    queryKey: ['history', 'daily'],
    queryFn: () => getHistory('daily'),
    refetchInterval: 5 * 60 * 1000,
  });

  // Archive data for 3y view
  const { data: archiveData } = useQuery({
    queryKey: ['history', 'archive'],
    queryFn: () => getHistory('archive'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

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
          <div className="skeleton h-6 w-32" />
          <div className="flex gap-2">
            <div className="skeleton h-8 w-20" />
            <div className="skeleton h-8 w-16" />
            <div className="skeleton h-8 w-12" />
          </div>
        </div>
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
    <div className="min-h-screen p-4 pb-12 md:p-6 lg:p-8 max-w-5xl lg:max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-base md:text-xl font-semibold text-text truncate">Air Purifier</h1>
          <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green shadow-[0_0_6px_#a6e3a1]' : 'bg-red shadow-[0_0_6px_#f38ba8]'}`} />
          <span className={`text-[10px] tabular-nums hidden sm:inline ${secondsAgo > 10 ? 'text-yellow' : 'text-overlay'}`}>
            {secondsAgo > 0 ? `${secondsAgo}s ago` : 'live'}
          </span>
        </div>

        <nav className="flex gap-1 sm:gap-2">
          <button className={navClass('dashboard')} onClick={() => setView('dashboard')}>
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden">Home</span>
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
            null
          }
          onClose={() => setSelectedMetric(null)}
        />
      )}

      {view === 'history' && (
        <main className="space-y-6">
          <HistoryChart
            tier={historyTier}
            setTier={setHistoryTier}
            visibleMetrics={visibleMetrics}
            setVisibleMetrics={setVisibleMetrics}
            data={historyData}
            isLoading={historyLoading}
            error={historyError}
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
              archiveSamples={archiveData?.samples || []}
              visibleMetrics={visibleMetrics}
              tier={historyTier}
            />
          </div>
        </main>
      )}

      {view === 'fan' && (
        <main>
          <FanControl />
        </main>
      )}

      {view === 'system' && (
        <main>
          <SettingsPanel health={health} />
        </main>
      )}

      <footer className="mt-6 sm:mt-10 py-3 sm:py-5 border-t border-surface-1">
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
