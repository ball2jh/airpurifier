/**
 * @file wifi.c
 * @brief WiFi station management implementation
 *
 * Features:
 * - Automatic connection on init
 * - Non-blocking reconnection with smart backoff
 * - Different backoff strategies based on failure type:
 *   - Auth failures (wrong password): aggressive backoff to 6 hours max
 *   - Network unavailable (router down): moderate backoff to 60s max
 * - Connection status tracking
 */

#include "wifi.h"
#include "wifi_config.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_check.h"
#include "esp_timer.h"
#include "esp_task_wdt.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include <string.h>
#include <inttypes.h>

static const char *TAG = "wifi";

// =============================================================================
// Configuration
// =============================================================================

// Network unavailable backoff (router rebooting, temporary outage)
#define NETWORK_INITIAL_MS      1000        // 1 second
#define NETWORK_MAX_MS          60000       // 60 seconds max

// Auth failure backoff (wrong password - don't spam)
#define AUTH_INITIAL_MS         60000       // 1 minute
#define AUTH_MAX_MS             21600000    // 6 hours max

// Thresholds
#define FAST_RETRY_COUNT        5           // Fast retries before slowing down
#define AUTH_FAIL_THRESHOLD     3           // Auth failures before assuming bad password

// =============================================================================
// State
// =============================================================================

// Event group for signaling connection status
static EventGroupHandle_t wifi_event_group;
#define WIFI_CONNECTED_BIT  BIT0
#define WIFI_FAIL_BIT       BIT1

// Connection status
static wifi_status_t status = {0};
static char ip_addr_str[16] = "0.0.0.0";

// Reconnection state
static esp_timer_handle_t reconnect_timer = NULL;
static int retry_count = 0;
static int auth_fail_count = 0;
static bool reconnect_enabled = true;
static uint8_t last_disconnect_reason = 0;

// =============================================================================
// Disconnect Reason Analysis
// =============================================================================

/**
 * @brief Check if disconnect reason indicates authentication failure
 */
static bool is_auth_failure(uint8_t reason)
{
    // See esp_wifi_types.h for WIFI_REASON_* codes
    switch (reason) {
        case 2:   // WIFI_REASON_AUTH_EXPIRE
        case 15:  // WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT
        case 16:  // WIFI_REASON_GROUP_KEY_UPDATE_TIMEOUT
        case 17:  // WIFI_REASON_IE_IN_4WAY_DIFFERS
        case 202: // WIFI_REASON_AUTH_FAIL
        case 204: // WIFI_REASON_HANDSHAKE_TIMEOUT
            return true;
        default:
            return false;
    }
}

/**
 * @brief Check if disconnect reason indicates network unavailable
 */
static bool is_network_unavailable(uint8_t reason)
{
    switch (reason) {
        case 1:   // WIFI_REASON_UNSPECIFIED
        case 201: // WIFI_REASON_NO_AP_FOUND
        case 203: // WIFI_REASON_ASSOC_FAIL
        case 205: // WIFI_REASON_CONNECTION_FAIL
            return true;
        default:
            return false;
    }
}

/**
 * @brief Get human-readable disconnect reason
 */
static const char* get_disconnect_reason_str(uint8_t reason)
{
    switch (reason) {
        case 1:   return "UNSPECIFIED";
        case 2:   return "AUTH_EXPIRE";
        case 8:   return "ASSOC_LEAVE";
        case 15:  return "4WAY_HANDSHAKE_TIMEOUT";
        case 201: return "NO_AP_FOUND";
        case 202: return "AUTH_FAIL";
        case 203: return "ASSOC_FAIL";
        case 204: return "HANDSHAKE_TIMEOUT";
        case 205: return "CONNECTION_FAIL";
        default:  return "UNKNOWN";
    }
}

// =============================================================================
// Smart Backoff Logic
// =============================================================================

/**
 * @brief Calculate appropriate backoff delay based on failure type
 */
static uint32_t get_smart_retry_delay_ms(void)
{
    uint32_t delay;

    if (auth_fail_count >= AUTH_FAIL_THRESHOLD) {
        // Likely wrong password - back off aggressively
        // 1min, 2min, 4min, 8min, 16min, 32min, 64min, 128min, 256min, 360min (6hr cap)
        int auth_backoff_level = auth_fail_count - AUTH_FAIL_THRESHOLD;
        if (auth_backoff_level > 16) auth_backoff_level = 16;  // 60000 << 16 fits uint32_t
        delay = (uint32_t)AUTH_INITIAL_MS << auth_backoff_level;
        if (delay > AUTH_MAX_MS) {
            delay = AUTH_MAX_MS;
        }

        ESP_LOGW(TAG, "Auth failure mode: next retry in %" PRIu32 " minutes",
                 delay / 60000);
    } else {
        // Network issue - moderate backoff
        // 1s, 2s, 4s, 8s, 16s, 32s, 60s cap
        if (retry_count < FAST_RETRY_COUNT) {
            delay = (uint32_t)NETWORK_INITIAL_MS << retry_count;
        } else {
            delay = NETWORK_MAX_MS;
        }
        if (delay > NETWORK_MAX_MS) {
            delay = NETWORK_MAX_MS;
        }
    }

    return delay;
}

/**
 * @brief Timer callback - attempts WiFi reconnection
 */
static void reconnect_timer_callback(void *arg)
{
    if (!reconnect_enabled) {
        return;
    }

    if (auth_fail_count >= AUTH_FAIL_THRESHOLD) {
        ESP_LOGI(TAG, "Attempting reconnection (auth fail mode, attempt %d)...",
                 auth_fail_count);
    } else {
        ESP_LOGI(TAG, "Attempting reconnection (attempt %d)...", retry_count + 1);
    }

    esp_err_t ret = esp_wifi_connect();
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "esp_wifi_connect failed: %s", esp_err_to_name(ret));
    }
}

/**
 * @brief Schedule a reconnection attempt with smart backoff
 */
static void schedule_reconnect(void)
{
    if (!reconnect_enabled || reconnect_timer == NULL) {
        return;
    }

    uint32_t delay = get_smart_retry_delay_ms();
    retry_count++;

    // Log appropriately based on delay magnitude
    if (delay >= 60000) {
        ESP_LOGW(TAG, "Scheduling reconnect in %" PRIu32 " minutes (attempt %d, reason: %s)",
                 delay / 60000, retry_count, get_disconnect_reason_str(last_disconnect_reason));
    } else {
        ESP_LOGW(TAG, "Scheduling reconnect in %" PRIu32 "ms (attempt %d, reason: %s)",
                 delay, retry_count, get_disconnect_reason_str(last_disconnect_reason));
    }

    esp_timer_stop(reconnect_timer);
    esp_err_t ret = esp_timer_start_once(reconnect_timer, (uint64_t)delay * 1000);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start reconnect timer: %s", esp_err_to_name(ret));
    }
}

// =============================================================================
// Event Handler
// =============================================================================

/**
 * @brief WiFi event handler - non-blocking with smart backoff
 */
static void wifi_event_handler(void *arg, esp_event_base_t event_base,
                                int32_t event_id, void *event_data)
{
    if (event_base == WIFI_EVENT) {
        switch (event_id) {
            case WIFI_EVENT_STA_START:
                ESP_LOGI(TAG, "WiFi started, connecting...");
                esp_wifi_connect();
                break;

            case WIFI_EVENT_STA_CONNECTED:
                ESP_LOGI(TAG, "Connected to AP, waiting for IP...");
                break;

            case WIFI_EVENT_STA_DISCONNECTED: {
                wifi_event_sta_disconnected_t *event =
                    (wifi_event_sta_disconnected_t *)event_data;

                status.connected = false;
                status.disconnect_count++;
                last_disconnect_reason = event->reason;
                xEventGroupClearBits(wifi_event_group, WIFI_CONNECTED_BIT);

                ESP_LOGW(TAG, "Disconnected: %s (code %d)",
                         get_disconnect_reason_str(event->reason), event->reason);

                // Track auth failures separately
                if (is_auth_failure(event->reason)) {
                    auth_fail_count++;
                    if (auth_fail_count == AUTH_FAIL_THRESHOLD) {
                        ESP_LOGE(TAG, "Multiple auth failures - possible wrong password");
                        ESP_LOGE(TAG, "Switching to aggressive backoff (max 6 hours)");
                    }
                } else if (is_network_unavailable(event->reason)) {
                    // Network issue, not auth - don't count toward auth failures
                    // But don't reset auth_fail_count either (password might still be wrong)
                }

                // Schedule non-blocking reconnection
                if (reconnect_enabled) {
                    schedule_reconnect();
                }
                break;
            }

            default:
                break;
        }
    } else if (event_base == IP_EVENT) {
        if (event_id == IP_EVENT_STA_GOT_IP) {
            ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;

            snprintf(ip_addr_str, sizeof(ip_addr_str), IPSTR, IP2STR(&event->ip_info.ip));
            strncpy(status.ip_addr, ip_addr_str, sizeof(status.ip_addr) - 1);

            status.connected = true;
            status.connect_count++;

            // Reset ALL failure counters on successful connection
            retry_count = 0;
            auth_fail_count = 0;

            // Stop any pending reconnect timer
            if (reconnect_timer) {
                esp_timer_stop(reconnect_timer);
            }

            ESP_LOGI(TAG, "Connected! IP: %s", ip_addr_str);
            if (status.disconnect_count > 0) {
                ESP_LOGI(TAG, "  (recovered after %lu disconnects)", status.disconnect_count);
            }
            xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
        }
    }
}

// =============================================================================
// Public API
// =============================================================================

esp_err_t wifi_init(void)
{
    ESP_LOGI(TAG, "Initializing WiFi...");

    // Initialize NVS (required for WiFi)
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "Erasing NVS flash...");
        ESP_RETURN_ON_ERROR(nvs_flash_erase(), TAG, "NVS erase failed");
        ret = nvs_flash_init();
    }
    ESP_RETURN_ON_ERROR(ret, TAG, "NVS init failed");

    // Create event group
    wifi_event_group = xEventGroupCreate();
    if (wifi_event_group == NULL) {
        ESP_LOGE(TAG, "Failed to create event group");
        return ESP_ERR_NO_MEM;
    }

    // Create reconnect timer
    esp_timer_create_args_t timer_args = {
        .callback = reconnect_timer_callback,
        .name = "wifi_reconnect"
    };
    ESP_RETURN_ON_ERROR(esp_timer_create(&timer_args, &reconnect_timer), TAG,
                        "Reconnect timer create failed");

    // Initialize network interface
    ESP_RETURN_ON_ERROR(esp_netif_init(), TAG, "Netif init failed");

    // Create default event loop (may already exist)
    ret = esp_event_loop_create_default();
    if (ret != ESP_OK && ret != ESP_ERR_INVALID_STATE) {
        ESP_LOGE(TAG, "Event loop create failed: %s", esp_err_to_name(ret));
        return ret;
    }

    // Create default WiFi station
    esp_netif_create_default_wifi_sta();

    // Initialize WiFi with default config
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_RETURN_ON_ERROR(esp_wifi_init(&cfg), TAG, "WiFi init failed");

    // Register event handlers
    ESP_RETURN_ON_ERROR(
        esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                            &wifi_event_handler, NULL, NULL),
        TAG, "WiFi event handler register failed");

    ESP_RETURN_ON_ERROR(
        esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                            &wifi_event_handler, NULL, NULL),
        TAG, "IP event handler register failed");

    // Configure WiFi
    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASSWORD,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
            .sae_pwe_h2e = WPA3_SAE_PWE_BOTH,
            // Scan all channels to find AP (required for failure_retry_cnt)
            .scan_method = WIFI_ALL_CHANNEL_SCAN,
            // Retry same AP 3 times before declaring failure
            // This handles transient failures during initial connection
            .failure_retry_cnt = 3,
        },
    };

    ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_STA), TAG, "Set mode failed");
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &wifi_config), TAG, "Set config failed");

    // Start WiFi (will trigger STA_START event -> connect)
    ESP_RETURN_ON_ERROR(esp_wifi_start(), TAG, "WiFi start failed");

    ESP_LOGI(TAG, "WiFi initialized, connecting to '%s'...", WIFI_SSID);
    return ESP_OK;
}

bool wifi_is_connected(void)
{
    return status.connected;
}

esp_err_t wifi_wait_connected(uint32_t timeout_ms)
{
    // Wait in 5-second chunks to allow callers' watchdog timers to be fed
    const uint32_t chunk_ms = 5000;
    uint32_t remaining = timeout_ms;

    while (remaining > 0) {
        uint32_t wait = (remaining < chunk_ms) ? remaining : chunk_ms;
        TickType_t ticks = pdMS_TO_TICKS(wait);

        EventBits_t bits = xEventGroupWaitBits(wifi_event_group,
                                                WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
                                                pdFALSE, pdFALSE, ticks);

        if (bits & WIFI_CONNECTED_BIT) {
            return ESP_OK;
        }
        if (bits & WIFI_FAIL_BIT) {
            return ESP_ERR_TIMEOUT;
        }

        remaining -= wait;
        esp_task_wdt_reset();
    }

    return ESP_ERR_TIMEOUT;
}

void wifi_get_status(wifi_status_t *out)
{
    if (out == NULL) return;

    // Update RSSI if connected
    if (status.connected) {
        wifi_ap_record_t ap_info;
        if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
            status.rssi = ap_info.rssi;
        }
    }

    *out = status;
}

const char* wifi_get_ip(void)
{
    return ip_addr_str;
}
