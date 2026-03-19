# airpurifier

Monorepo for an ESP32-based air quality monitor and fan controller system. Reads air quality data from a Sensirion SEN55 sensor and automatically adjusts fan speed based on particulate levels, with a web dashboard for monitoring and a host-side collector for long-term history.

## Components

| Directory | Description | Stack |
|-----------|-------------|-------|
| [`firmware/`](firmware/) | ESP32 firmware — sensor reading, fan control, REST API, OTA updates | C / ESP-IDF v5.5 |
| [`dashboard/`](dashboard/) | Web dashboard — real-time monitoring, history charts, fan control | React, Vite, Tailwind, Bun |
| [`collector/`](collector/) | Host-side history collector — long-term SQLite storage and archive API | Bun, Express, SQLite |

## Architecture

```
┌─────────────┐     poll /api/history/all      ┌─────────────┐
│  ESP32      │ ◄──────────────────────────────│  Collector   │
│  (firmware) │                                │  (host)      │
│             │     /api/status, /api/fan       │  SQLite DB   │
│  SEN55 + Fan│ ◄──────────┐                   └──────┬───────┘
└─────────────┘            │                          │
                           │     /archive/query       │
                     ┌─────┴──────────────────────────┘
                     │
               ┌─────┴───────┐
               │  Dashboard   │
               │  (browser)   │
               └──────────────┘
```

The dashboard consumes both the ESP32's REST API (real-time data, fan control) and the collector's archive API (long-term history). The collector polls the ESP32's binary history endpoint and stores full-resolution data indefinitely.

## Quick Start

See each component's README for setup instructions:

- **Firmware**: [`firmware/README.md`](firmware/README.md) — requires ESP-IDF v5.5
- **Dashboard**: [`dashboard/README.md`](dashboard/README.md) — `bun install && bun run dev`
- **Collector**: [`collector/README.md`](collector/README.md) — `bun install && bun server.js`

## License

MIT
