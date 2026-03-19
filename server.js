const express = require('express');
const routes = require('./routes');
const poller = require('./poller');
const { close: closeDb } = require('./db');

const PORT = parseInt(process.env.PORT) || 9401;

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(routes);

const server = app.listen(PORT, () => {
  console.log(`[server] Listening on :${PORT}`);
  poller.start();
});

function shutdown() {
  console.log('[server] Shutting down...');
  poller.stop();
  server.close(() => {
    closeDb();
    console.log('[server] Goodbye');
    process.exit(0);
  });
  // Force exit after 5s if graceful shutdown stalls
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
