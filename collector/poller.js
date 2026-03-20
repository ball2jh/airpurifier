const { decodeBinaryHistory, TIER_NAMES, TIER_RESOLUTIONS } = require('./binary-decoder');
const { insertSamples, getWatermark, insertPmNumberSample } = require('./db');

const ESP32_HOST = process.env.ESP32_HOST || 'airpurifier.local';
const POLL_INTERVAL = 30_000;

let polling = false;
let timer = null;
let statusTimer = null;

async function fetchHistory(since) {
  const url = since
    ? `http://${ESP32_HOST}/api/history/all?since=${since}`
    : `http://${ESP32_HOST}/api/history/all`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return decodeBinaryHistory(buffer);
}

async function gapFill() {
  const watermark = getWatermark();
  if (watermark === 0) {
    console.log('[poller] No existing data — performing full initial fetch');
  } else {
    const gapSeconds = Math.floor(Date.now() / 1000) - watermark;
    console.log(`[poller] Gap detected: ${formatDuration(gapSeconds)} since last sample`);
  }

  const data = await fetchHistory(null);
  let totalInserted = 0;

  // Process tiers from coarsest to finest
  const tierOrder = [...TIER_NAMES].reverse();
  for (const tierName of tierOrder) {
    const tier = data.tiers[tierName];
    if (!tier || tier.count === 0) continue;

    const resolution = TIER_RESOLUTIONS[tierName];
    const samples = watermark > 0
      ? tier.samples.filter(s => s.timestamp > watermark)
      : tier.samples;

    if (samples.length === 0) continue;

    const inserted = insertSamples(samples, resolution);
    if (inserted > 0) {
      console.log(`[poller] Gap-fill: ${inserted} samples from ${tierName} tier (${resolution}s resolution)`);
    }
    totalInserted += inserted;
  }

  console.log(`[poller] Gap-fill complete: ${totalInserted} new samples`);
  return totalInserted;
}

async function pollOnce() {
  const watermark = getWatermark();
  const data = await fetchHistory(watermark || undefined);

  const rawTier = data.tiers.raw;
  if (!rawTier || rawTier.count === 0) return 0;

  const inserted = insertSamples(rawTier.samples, TIER_RESOLUTIONS.raw);
  return inserted;
}

async function pollStatusOnce() {
  const response = await fetch(`http://${ESP32_HOST}/api/status`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const status = await response.json();
  const pmNumber = status?.sensor?.pm_number;
  if (!pmNumber) return false;

  const timestamp = status.timestamp || Math.floor(Date.now() / 1000);
  insertPmNumberSample(timestamp, pmNumber);
  return true;
}

async function statusPollLoop() {
  if (!polling) return;

  try {
    const ok = await pollStatusOnce();
    if (ok) {
      console.log('[poller] Collected PM number sample from /api/status');
    }
  } catch (err) {
    console.warn(`[poller] Status fetch error (will retry): ${err.message}`);
  }

  if (polling) {
    statusTimer = setTimeout(statusPollLoop, POLL_INTERVAL);
  }
}

async function pollLoop() {
  if (!polling) return;

  try {
    const inserted = await pollOnce();
    const watermark = getWatermark();
    if (inserted > 0) {
      console.log(`[poller] Collected ${inserted} new samples (watermark: ${watermark})`);
    }
  } catch (err) {
    console.warn(`[poller] Fetch error (will retry): ${err.message}`);
  }

  if (polling) {
    timer = setTimeout(pollLoop, POLL_INTERVAL);
  }
}

async function start() {
  polling = true;
  console.log(`[poller] Starting — polling ${ESP32_HOST} every ${POLL_INTERVAL / 1000}s`);

  try {
    await gapFill();
  } catch (err) {
    console.warn(`[poller] Gap-fill failed (will continue with normal polling): ${err.message}`);
  }

  timer = setTimeout(pollLoop, POLL_INTERVAL);

  // Start status polling for PM number data (offset by 15s to spread load)
  statusTimer = setTimeout(statusPollLoop, 15000);
}

function stop() {
  polling = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  console.log('[poller] Stopped');
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

module.exports = { start, stop };
