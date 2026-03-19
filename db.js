const { Database } = require('bun:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'history.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
    db.run(`
      CREATE TABLE IF NOT EXISTS samples (
        timestamp INTEGER PRIMARY KEY,
        resolution INTEGER NOT NULL DEFAULT 2,
        pm1_0 REAL,
        pm2_5 REAL,
        pm4_0 REAL,
        pm10 REAL,
        humidity REAL,
        temperature REAL,
        voc_index INTEGER,
        nox_index INTEGER,
        fan_rpm INTEGER,
        fan_speed INTEGER
      )
    `);
  }
  return db;
}

function insertSamples(samples, resolution) {
  const db = getDb();
  const stmt = db.query(`
    INSERT OR IGNORE INTO samples
      (timestamp, resolution, pm1_0, pm2_5, pm4_0, pm10, humidity, temperature, voc_index, nox_index, fan_rpm, fan_speed)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((items) => {
    let inserted = 0;
    for (const s of items) {
      const result = stmt.run(
        s.timestamp, resolution,
        s.pm1_0, s.pm2_5, s.pm4_0, s.pm10,
        s.humidity, s.temperature,
        s.voc_index, s.nox_index,
        s.fan_rpm, s.fan_speed
      );
      if (result.changes > 0) inserted++;
    }
    return inserted;
  });

  return tx(samples);
}

function getWatermark() {
  const db = getDb();
  const row = db.query('SELECT MAX(timestamp) AS ts FROM samples').get();
  return row?.ts || 0;
}

function queryAggregated(from, to, resolution) {
  const db = getDb();
  const stmt = db.query(`
    SELECT
      (timestamp / $resolution) * $resolution AS bucket,
      AVG(pm1_0) AS pm1_0_avg, MIN(pm1_0) AS pm1_0_min, MAX(pm1_0) AS pm1_0_max,
      AVG(pm2_5) AS pm2_5_avg, MIN(pm2_5) AS pm2_5_min, MAX(pm2_5) AS pm2_5_max,
      AVG(pm4_0) AS pm4_0_avg, MIN(pm4_0) AS pm4_0_min, MAX(pm4_0) AS pm4_0_max,
      AVG(pm10) AS pm10_avg, MIN(pm10) AS pm10_min, MAX(pm10) AS pm10_max,
      AVG(humidity) AS humidity_avg, MIN(humidity) AS humidity_min, MAX(humidity) AS humidity_max,
      AVG(temperature) AS temperature_avg, MIN(temperature) AS temperature_min, MAX(temperature) AS temperature_max,
      AVG(voc_index) AS voc_index_avg, MIN(voc_index) AS voc_index_min, MAX(voc_index) AS voc_index_max,
      AVG(nox_index) AS nox_index_avg, MIN(nox_index) AS nox_index_min, MAX(nox_index) AS nox_index_max,
      AVG(fan_rpm) AS fan_rpm_avg,
      AVG(fan_speed) AS fan_speed_avg,
      COUNT(*) AS sample_count
    FROM samples
    WHERE timestamp BETWEEN $from AND $to
      AND pm2_5 >= 0
    GROUP BY bucket
    ORDER BY bucket
  `);
  return stmt.all({ $from: from, $to: to, $resolution: resolution });
}

function getStats() {
  const db = getDb();
  const row = db.query(`
    SELECT
      COUNT(*) AS total_samples,
      MIN(timestamp) AS oldest_timestamp,
      MAX(timestamp) AS newest_timestamp
    FROM samples
  `).get();

  let size = 0;
  try { size = fs.statSync(DB_PATH).size; } catch {}

  return {
    total_samples: row.total_samples,
    oldest_timestamp: row.oldest_timestamp,
    newest_timestamp: row.newest_timestamp,
    database_size_bytes: size,
  };
}

function getRawSamples(from, to) {
  const db = getDb();
  return db.query(`
    SELECT timestamp, pm1_0, pm2_5, pm4_0, pm10, humidity, temperature, voc_index, nox_index, fan_rpm, fan_speed
    FROM samples
    WHERE timestamp BETWEEN ?1 AND ?2
    ORDER BY timestamp
  `).all(from, to);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, insertSamples, getWatermark, queryAggregated, getStats, getRawSamples, close };
