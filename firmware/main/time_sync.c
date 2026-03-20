/**
 * @file time_sync.c
 * @brief NTP time synchronization implementation
 */

#include "time_sync.h"
#include "esp_netif_sntp.h"
#include "esp_log.h"
#include "esp_timer.h"
#include <stdatomic.h>
#include <string.h>
#include <sys/time.h>

static const char *TAG = "time_sync";

// Time is considered valid if year >= 2024
#define TIME_VALID_YEAR 2024

static atomic_bool time_synced = false;

/**
 * @brief Callback when time sync completes
 */
static void time_sync_notification_cb(struct timeval *tv)
{
    atomic_store(&time_synced, true);

    // Log the synced time
    struct tm timeinfo;
    localtime_r(&tv->tv_sec, &timeinfo);

    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
    ESP_LOGI(TAG, "Time synchronized: %s", buf);
}

esp_err_t time_sync_init(void)
{
    ESP_LOGI(TAG, "Initializing SNTP time sync");

    // Set timezone to US Eastern (EST5EDT)
    setenv("TZ", "EST5EDT,M3.2.0,M11.1.0", 1);
    tzset();

    // Configure SNTP with callback
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    config.sync_cb = time_sync_notification_cb;

    esp_err_t ret = esp_netif_sntp_init(&config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to init SNTP: %s", esp_err_to_name(ret));
        return ret;
    }

    ESP_LOGI(TAG, "SNTP initialized, waiting for sync...");
    return ESP_OK;
}

esp_err_t time_sync_wait(uint32_t timeout_ms)
{
    esp_err_t ret = esp_netif_sntp_sync_wait(pdMS_TO_TICKS(timeout_ms));
    if (ret == ESP_OK) {
        atomic_store(&time_synced, true);
        ESP_LOGI(TAG, "Time sync completed");
    } else {
        ESP_LOGW(TAG, "Time sync timeout after %lu ms", (unsigned long)timeout_ms);
    }
    return ret;
}

bool time_sync_is_synced(void)
{
    // Double-check by verifying year is reasonable
    if (atomic_load(&time_synced)) {
        time_t now;
        struct tm timeinfo;
        time(&now);
        localtime_r(&now, &timeinfo);

        if (timeinfo.tm_year + 1900 < TIME_VALID_YEAR) {
            atomic_store(&time_synced, false);
        }
    }
    return atomic_load(&time_synced);
}

time_t time_sync_get_timestamp(void)
{
    if (time_sync_is_synced()) {
        time_t now;
        time(&now);
        return now;
    }

    // Fall back to seconds since boot
    return (time_t)(esp_timer_get_time() / 1000000);
}

const char* time_sync_get_time_str(char *buf, size_t buf_size)
{
    if (!time_sync_is_synced()) {
        snprintf(buf, buf_size, "not synced");
        return buf;
    }

    time_t now;
    struct tm timeinfo;
    time(&now);
    localtime_r(&now, &timeinfo);

    strftime(buf, buf_size, "%Y-%m-%d %H:%M:%S", &timeinfo);
    return buf;
}
