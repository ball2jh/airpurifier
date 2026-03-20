import { useState } from 'react';
import SystemInfo from './SystemInfo';
import DataManagement from './DataManagement';
import ErrorsPanel from './ErrorsPanel';
import TemperatureToggle from './TemperatureToggle';

export default function SettingsPanel({ health }) {
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
