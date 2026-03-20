import { decodeBinaryHistory } from './binaryDecoder';

const API_BASE = '';

export const getStatus = () =>
  fetch(`${API_BASE}/api/status`).then(r => {
    if (!r.ok) throw new Error(`Status fetch failed: ${r.status}`);
    return r.json();
  });

export const getFan = () =>
  fetch(`${API_BASE}/api/fan`).then(r => r.json());

export const setFan = (speed) =>
  fetch(`${API_BASE}/api/fan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speed })
  }).then(r => r.json());

export const setFanMode = (mode, speed) =>
  fetch(`${API_BASE}/api/fan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mode === 'auto' ? { mode } : { mode, speed })
  }).then(r => r.json());

export const getHistory = (tier) =>
  fetch(`${API_BASE}/api/history/${tier}?format=csv`).then(r => {
    if (!r.ok) throw new Error(`History fetch failed: ${r.status}`);
    return r.text();
  }).then(csv => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return { samples: [], count: 0 };

    const headers = lines[0].split(',');
    const samples = lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((header, i) => {
        const val = values[i];
        obj[header] = val === '' ? null : parseFloat(val);
      });
      return obj;
    });

    return { samples, count: samples.length };
  });

export const getHealth = () =>
  fetch(`${API_BASE}/api/health`).then(r => {
    if (!r.ok) throw new Error(`Health check failed: ${r.status}`);
    return r.json();
  });

export const getInfo = () =>
  fetch(`${API_BASE}/api/info`).then(r => r.json());

export const getOta = () =>
  fetch(`${API_BASE}/api/ota`).then(r => r.json());

export const triggerSensorClean = () =>
  fetch(`${API_BASE}/api/sensor/clean`, {
    method: 'POST',
  }).then(r => {
    if (!r.ok) throw new Error(`Sensor clean failed: ${r.status}`);
    return r.json();
  });

// Save history data to ESP32 flash storage
export const saveHistoryToFlash = () =>
  fetch(`${API_BASE}/api/history/save`, {
    method: 'POST',
  }).then(r => {
    if (!r.ok) throw new Error(`Save failed: ${r.status}`);
    return r.json();
  });

// Factory reset: clear history, NVS state, reboot device
export const resetDevice = () =>
  fetch(`${API_BASE}/api/history/reset`, {
    method: 'POST',
  }).then(r => {
    if (!r.ok) throw new Error(`Device reset failed: ${r.status}`);
    return r.json();
  });

// Fetch all tiers as binary, with optional incremental update
export const getAllHistoryBinary = (sinceTimestamp) => {
  const url = sinceTimestamp
    ? `${API_BASE}/api/history/all?since=${sinceTimestamp}`
    : `${API_BASE}/api/history/all`;
  return fetch(url).then(r => {
    if (!r.ok) throw new Error(`Binary history fetch failed: ${r.status}`);
    return r.arrayBuffer();
  }).then(decodeBinaryHistory);
};

// Get raw CSV data for a tier (for download)
export const getHistoryRaw = (tier) =>
  fetch(`${API_BASE}/api/history/${tier}?format=csv`).then(r => {
    if (!r.ok) throw new Error(`History fetch failed: ${r.status}`);
    return r.text();
  });

// Get archive stats from the collector
export const getArchiveStats = () =>
  fetch(`${API_BASE}/archive/stats`).then(r => {
    if (!r.ok) throw new Error(`Archive stats failed: ${r.status}`);
    return r.json();
  });

// Clear all data from the collector archive
export const clearArchive = () =>
  fetch(`${API_BASE}/archive/data`, {
    method: 'DELETE',
  }).then(r => {
    if (!r.ok) throw new Error(`Clear archive failed: ${r.status}`);
    return r.json();
  });

// Query PM number concentration archive from the collector
export const getPmNumberArchiveQuery = (from, to, resolution) =>
  fetch(`${API_BASE}/archive/pm-number/query?from=${from}&to=${to}&resolution=${resolution}`).then(r => {
    if (!r.ok) throw new Error(`PM number archive query failed: ${r.status}`);
    return r.json();
  }).then(data => {
    const NC_FIELDS = ['nc_pm0_5', 'nc_pm1_0', 'nc_pm2_5', 'nc_pm4_0', 'nc_pm10', 'typical_size'];
    const samples = data.samples.map(s => {
      const point = { timestamp: s.bucket };
      for (const f of NC_FIELDS) {
        point[f] = s[`${f}_avg`];
        point[`${f}_min`] = s[`${f}_min`];
        point[`${f}_max`] = s[`${f}_max`];
      }
      return point;
    });
    return { samples, count: samples.length };
  });

// Query the host-side archive collector for historical data
export const getArchiveQuery = (from, to, resolution) =>
  fetch(`${API_BASE}/archive/query?from=${from}&to=${to}&resolution=${resolution}`).then(r => {
    if (!r.ok) throw new Error(`Archive query failed: ${r.status}`);
    return r.json();
  }).then(data => {
    const RANGE_METRICS = ['pm1_0', 'pm2_5', 'pm4_0', 'pm10', 'humidity', 'temperature', 'voc_index', 'nox_index'];
    // Transform aggregated buckets into the sample shape the chart expects
    const samples = data.samples.map(s => {
      const point = {
        timestamp: s.bucket,
        pm1_0: s.pm1_0_avg,
        pm2_5: s.pm2_5_avg,
        pm4_0: s.pm4_0_avg,
        pm10: s.pm10_avg,
        humidity: s.humidity_avg,
        temperature: s.temperature_avg,
        voc_index: s.voc_index_avg,
        nox_index: s.nox_index_avg,
        fan_rpm: s.fan_rpm_avg,
        fan_speed: s.fan_speed_avg,
      };
      // Pass through min/max for metrics that have them
      for (const m of RANGE_METRICS) {
        point[`${m}_min`] = s[`${m}_min`];
        point[`${m}_max`] = s[`${m}_max`];
      }
      return point;
    });
    return { samples, count: samples.length, hasRange: true };
  });
