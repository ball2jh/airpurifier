const express = require('express');
const { queryAggregated, getStats, iterateRawSamples, clearAll, queryPmNumberAggregated, getPmNumberStats } = require('./db');

const router = express.Router();

function validateTimeRange(query) {
  const from = parseInt(query.from);
  const to = parseInt(query.to);
  const resolution = parseInt(query.resolution) || 3600;

  if (isNaN(from) || isNaN(to)) {
    return { error: 'from and to are required (unix timestamps)' };
  }
  if (resolution < 1) {
    return { error: 'resolution must be >= 1' };
  }
  if (from >= to) {
    return { error: 'from must be less than to' };
  }

  return { from, to, resolution };
}

// GET /archive/query?from=<ts>&to=<ts>&resolution=<seconds>
router.get('/archive/query', (req, res, next) => {
  try {
    const params = validateTimeRange(req.query);
    if (params.error) {
      return res.status(400).json({ error: params.error });
    }
    const { from, to, resolution } = params;

    const samples = queryAggregated(from, to, resolution);
    res.json({ samples, resolution, from, to, count: samples.length });
  } catch (err) {
    next(err);
  }
});

// GET /archive/stats
router.get('/archive/stats', (req, res, next) => {
  try {
    const stats = getStats();
    stats.collecting = true;
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /archive/export?from=<ts>&to=<ts>&format=csv
router.get('/archive/export', (req, res, next) => {
  try {
    const params = validateTimeRange(req.query);
    if (params.error) {
      return res.status(400).json({ error: params.error });
    }
    const { from, to } = params;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="esp32-history-${from}-${to}.csv"`);

    res.write('timestamp,pm1_0,pm2_5,pm4_0,pm10,humidity,temperature,voc_index,nox_index,fan_rpm,fan_speed\n');
    for (const s of iterateRawSamples(from, to)) {
      res.write(`${s.timestamp},${s.pm1_0},${s.pm2_5},${s.pm4_0},${s.pm10},${s.humidity},${s.temperature},${s.voc_index},${s.nox_index},${s.fan_rpm},${s.fan_speed}\n`);
    }
    res.end();
  } catch (err) {
    next(err);
  }
});

// GET /archive/pm-number/query?from=<ts>&to=<ts>&resolution=<seconds>
router.get('/archive/pm-number/query', (req, res, next) => {
  try {
    const params = validateTimeRange(req.query);
    if (params.error) {
      return res.status(400).json({ error: params.error });
    }
    const { from, to, resolution } = params;

    const samples = queryPmNumberAggregated(from, to, resolution);
    res.json({ samples, resolution, from, to, count: samples.length });
  } catch (err) {
    next(err);
  }
});

// GET /archive/pm-number/stats
router.get('/archive/pm-number/stats', (req, res, next) => {
  try {
    const stats = getPmNumberStats();
    stats.collecting = true;
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// DELETE /archive/data — clear all collected samples
router.delete('/archive/data', (req, res, next) => {
  try {
    const stats = getStats();
    clearAll();
    res.json({ cleared: stats.total_samples });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
