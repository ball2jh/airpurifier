# ESP32 Dashboard

## Package Manager

Use **bun**, not npm/yarn/pnpm. All commands should use `bun` (e.g., `bun install`, `bun run dev`, `bun run deploy`).

## Build & Deploy

- `bun run dev` — Start dev server (port 5199)
- `bun run build` — Production build
- `bun run deploy` — Build and deploy to `/srv/esp32-dashboard/`

## Hardware

- **Board:** Hosyond ESP32S (ESP-WROOM-32, CP2102 USB-C)
- **CPU:** Dual-core Xtensa LX6 @ 240 MHz
- **RAM:** 520 KB SRAM
- **Flash:** 4 MB
- **Connectivity:** WiFi 802.11 b/g/n + Bluetooth 4.2

## ESP32 Firmware

The companion ESP32 firmware lives at `../esp32/`. To build and flash:

```bash
cd ../esp32
. ./esp-idf/export.sh
idf.py build
idf.py -p /dev/ttyUSB0 flash
```
