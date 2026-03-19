# collector

Host-side history collector for the [airpurifier](../README.md) ESP32 controller. Polls the ESP32's binary history API every 30 seconds, stores all sensor data in a local SQLite database, and serves an archive API for long-term querying and CSV export.

The ESP32's on-device ring buffers retain ~1 year of data at decreasing resolution. This collector preserves full-resolution data indefinitely on a host machine, and backfills any gaps on startup.

## Features

- **Incremental polling** — fetches only new samples since the last watermark
- **Gap-fill on startup** — recovers missed data from all history tiers (coarsest to finest)
- **SQLite storage** — WAL-mode database with server-side aggregation at any resolution
- **Archive API** — query, aggregate, and export historical data as JSON or CSV
- **Systemd service** — runs unattended with automatic restart

## Setup

```bash
cd collector
bun install
```

## Usage

```bash
# Default: polls airpurifier.local on port 9401
bun server.js

# Override ESP32 host and port
ESP32_HOST=192.168.1.100 PORT=9401 bun server.js
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/archive/query?from=<ts>&to=<ts>&resolution=<s>` | Aggregated samples (JSON) |
| GET | `/archive/stats` | Database stats (sample count, time range, size) |
| GET | `/archive/export?from=<ts>&to=<ts>` | Raw samples (CSV download) |

### Example

```bash
# Last 24 hours at 10-minute resolution
NOW=$(date +%s)
curl "http://localhost:9401/archive/query?from=$((NOW-86400))&to=$NOW&resolution=600"

# Export a week of data as CSV
curl -o history.csv "http://localhost:9401/archive/export?from=$((NOW-604800))&to=$NOW"
```

## Systemd

```bash
sudo cp esp32-collector.service /etc/systemd/system/
sudo systemctl enable --now esp32-collector
```

## License

MIT
