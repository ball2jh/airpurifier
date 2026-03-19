# CLAUDE.md

ESP32 environmental controller using ESP-IDF v5.5. Controls PWM fans and monitors air quality via SEN55 sensor. Device IP: `192.168.1.169`.

## Hardware

- **Board:** Hosyond ESP32S (ESP-WROOM-32 module)
- **Chip:** ESP32 dual-core @ 240 MHz
- **RAM:** 512 KB
- **Flash:** 512 KB (on-module)
- **USB:** USB-C via CP2102 bridge
- **WiFi:** 802.11 b/g/n (AP/STA/AP+STA)
- **Bluetooth:** Classic + BLE

## Build Commands

```bash
# ESP-IDF is vendored in-tree. Source before each session:
. /home/jacka/Projects/Mac_Stuff/esp32/firmware/esp-idf/export.sh

# Build
idf.py build
```

## Deploy

### OTA (preferred, preserves history automatically)
```bash
# From the build/ directory, serve the firmware:
cd build && python3 -m http.server 8000 --bind 0.0.0.0

# Then trigger OTA from the device:
curl -X POST -d '{"url": "http://192.168.1.252:8000/env-controller.bin"}' http://192.168.1.169/api/ota

# Poll status:
curl http://192.168.1.169/api/ota
```

### Cable flash
```bash
# IMPORTANT: save history first — cable flash won't auto-save
curl -X POST http://192.168.1.169/api/history/save

idf.py -p /dev/cu.usbserial-0001 flash

# Monitor serial output (requires TTY)
idf.py -p /dev/cu.usbserial-0001 monitor
```

## WiFi Configuration

Credentials in `main/wifi_config.h` (gitignored):
```c
#define WIFI_SSID       "YourSSID"
#define WIFI_PASSWORD   "YourPassword"
```

## History Flash Persistence

- History lives in RAM, auto-saved to a dedicated flash partition every 6 hours
- Uses A/B ping-pong slots with CRC32 — power loss during save cannot destroy both copies
- Restored automatically on boot from the newest valid slot
- OTA auto-saves before update; cable flash does NOT — save manually first
- `idf.py erase-flash` destroys the history partition — avoid unless necessary
- Changing `HISTORY_VERSION` in history.c invalidates old saved data (version mismatch on restore)
- **Partition table changes require cable flash** (not OTA-updateable) — save history first
