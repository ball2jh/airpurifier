import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { HardDrive, Download, Save, Loader2, Check, X, Database } from 'lucide-react';
import { saveHistoryToFlash, getHistoryRaw } from '../api/esp32';

const TIERS = [
  { key: 'raw', label: '30m', resolution: '1s' },
  { key: 'fine', label: '6h', resolution: '1m' },
  { key: 'medium', label: '24h', resolution: '10m' },
  { key: 'coarse', label: '7d', resolution: '1h' },
  { key: 'daily', label: '30d', resolution: '6h' },
  { key: 'archive', label: '3y', resolution: '24h' },
];

export default function DataManagement() {
  const [saveStatus, setSaveStatus] = useState(null); // null, 'loading', 'success', 'error'
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

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
      </div>

      {errorMessage && (
        <p className="mt-4 text-xs text-red">{errorMessage}</p>
      )}
    </Card>
  );
}
