import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { HardDrive, Download, Save, Loader2, Check, X, Database, Wind, Trash2 } from 'lucide-react';
import { saveHistoryToFlash, getHistoryRaw, getArchiveStats, clearArchive, resetDevice, triggerSensorClean, getHealth } from '../api/esp32';

const TIERS = [
  { key: 'raw', label: '30m', resolution: '1s' },
  { key: 'fine', label: '6h', resolution: '1m' },
  { key: 'medium', label: '24h', resolution: '10m' },
  { key: 'coarse', label: '7d', resolution: '1h' },
  { key: 'daily', label: '30d', resolution: '6h' },
  { key: 'archive', label: '3y', resolution: '24h' },
];

const formatBytes = (bytes) => {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
};

export default function DataManagement() {
  const [saveStatus, setSaveStatus] = useState(null); // null, 'loading', 'success', 'error'
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [cleanStatus, setCleanStatus] = useState(null);
  const [resetStatus, setResetStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: archiveStats } = useQuery({
    queryKey: ['archiveStats'],
    queryFn: getArchiveStats,
    refetchInterval: 30000,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 10000,
  });

  const handleSaveToFlash = async () => {
    if (!window.confirm('Write current history to flash storage? Flash has limited write cycles — only do this before firmware updates or when needed.')) {
      return;
    }
    setSaveStatus('loading');
    setErrorMessage('');
    try {
      await saveHistoryToFlash();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus('error');
      setErrorMessage(err.message);
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadStatus('loading');
    setErrorMessage('');
    try {
      // Fetch all tiers
      const allData = {};
      const failedTiers = [];
      for (const tier of TIERS) {
        try {
          const csv = await getHistoryRaw(tier.key);
          allData[tier.key] = csv;
        } catch (err) {
          failedTiers.push(tier.key);
          allData[tier.key] = '';
        }
      }

      // Create a combined file with all tiers
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let combinedContent = `# Nettarion Air Purifier History Export\n`;
      combinedContent += `# Exported: ${new Date().toISOString()}\n`;
      if (failedTiers.length > 0) {
        combinedContent += `# WARNING: Failed to fetch tiers: ${failedTiers.join(', ')}\n`;
      }
      combinedContent += '\n';

      for (const tier of TIERS) {
        if (allData[tier.key]) {
          combinedContent += `\n# === ${tier.key.toUpperCase()} TIER (${tier.label} @ ${tier.resolution}) ===\n`;
          combinedContent += allData[tier.key];
          combinedContent += '\n';
        }
      }

      // Download the file
      const blob = new Blob([combinedContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `air-quality-history-${timestamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (failedTiers.length > 0) {
        setDownloadStatus('error');
        setErrorMessage(`Downloaded with missing data — failed tiers: ${failedTiers.join(', ')}`);
        setTimeout(() => { setDownloadStatus(null); setErrorMessage(''); }, 8000);
      } else {
        setDownloadStatus('success');
        setTimeout(() => setDownloadStatus(null), 3000);
      }
    } catch (err) {
      setDownloadStatus('error');
      setErrorMessage(err.message);
      setTimeout(() => setDownloadStatus(null), 5000);
    }
  };

  const handleDownloadArchive = () => {
    const now = Math.floor(Date.now() / 1000);
    window.open(`/archive/export?from=0&to=${now}`, '_blank');
  };

  const handleSensorClean = async () => {
    if (!window.confirm('Start sensor fan cleaning? The fan will run at max speed for ~10 seconds. Readings may be stale during cleaning.')) {
      return;
    }
    setCleanStatus('loading');
    setErrorMessage('');
    try {
      await triggerSensorClean();
      setCleanStatus('success');
      setTimeout(() => setCleanStatus(null), 3000);
    } catch (err) {
      setCleanStatus('error');
      setErrorMessage(err.message);
      setTimeout(() => setCleanStatus(null), 5000);
    }
  };

  const handleResetDevice = async () => {
    if (!window.confirm('Factory reset the air purifier? This erases all device history, VOC calibration, temperature offset, fan cleaning state, and the collector archive. The device will reboot and VOC readings will need ~3 hours to stabilize.')) {
      return;
    }
    setResetStatus('loading');
    setErrorMessage('');
    try {
      // Clear collector archive and device state in parallel
      const [, deviceResult] = await Promise.allSettled([
        clearArchive(),
        resetDevice(),
      ]);
      // Device reset is the critical path — if it succeeded, the device is rebooting
      if (deviceResult.status === 'rejected') throw deviceResult.reason;
      setResetStatus('success');
      // Device is rebooting — connection will drop
      setTimeout(() => setResetStatus(null), 10000);
    } catch (err) {
      setResetStatus('error');
      setErrorMessage(err.message);
      setTimeout(() => setResetStatus(null), 5000);
    }
  };

  const ButtonIcon = ({ status }) => {
    if (status === 'loading') return <Loader2 className="w-4 h-4 animate-spin" />;
    if (status === 'success') return <Check className="w-4 h-4" />;
    if (status === 'error') return <X className="w-4 h-4" />;
    return null;
  };

  return (
    <Card className="p-4 sm:p-6 border-surface-1 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <HardDrive className="w-5 h-5 text-overlay" />
        <h3 className="text-lg font-semibold text-text">Data Management</h3>
      </div>

      <p className="text-sm text-overlay mb-6">
        History auto-saves to flash every 6 hours. Manual save recommended before firmware updates.
      </p>

      <div className="space-y-4">
        {/* Save to Flash */}
        <div className="flex items-center justify-between p-4 bg-mantle rounded-lg">
          <div>
            <p className="text-sm font-medium text-text">Save to Flash</p>
            <p className="text-xs text-overlay mt-1">Persist current history data to ESP32 flash storage</p>
          </div>
          <button
            onClick={handleSaveToFlash}
            disabled={saveStatus === 'loading'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              saveStatus === 'success'
                ? 'bg-green text-base'
                : saveStatus === 'error'
                ? 'bg-red text-base'
                : 'bg-blue text-base hover:bg-blue/80'
            } disabled:opacity-50`}
          >
            {saveStatus ? <ButtonIcon status={saveStatus} /> : <Save className="w-4 h-4" />}
            {saveStatus === 'loading' ? 'Saving...' : saveStatus === 'success' ? 'Saved' : saveStatus === 'error' ? 'Failed' : 'Save'}
          </button>
        </div>

        {/* Clean Sensor */}
        <div className="flex items-center justify-between p-4 bg-mantle rounded-lg">
          <div>
            <p className="text-sm font-medium text-text">Clean Sensor Fan</p>
            <p className="text-xs text-overlay mt-1">Runs sensor fan at max speed for ~10s to remove dust</p>
          </div>
          <button
            onClick={handleSensorClean}
            disabled={cleanStatus === 'loading'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              cleanStatus === 'success'
                ? 'bg-green text-base'
                : cleanStatus === 'error'
                ? 'bg-red text-base'
                : 'bg-surface text-text hover:bg-surface-1'
            } disabled:opacity-50`}
          >
            {cleanStatus ? <ButtonIcon status={cleanStatus} /> : <Wind className="w-4 h-4" />}
            {cleanStatus === 'loading' ? 'Cleaning...' : cleanStatus === 'success' ? 'Started' : cleanStatus === 'error' ? 'Failed' : 'Clean'}
          </button>
        </div>

        {/* Download All */}
        <div className="flex items-center justify-between p-4 bg-mantle rounded-lg">
          <div>
            <p className="text-sm font-medium text-text">Download All Data</p>
            <p className="text-xs text-overlay mt-1">Export all history tiers as a CSV file</p>
          </div>
          <button
            onClick={handleDownloadAll}
            disabled={downloadStatus === 'loading'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              downloadStatus === 'success'
                ? 'bg-green text-base'
                : downloadStatus === 'error'
                ? 'bg-red text-base'
                : 'bg-surface text-text hover:bg-surface-1'
            } disabled:opacity-50`}
          >
            {downloadStatus ? <ButtonIcon status={downloadStatus} /> : <Download className="w-4 h-4" />}
            {downloadStatus === 'loading' ? 'Downloading...' : downloadStatus === 'success' ? 'Downloaded' : downloadStatus === 'error' ? 'Failed' : 'Download'}
          </button>
        </div>

        {/* Download Full Archive */}
        <div className="flex items-center justify-between p-4 bg-mantle rounded-lg">
          <div>
            <p className="text-sm font-medium text-text">Download Full Archive</p>
            <p className="text-xs text-overlay mt-1">Export all data from collector's long-term SQLite store</p>
          </div>
          <button
            onClick={handleDownloadArchive}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-surface text-text hover:bg-surface-1"
          >
            <Database className="w-4 h-4" />
            Download
          </button>
        </div>

        {/* Factory Reset */}
        <div className="flex items-center justify-between p-4 bg-mantle rounded-lg">
          <div>
            <p className="text-sm font-medium text-text">Factory Reset</p>
            <p className="text-xs text-overlay mt-1">Erase all history, calibration, settings, and collector archive. Device will reboot.</p>
          </div>
          <button
            onClick={handleResetDevice}
            disabled={resetStatus === 'loading'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              resetStatus === 'success'
                ? 'bg-green text-base'
                : resetStatus === 'error'
                ? 'bg-red text-base'
                : 'bg-red/20 text-red hover:bg-red/30'
            } disabled:opacity-50`}
          >
            {resetStatus ? <ButtonIcon status={resetStatus} /> : <Trash2 className="w-4 h-4" />}
            {resetStatus === 'loading' ? 'Resetting...' : resetStatus === 'success' ? 'Resetting...' : resetStatus === 'error' ? 'Failed' : 'Reset'}
          </button>
        </div>

        {/* Collector Archive Stats */}
        {archiveStats && (
          <div className="p-4 bg-mantle rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-overlay" />
              <p className="text-sm font-medium text-text">Collector Archive</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-semibold text-text">{archiveStats.total_samples.toLocaleString()}</p>
                <p className="text-xs text-overlay">Samples</p>
              </div>
              <div>
                <p className="text-sm font-medium text-text">
                  {archiveStats.oldest_timestamp ? new Date(archiveStats.oldest_timestamp * 1000).toLocaleDateString() : '—'}
                  {' → '}
                  {archiveStats.newest_timestamp ? new Date(archiveStats.newest_timestamp * 1000).toLocaleDateString() : '—'}
                </p>
                <p className="text-xs text-overlay">Date Range</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-text">{formatBytes(archiveStats.database_size_bytes)}</p>
                <p className="text-xs text-overlay">DB Size</p>
              </div>
            </div>
          </div>
        )}

        {/* Device History Tiers */}
        {health?.history?.tiers && (
          <div className="p-4 bg-mantle rounded-lg">
            <p className="text-sm font-medium text-text mb-3">Device History Tiers</p>
            <div className="space-y-2">
              {health.history.tiers.map(tier => (
                <div key={tier.name} className="flex items-center gap-3">
                  <span className="text-xs text-overlay w-14 shrink-0">{tier.name}</span>
                  <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue rounded-full transition-all"
                      style={{ width: `${tier.capacity > 0 ? (tier.count / tier.capacity) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-subtext tabular-nums w-20 text-right shrink-0">
                    {tier.count}/{tier.capacity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <p className="mt-4 text-xs text-red">{errorMessage}</p>
      )}
    </Card>
  );
}
