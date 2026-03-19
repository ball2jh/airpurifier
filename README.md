# airpurifier-ui

Web dashboard for the [airpurifier](https://github.com/ball2jh/airpurifier) ESP32 controller. Displays real-time and historical environmental data from the SEN55 sensor — temperature, humidity, AQI, PM2.5 — with fan control.

## Features

- **Live monitoring** — current readings with auto-refresh
- **History charts** — tiered views from 15 minutes to 3 years
- **Fan control** — toggle auto/manual mode and set speed
- **Air quality breakdown** — AQI, PM details, VOC/NOx, relative quality comparisons
- **Statistics** — peaks, period comparisons, trend summaries
- **System info** — uptime, WiFi signal, NTP status, data management

## Setup

```bash
git clone https://github.com/ball2jh/airpurifier-ui.git
cd airpurifier-ui
bun install   # or npm install
```

The dev server proxies `/api` requests to the ESP32 via mDNS (`airpurifier.local` by default). Override with an env var if needed:

```bash
ESP32_IP=192.168.1.100 bun run dev
```

## Build

```bash
bun run build
```

The `dist/` output can be served from anywhere on the same network as the ESP32, or embedded into the firmware.

## Stack

React, Vite, Tailwind CSS, Recharts, TanStack Query

## License

MIT
