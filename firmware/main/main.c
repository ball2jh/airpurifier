/**
 * @file main.c
 * @brief ESP32 Environmental Controller - Main Application
 *
 * Controls PWM fans via Arctic fan hub and monitors RPM.
 * Reads air quality data from SEN55 sensor (PM, temp, humidity, VOC, NOx).
 *
 * Reliability features for long-term operation:
 * - Task watchdog timer to detect hung tasks
 * - Automatic sensor recovery on communication failures
 * - Fan stall detection and recovery
 * - Periodic health status logging
 */

#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_task_wdt.h"
#include "esp_timer.h"
#include "fan_controller.h"
#include "sen55.h"
#include "history.h"
#include "wifi.h"
#include "api_server.h"
#include "ota_update.h"
#include "time_sync.h"
#include "mdns.h"

static const char *TAG = "main";

// =============================================================================
// Configuration
// =============================================================================

#define MONITOR_INTERVAL_MS     1000    // Sensor/fan read interval
#define HEALTH_LOG_INTERVAL     30      // Log health every N monitor cycles
#define WATCHDOG_TIMEOUT_S      30      // Watchdog timeout (seconds)
#define MAX_SENSOR_FAILURES     5       // Sensor failures before recovery
#define MAX_FAN_STALL_RETRIES   3       // Fan recovery attempts before alert
#define HISTORY_SAVE_INTERVAL_S (6 * 60 * 60)  // Auto-save history every 6 hours
#define VOC_SAVE_INTERVAL_S     (2 * 60 * 60)  // Save VOC state every 2 hours (Sensirion recommendation)
#define FAN_CLEAN_CHECK_INTERVAL_S (24 * 60 * 60)  // Check fan cleaning daily
#define PM_SETTLING_MS          60000           // PM readings need 60s to stabilize after start

// =============================================================================
// State
// =============================================================================

static uint32_t loop_count = 0;
static uint32_t sensor_failures = 0;
static uint32_t fan_stall_retries = 0;
static int64_t last_history_save_us = 0;  // Last auto-save timestamp
static int64_t last_voc_save_us = 0;      // Last VOC state save timestamp
static int64_t last_fan_clean_check_us = 0;  // Last fan cleaning check timestamp
static int64_t sensor_start_us = 0;       // When measurement started (for PM settling)
static bool pm_settled = false;           // Whether PM settling period has elapsed

// =============================================================================
// Health Logging
// =============================================================================

/**
 * @brief Log health statistics for diagnostics
 */
static void log_health_status(void)
{
    sen55_health_t sen_health;
    fan_health_t fan_health;
    history_stats_t hist_stats;

    sen55_get_health(&sen_health);
    fan_get_health(&fan_health);
    history_get_stats(&hist_stats);

    ESP_LOGI(TAG, "=== Health Status (uptime: %lu cycles) ===", loop_count);

    // SEN55 health
    float success_rate = 0;
    if (sen_health.total_reads > 0) {
        success_rate = (sen_health.successful_reads * 100.0f) / sen_health.total_reads;
    }
    ESP_LOGI(TAG, "SEN55: %s (%.1f%% success, %lu reads, %lu CRC err, %lu I2C err, %lu recoveries)",
             sen_health.is_healthy ? "OK" : "UNHEALTHY",
             success_rate,
             sen_health.total_reads,
             sen_health.crc_errors,
             sen_health.i2c_errors,
             sen_health.reinit_count);

    // Fan health
    ESP_LOGI(TAG, "Fan: %s (%lu stalls, %lu recovery attempts)",
             fan_health.is_healthy ? "OK" : (fan_health.is_stalled ? "STALLED" : "UNHEALTHY"),
             fan_health.stall_events,
             fan_health.recovery_attempts);

    // History stats
    ESP_LOGI(TAG, "History: %lu samples, %lu KB used",
             hist_stats.total_samples_recorded,
             hist_stats.memory_used_bytes / 1024);
    ESP_LOGI(TAG, "  Tiers: raw=%lu fine=%lu med=%lu coarse=%lu daily=%lu arch=%lu",
             hist_stats.tiers[TIER_RAW].count,
             hist_stats.tiers[TIER_FINE].count,
             hist_stats.tiers[TIER_MEDIUM].count,
             hist_stats.tiers[TIER_COARSE].count,
             hist_stats.tiers[TIER_DAILY].count,
             hist_stats.tiers[TIER_ARCHIVE].count);
}

// =============================================================================
// Error Recovery
// =============================================================================

/**
 * @brief Handle sensor communication failures
 */
static void handle_sensor_failure(void)
{
    sensor_failures++;

    if (sensor_failures >= MAX_SENSOR_FAILURES) {
        ESP_LOGW(TAG, "Multiple sensor failures (%lu), initiating recovery", sensor_failures);
        esp_err_t ret = sen55_recover();
        if (ret == ESP_OK) {
            sensor_failures = 0;
            sensor_start_us = esp_timer_get_time();
            pm_settled = false;
            ESP_LOGI(TAG, "Sensor recovery successful");
        } else {
            ESP_LOGE(TAG, "Sensor recovery failed: %s", esp_err_to_name(ret));
        }
    }
}

/**
 * @brief Handle fan stall condition
 */
static void handle_fan_stall(void)
{
    if (!fan_is_stalled()) {
        fan_stall_retries = 0;
        return;
    }

    if (fan_stall_retries < MAX_FAN_STALL_RETRIES) {
        fan_stall_retries++;
        ESP_LOGW(TAG, "Fan stall detected, recovery attempt %lu/%d",
                 fan_stall_retries, MAX_FAN_STALL_RETRIES);
        fan_recover_stall();
    } else {
        // Persistent stall - log but don't keep retrying
        ESP_LOGE(TAG, "Fan remains stalled after %d recovery attempts", MAX_FAN_STALL_RETRIES);
    }
}

// =============================================================================
// Main Application
// =============================================================================

void app_main(void)
{
    ESP_LOGI(TAG, "=== ESP32 Environmental Controller ===");
    ESP_LOGI(TAG, "Initializing...");

    // Configure Task Watchdog Timer (TWDT)
    // The TWDT may already be initialized by the system (CONFIG_ESP_TASK_WDT_INIT)
    esp_task_wdt_config_t wdt_config = {
        .timeout_ms = WATCHDOG_TIMEOUT_S * 1000,
        .idle_core_mask = 0,  // Don't watch idle tasks
        .trigger_panic = true,  // Reset on watchdog timeout
    };

    esp_err_t ret = esp_task_wdt_reconfigure(&wdt_config);
    if (ret == ESP_ERR_INVALID_STATE) {
        // TWDT not initialized yet, initialize it
        ret = esp_task_wdt_init(&wdt_config);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Failed to init TWDT: %s — using sdkconfig default timeout", esp_err_to_name(ret));
        }
    } else if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to reconfigure TWDT: %s — using sdkconfig default timeout", esp_err_to_name(ret));
    }

    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Watchdog configured: %ds timeout", WATCHDOG_TIMEOUT_S);
    }

    // Subscribe main task to watchdog
    ret = esp_task_wdt_add(NULL);
    if (ret != ESP_OK && ret != ESP_ERR_INVALID_ARG) {
        // ESP_ERR_INVALID_ARG means task already subscribed, which is fine
        ESP_LOGW(TAG, "Failed to add task to TWDT: %s", esp_err_to_name(ret));
    }

    // Initialize fan controller (retry — hardware may need time after power-on)
    for (int attempt = 1; attempt <= 5; attempt++) {
        ret = fan_controller_init();
        if (ret == ESP_OK) break;
        ESP_LOGW(TAG, "Fan controller init failed (attempt %d/5): %s", attempt, esp_err_to_name(ret));
        if (attempt == 5) {
            ESP_LOGE(TAG, "Fan controller init exhausted retries, rebooting");
            esp_restart();
        }
        esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(2000));
    }

    // Initialize SEN55 sensor (retry — I2C bus may need recovery)
    for (int attempt = 1; attempt <= 5; attempt++) {
        ret = sen55_init();
        if (ret == ESP_OK) break;
        ESP_LOGW(TAG, "SEN55 init failed (attempt %d/5): %s", attempt, esp_err_to_name(ret));
        if (attempt == 5) {
            ESP_LOGE(TAG, "SEN55 init exhausted retries, rebooting");
            esp_restart();
        }
        esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(2000));
    }
    sensor_start_us = esp_timer_get_time();

    // Initialize history storage (no retry — if flash is broken, reboot)
    ret = history_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize history, rebooting");
        esp_restart();
    }

    // Feed watchdog before WiFi/NTP waits which can take 30s+
    esp_task_wdt_reset();

    // Initialize WiFi (non-fatal — device can still run sensor+fan locally)
    ret = wifi_init();
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "WiFi init failed (non-critical): %s — running offline", esp_err_to_name(ret));
    }

    // Wait for WiFi connection (with timeout)
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Waiting for WiFi connection...");
        ret = wifi_wait_connected(30000);  // 30 second timeout
        if (ret != ESP_OK) {
            ESP_LOGW(TAG, "WiFi connection timeout - continuing anyway");
        }
    }

    // Feed watchdog after WiFi wait, before NTP wait
    esp_task_wdt_reset();

    // Initialize NTP time sync (requires WiFi)
    ret = time_sync_init();
    if (ret == ESP_OK) {
        // Wait up to 10 seconds for initial time sync
        ret = time_sync_wait(10000);
        if (ret != ESP_OK) {
            ESP_LOGW(TAG, "Time sync pending - will sync in background");
        }
    } else {
        ESP_LOGW(TAG, "Time sync init failed - using uptime timestamps");
    }

    // Feed watchdog after NTP wait
    esp_task_wdt_reset();

    // Initialize mDNS for local network discovery
    ret = mdns_init();
    if (ret == ESP_OK) {
        mdns_hostname_set("airpurifier");
        mdns_instance_name_set("Air Purifier Controller");
        mdns_service_add(NULL, "_http", "_tcp", 80, NULL, 0);
        ESP_LOGI(TAG, "mDNS started: airpurifier.local");
    } else {
        ESP_LOGW(TAG, "mDNS init failed (non-critical): %s", esp_err_to_name(ret));
    }

    // Initialize OTA subsystem
    ret = ota_init();
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "OTA init failed (non-critical): %s", esp_err_to_name(ret));
    }

    // Start API server (non-fatal — sensor+fan still work without it)
    ret = api_server_start();
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "API server start failed (non-critical): %s", esp_err_to_name(ret));
    }

    ESP_LOGI(TAG, "API server running at http://%s/", wifi_get_ip());

    // Start in AUTO mode
    fan_set_mode(FAN_MODE_AUTO);
    ESP_LOGI(TAG, "Fan mode set to AUTO");

    // All systems initialized successfully - mark firmware as valid
    // This prevents automatic rollback to previous firmware
    if (ota_is_pending_validation()) {
        ESP_LOGI(TAG, "New firmware validated - confirming update");
        ota_mark_valid();
    }

    // Main monitoring loop
    ESP_LOGI(TAG, "Monitoring started");
    while (1) {
        // Feed the watchdog to indicate we're alive
        esp_task_wdt_reset();

        loop_count++;

        // Read fan status
        uint32_t rpm = fan_get_rpm();
        uint8_t speed = fan_get_speed_percent();

        // Check for fan stall
        handle_fan_stall();

        // Check if manual mode should timeout back to auto
        fan_check_auto_timeout();

        // Read sensor data
        sen55_data_t air;
        esp_err_t sen_ret = sen55_read(&air);
        if (sen_ret == ESP_OK) {
            sensor_failures = 0;  // Reset failure counter on success

            // Record to history (skip until NTP synced — boot-second timestamps
            // break the monotonic assumption in history_get_samples_since)
            if (time_sync_is_synced()) {
                // PM needs 30-60s to stabilize after measurement start (Sensirion datasheet)
                if (!pm_settled && (esp_timer_get_time() - sensor_start_us) >= (int64_t)PM_SETTLING_MS * 1000) {
                    pm_settled = true;
                    ESP_LOGI(TAG, "PM readings settled after %ds", PM_SETTLING_MS / 1000);
                }
                history_sample_t sample = {
                    .timestamp = history_get_timestamp(),
                    .pm1_0 = pm_settled ? air.pm1_0 : -1.0f,
                    .pm2_5 = pm_settled ? air.pm2_5 : -1.0f,
                    .pm4_0 = pm_settled ? air.pm4_0 : -1.0f,
                    .pm10  = pm_settled ? air.pm10  : -1.0f,
                    .humidity = air.humidity,
                    .temperature = air.temperature,
                    .voc_index = air.voc_index,
                    .nox_index = air.nox_index,
                    .fan_rpm = (uint16_t)rpm,
                    .fan_speed = speed,
                };
                history_record(&sample);
            }

            // Update fan speed if in AUTO mode
            fan_auto_update(air.pm2_5);

            ESP_LOGD(TAG, "Fan %d%% %lu RPM | PM2.5 %.1f | %.1fC %.0f%% | VOC %d NOx %d",
                     speed, rpm, air.pm2_5, air.temperature, air.humidity,
                     air.voc_index, air.nox_index);
        } else if (sen_ret == ESP_ERR_NOT_FOUND) {
            // No new data available yet - this is normal, not an error
            ESP_LOGD(TAG, "Fan %d%% %lu RPM | No new sensor data", speed, rpm);
        } else {
            handle_sensor_failure();
            ESP_LOGI(TAG, "Fan %d%% %lu RPM | SEN55 error (failures: %lu)",
                     speed, rpm, sensor_failures);
        }

        // Periodic health logging
        if (loop_count % HEALTH_LOG_INTERVAL == 0) {
            log_health_status();
        }

        // Feed watchdog between I2C operations to avoid timeout during retry-heavy cycles
        esp_task_wdt_reset();

        // Periodic device status register check (~every 30s)
        if (loop_count % 15 == 7) {
            sen55_device_status_t dev_status;
            sen55_read_device_status(&dev_status);
        }

        // Periodic fan cleaning check (daily; 0 initial value ensures first check after NTP sync)
        int64_t now_us = esp_timer_get_time();
        if (time_sync_is_synced() &&
            (now_us - last_fan_clean_check_us >= (int64_t)FAN_CLEAN_CHECK_INTERVAL_S * 1000000)) {
            last_fan_clean_check_us = now_us;
            if (sen55_check_fan_cleaning((uint32_t)time_sync_get_timestamp())) {
                ESP_LOGI(TAG, "Weekly fan cleaning triggered");
            }
        }

        // Periodic VOC state save (every 2 hours, per Sensirion Engineering Guidelines)
        if (now_us - last_voc_save_us >= (int64_t)VOC_SAVE_INTERVAL_S * 1000000) {
            esp_task_wdt_reset();
            sen55_save_voc_state();
            last_voc_save_us = now_us;
        }

        // Periodic history auto-save (every 6 hours)
        if (now_us - last_history_save_us >= (int64_t)HISTORY_SAVE_INTERVAL_S * 1000000) {
            ESP_LOGI(TAG, "Auto-saving history to flash...");
            esp_task_wdt_reset();
            if (history_save() == ESP_OK) {
                ESP_LOGI(TAG, "History auto-save complete");
                last_history_save_us = now_us;
            } else {
                ESP_LOGW(TAG, "History auto-save failed, retrying in 5 minutes");
                // Retry in 5 minutes instead of waiting another 6 hours
                last_history_save_us = now_us - (int64_t)HISTORY_SAVE_INTERVAL_S * 1000000
                                              + (int64_t)300 * 1000000;
            }
        }

        // Periodic PM number concentration read (~every 30s)
        if (loop_count % 30 == 15) {
            sen55_pm_detail_t pm_detail;
            sen55_read_pm_details(&pm_detail);
        }

        vTaskDelay(pdMS_TO_TICKS(MONITOR_INTERVAL_MS));
    }
}
