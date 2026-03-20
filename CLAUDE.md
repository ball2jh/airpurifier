# airpurifier monorepo

ESP32 air quality monitor and fan controller system. Three components:

- **`firmware/`** — ESP32 C/ESP-IDF firmware (sensor, fan, REST API, OTA)
- **`dashboard/`** — React/Vite web dashboard (Bun)
- **`collector/`** — Host-side history collector with SQLite (Bun/Express)

## Quick Reference

| Component | Build | Run |
|-----------|-------|-----|
| Firmware | `cd firmware && . ./esp-idf/export.sh && idf.py build` | `idf.py flash` or OTA |
| Dashboard | `cd dashboard && bun install && bun run build` | `bun run dev` (port 5199) |
| Collector | `cd collector && bun install` | `bun server.js` (port 9401) |

## Device

- **IP:** 192.168.1.169 (mDNS: `airpurifier.local`)
- **Board:** Hosyond ESP32S (ESP-WROOM-32, CP2102 USB-C)

## SEN55 Documentation

`docs/sen55/` contains Sensirion datasheets, app notes, and info notes converted to markdown. **Read the `.md` files, not the PDFs.** See `docs/sen55/CLAUDE.md` for an index.

See component-level CLAUDE.md files for detailed instructions.
