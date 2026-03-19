const express = require('express');
const { queryAggregated, getStats, getRawSamples } = require('./db');

const router = express.Router();

// GET /archive/query?from=<ts>&to=<ts>&resolution=<seconds>
router.get('/archive/query', (req, res) => {
  const from = parseInt(req.query.from);
  const to = parseInt(req.query.to);
  const resolution = parseInt(req.query.resolution) || 3600;

  if (isNaN(from) || isNaN(to)) {
    return res.status(400).json({ error: 'from and to are required (unix timestamps)' });
  }
  if (resolution < 1) {
    return res.status(400).json({ error: 'resolution must be >= 1' });
  }

  const samples = queryAggregated(from, to, resolution);
  res.json({ samples, resolution, from, to, count: samples.length });
});

// GET /archive/stats
router.get('/archive/stats', (req, res) => {
  const stats = getStats();
  stats.collecting = true;
  res.json(stats);
});

// GET /archive/export?from=<ts>&to=<ts>&format=csv
router.get('/archive/export', (req, res) => {
  const from = parseInt(req.query.from);
  const to = parseInt(req.query.to);

  if (isNaN(from) || isNaN(to)) {
    return res.status(400).json({ error: 'from and to are required (unix timestamps)' });
  }

  const samples = getRawSamples(from, to);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="esp32-history-${from}-${to}.csv"`);

  res.write('timestamp,pm1_0,pm2_5,pm4_0,pm10,humidity,temperature,voc_index,nox_index,fan_rpm,fan_speed\n');
  for (const s of samples) {
    res.write(`${s.timestamp},${s.pm1_0},${s.pm2_5},${s.pm4_0},${s.pm10},${s.humidity},${s.temperature},${s.voc_index},${s.nox_index},${s.fan_rpm},${s.fan_speed}\n`);
  }
  res.end();
});

module.exports = router;
