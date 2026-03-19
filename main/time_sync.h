/**
 * @file time_sync.h
 * @brief NTP time synchronization for accurate timestamps
 *
 * Provides real-time clock synchronization via SNTP.
 * Falls back to uptime-based timestamps if sync fails.
 */

#ifndef TIME_SYNC_H
#define TIME_SYNC_H

#include <stdint.h>
#include <stdbool.h>
#include <time.h>
#include "esp_err.h"

/**
 * @brief Initialize SNTP time synchronization
 *
 * Call after WiFi is connected. Configures SNTP client
 * to sync with pool.ntp.org.
 *
 * @return ESP_OK on success
 */
esp_err_t time_sync_init(void);

/**
 * @brief Wait for time synchronization to complete
 *
 * Blocks until time is synchronized or timeout expires.
 *
 * @param timeout_ms Maximum time to wait in milliseconds
 * @return ESP_OK if synced, ESP_ERR_TIMEOUT if not
 */
esp_err_t time_sync_wait(uint32_t timeout_ms);

/**
 * @brief Check if time has been synchronized
 *
 * @return true if time is valid (synced via NTP)
 */
bool time_sync_is_synced(void);

/**
 * @brief Get current Unix timestamp
 *
 * Returns seconds since Jan 1, 1970 UTC if synced,
 * or seconds since boot if not yet synced.
 *
 * @return Current timestamp
 */
time_t time_sync_get_timestamp(void);

/**
 * @brief Get formatted time string
 *
 * @param buf Buffer to write formatted time
 * @param buf_size Size of buffer
 * @return Pointer to buf, or "not synced" if time invalid
 */
const char* time_sync_get_time_str(char *buf, size_t buf_size);

#endif // TIME_SYNC_H
