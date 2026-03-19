const MAGIC = 0x48425F31;
const HEADER_SIZE = 28;
const TIER_NAMES = ['raw', 'fine', 'medium', 'coarse', 'daily', 'archive'];

const TIER_RESOLUTIONS = {
  raw: 2,
  fine: 60,
  medium: 600,
  coarse: 3600,
  daily: 21600,
  archive: 86400,
};

/**
 * Decode binary history response from /api/history/all into per-tier sample arrays.
 * Uses sample_size from header as stride for forward compatibility.
 *
 * @param {ArrayBuffer} buffer - Raw response bytes
 * @returns {{ tiers: Object, serverTimestamp: number, isIncremental: boolean }}
 */
function decodeBinaryHistory(buffer) {
  const view = new DataView(buffer);

  if (buffer.byteLength < HEADER_SIZE) {
    throw new Error(`Response too small: ${buffer.byteLength} bytes`);
  }

  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) {
    throw new Error(`Invalid magic: 0x${magic.toString(16)}`);
  }

  const flags = view.getUint32(4, true);
  const serverTimestamp = view.getUint32(8, true);
  const sampleSize = view.getUint16(12, true);
  const tierCount = view.getUint16(14, true);
  const isIncremental = (flags & 1) !== 0;

  const tierCounts = [];
  for (let i = 0; i < tierCount && i < TIER_NAMES.length; i++) {
    tierCounts.push(view.getUint16(16 + i * 2, true));
  }

  const tiers = {};
  let offset = HEADER_SIZE;

  for (let t = 0; t < tierCounts.length; t++) {
    const count = tierCounts[t];
    const samples = new Array(count);

    if (offset + count * sampleSize > buffer.byteLength) {
      throw new Error(`Truncated response: tier ${TIER_NAMES[t]} needs ${offset + count * sampleSize} bytes but buffer is ${buffer.byteLength}`);
    }

    for (let i = 0; i < count; i++) {
      const base = offset + i * sampleSize;
      samples[i] = {
        timestamp: view.getUint32(base, true),
        pm1_0: view.getFloat32(base + 4, true),
        pm2_5: view.getFloat32(base + 8, true),
        pm4_0: view.getFloat32(base + 12, true),
        pm10: view.getFloat32(base + 16, true),
        humidity: view.getFloat32(base + 20, true),
        temperature: view.getFloat32(base + 24, true),
        voc_index: view.getInt16(base + 28, true),
        nox_index: view.getInt16(base + 30, true),
        fan_rpm: view.getUint16(base + 32, true),
        fan_speed: view.getUint8(base + 34),
      };
    }

    offset += count * sampleSize;
    tiers[TIER_NAMES[t]] = { samples, count };
  }

  return { tiers, serverTimestamp, isIncremental };
}

module.exports = { decodeBinaryHistory, TIER_NAMES, TIER_RESOLUTIONS };
