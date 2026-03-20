# firmware

ESP32 firmware for the [airpurifier](../README.md) system. Built with ESP-IDF v5.5, designed for **2+ years of unattended operation** with automatic error recovery, OTA updates, and a REST API for monitoring and control.

Reads air quality data from a **Sensirion SEN55** sensor (PM1.0, PM2.5, PM4.0, PM10, temperature, humidity, VOC, NOx) and automatically adjusts PWM fan speed based on particulate levels.

## Features

- **Air quality monitoring** - Full SEN55 sensor suite with CRC-validated I2C communication
- **Automatic fan control** - PWM fan speed adjusts based on PM2.5 thresholds
- **Historical data** - Tiered ring buffer stores ~1 year of data in 144KB of RAM with automatic compaction
- **REST API** - JSON and CSV endpoints for real-time and historical data
- **OTA updates** - Update firmware over WiFi without physical access
- **Reliability** - Watchdog timer, I2C bus recovery, fan stall detection, smart WiFi reconnection backoff
- **Data persistence** - History survives reboots via dedicated flash partition with automatic and manual save

## Hardware

| Component | Details |
|-----------|---------|
| MCU | ESP32 (any variant with 4MB+ flash) |
| Sensor | Sensirion SEN55 (I2C, GPIO 21/22) |
| Fan | 4-pin PWM PC fan (25kHz PWM on GPIO 18, tachometer on GPIO 19) |

### Wiring

```
ESP32 GPIO 18  -->  Fan PWM (pin 4)
ESP32 GPIO 19  <--  Fan Tachometer (pin 3, open-collector with internal pull-up)
ESP32 GPIO 21  <->  SEN55 SDA (external 10K pull-up)
ESP32 GPIO 22  <->  SEN55 SCL (external 10K pull-up)
```

## Getting Started

### Prerequisites

- [ESP-IDF v5.5](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32/get-started/)

### Setup

```bash
# From the repo root
cd firmware

# Clone ESP-IDF into the firmware directory (or symlink your existing installation)
git clone --recursive https://github.com/espressif/esp-idf.git -b v5.5
./esp-idf/install.sh

# Create WiFi credentials file
cat > main/wifi_config.h << 'EOF'
#define WIFI_SSID       "YourSSID"
#define WIFI_PASSWORD   "YourPassword"
EOF
```

### Build & Flash

```bash
source ./esp-idf/export.sh

idf.py build
idf.py -p /dev/ttyUSB0 flash monitor    # Linux
idf.py -p /dev/cu.usbserial-0001 flash monitor  # macOS
```

## REST API

All endpoints return JSON (except CSV export). CORS enabled for browser access.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Current sensor readings and fan status |
| GET | `/api/fan` | Fan settings and health stats |
| POST | `/api/fan` | Set fan mode/speed |
| GET | `/api/history/{tier}` | Historical data (JSON, paginated) |
| GET | `/api/history/{tier}?format=csv` | Historical data (CSV, streamed) |
| POST | `/api/history/save` | Save history to flash |
| POST | `/api/history/reset` | Clear all history |
| GET | `/api/health` | System health (sensor, fan, WiFi, history) |
| GET | `/api/info` | Device info, uptime, NTP status |
| GET | `/api/ota` | OTA update status |
| POST | `/api/ota` | Start OTA update (`{"url": "http://..."}`) |

### Fan Control

```bash
# Auto mode (default) - speed based on PM2.5
curl -X POST -d '{"mode": "auto"}' http://<device-ip>/api/fan

# Manual mode - set speed directly (0-100%)
curl -X POST -d '{"speed": 50}' http://<device-ip>/api/fan

# Check status
curl http://<device-ip>/api/status
```

**Auto mode thresholds:**

| PM2.5 (ug/m3) | Fan Speed |
|----------------|-----------|
| < 5 | 25% |
| 5 - 15 | 50% |
| 15 - 25 | 75% |
| > 25 | 100% |

Manual mode automatically returns to auto after 6 hours.

### History Tiers

Data is stored at multiple resolutions, automatically compacted from fine to coarse:

| Tier | Resolution | Retention | Samples |
|------|------------|-----------|---------|
| `raw` | 1 sec | ~30 min | 1,800 |
| `fine` | 1 min | 6 hours | 360 |
| `medium` | 10 min | 24 hours | 144 |
| `coarse` | 1 hour | 7 days | 168 |
| `daily` | 6 hours | 30 days | 120 |
| `archive` | 24 hours | 3 years | 1,095 |

## OTA Updates

```bash
# Host firmware locally
cd build && python -m http.server 8000

# Trigger update
curl -X POST -d '{"url": "http://192.168.1.100:8000/env-controller.bin"}' \
  http://<device-ip>/api/ota
```

History is automatically saved to flash before OTA begins.

## Preserving History Across Cable Flashes

History is stored in RAM but periodically auto-saved to a dedicated 192KB flash partition (every 6 hours). Before flashing new firmware over USB:

```bash
# Save current history
curl -X POST http://<device-ip>/api/history/save

# Then flash normally
idf.py -p /dev/ttyUSB0 flash
```

History restores automatically on boot. Avoid `idf.py erase-flash` unless you want to wipe it.

## Flash Partition Layout

```
0x009000  nvs        16KB    Non-volatile storage
0x00d000  otadata     8KB    OTA metadata
0x00f000  phy_init    4KB    PHY init data
0x010000  ota_0    1536KB    Firmware slot 0
0x190000  ota_1    1536KB    Firmware slot 1
0x310000  history   192KB    Persistent history storage
```

## Project Structure

```
main/
  main.c             Entry point, monitoring loop, watchdog
  fan_controller.c/h PWM output (LEDC) and tachometer (PCNT + GPTimer)
  sen55.c/h          I2C driver for SEN55 with CRC validation
  history.c/h        Tiered ring buffer storage with flash persistence
  api_server.c/h     REST API server with CORS
  wifi.c/h           WiFi station with smart reconnection backoff
  ota_update.c/h     OTA firmware update
  time_sync.c/h      NTP time synchronization
  wifi_config.h      WiFi credentials (gitignored)
partitions.csv       Custom partition table
sdkconfig            ESP-IDF build configuration
```

## License

MIT
