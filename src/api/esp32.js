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

// Save history data to ESP32 flash storage
export const saveHistoryToFlash = () =>
  fetch(`${API_BASE}/api/history/save`, {
    method: 'POST',
  }).then(r => {
    if (!r.ok) throw new Error(`Save failed: ${r.status}`);
    return r.json();
  });

// Get raw CSV data for a tier (for download)
export const getHistoryRaw = (tier) =>
  fetch(`${API_BASE}/api/history/${tier}?format=csv`).then(r => {
    if (!r.ok) throw new Error(`History fetch failed: ${r.status}`);
    return r.text();
  });
