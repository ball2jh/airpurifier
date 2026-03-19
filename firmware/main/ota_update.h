/**
 * @file ota_update.h
 * @brief Over-The-Air firmware update support
 *
 * Provides non-blocking OTA firmware updates via HTTP.
 * Supports automatic rollback if new firmware fails health checks.
 */

#ifndef OTA_UPDATE_H
#define OTA_UPDATE_H

#include "esp_err.h"
#include <stdbool.h>

/**
 * @brief OTA update state
 */
typedef enum {
    OTA_STATE_IDLE,         // No update in progress
    OTA_STATE_DOWNLOADING,  // Downloading firmware
    OTA_STATE_VERIFYING,    // Verifying downloaded image
    OTA_STATE_REBOOTING,    // About to reboot
    OTA_STATE_FAILED        // Update failed
} ota_state_t;

/**
 * @brief OTA status information
 */
typedef struct {
    ota_state_t state;
    int progress_percent;   // 0-100 during download
    char error_msg[64];     // Error description if failed
    char current_version[32]; // Running firmware version
    char partition[16];     // Current boot partition name
} ota_status_t;

/**
 * @brief Initialize OTA subsystem
 *
 * Sets up OTA and checks if running from a new update
 * that needs validation.
 *
 * @return ESP_OK on success
 */
esp_err_t ota_init(void);

/**
 * @brief Start OTA update from URL
 *
 * Begins non-blocking download of firmware from the given URL.
 * Progress can be monitored via ota_get_status().
 * Device will automatically reboot on successful download.
 *
 * @param url HTTP URL to firmware binary
 * @return ESP_OK if download started, error if already in progress or invalid URL
 */
esp_err_t ota_start_update(const char *url);

/**
 * @brief Get current OTA status
 *
 * @return Current OTA status structure
 */
ota_status_t ota_get_status(void);

/**
 * @brief Check if an update is in progress
 *
 * @return true if downloading or verifying
 */
bool ota_is_busy(void);

/**
 * @brief Mark current firmware as valid
 *
 * Call this after successful initialization to confirm the
 * firmware works correctly. If not called within a few boots,
 * the bootloader will roll back to the previous version.
 *
 * @return ESP_OK on success
 */
esp_err_t ota_mark_valid(void);

/**
 * @brief Check if running a pending (unvalidated) update
 *
 * @return true if firmware needs validation
 */
bool ota_is_pending_validation(void);

#endif // OTA_UPDATE_H
