/**
 * @file api_server.c
 * @brief REST API HTTP server implementation
 *
 * Uses ESP-IDF HTTP server component with JSON responses.
 * CORS headers added to all responses for cross-origin access.
 */

#include "api_server.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "cJSON.h"
#include "fan_controller.h"
#include "sen55.h"
#include "history.h"
#include "wifi.h"
#include "ota_update.h"
#include "time_sync.h"
#include "esp_system.h"
#include "esp_core_dump.h"
#include "esp_partition.h"
#include <string.h>
#include <stdlib.h>
#include <inttypes.h>
#include <math.h>
#include "nvs.h"

static const char *TAG = "api";

// Helper to sanitize float values (NaN/Inf break JSON serialization)
static inline double safe_float(float val) {
    if (isnan(val) || isinf(val)) return 0.0;
    return (double)val;
}
static httpd_handle_t server = NULL;

// =============================================================================
// CORS Helper
// =============================================================================

/**
 * @brief Add CORS headers to response
 */
static esp_err_t add_cors_headers(httpd_req_t *req)
{
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
    return ESP_OK;
}

/**
 * @brief Send error response with CORS headers
 */
static void send_error_with_cors(httpd_req_t *req, httpd_err_code_t code, const char *msg)
{
    add_cors_headers(req);
    httpd_resp_send_err(req, code, msg);
}

/**
 * @brief Send JSON response with CORS headers
 */
static esp_err_t send_json_response(httpd_req_t *req, cJSON *json)
{
    add_cors_headers(req);
    httpd_resp_set_type(req, "application/json");

    char *json_str = cJSON_PrintUnformatted(json);
    if (json_str == NULL) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "JSON error");
        return ESP_FAIL;
    }

    esp_err_t ret = httpd_resp_sendstr(req, json_str);
    free(json_str);
    return ret;
}

/**
 * @brief Handle CORS preflight OPTIONS request
 */
static esp_err_t options_handler(httpd_req_t *req)
{
    add_cors_headers(req);
    httpd_resp_set_hdr(req, "Access-Control-Max-Age", "86400");
    httpd_resp_send(req, NULL, 0);
    return ESP_OK;
}

/**
 * @brief Create a cJSON root object, returning 500 on allocation failure
 */
static cJSON *create_json_or_500(httpd_req_t *req)
{
    cJSON *root = cJSON_CreateObject();
    if (root == NULL) {
        send_error_with_cors(req, HTTPD_500_INTERNAL_SERVER_ERROR, "JSON allocation failed");
    }
    return root;
}

// =============================================================================
// History Aggregation Helpers
// =============================================================================

/**
 * @brief Resolution in seconds for each tier
 */
static const uint32_t tier_resolutions[TIER_COUNT] = {
    1,      // TIER_RAW
    60,     // TIER_FINE
    600,    // TIER_MEDIUM
    3600,   // TIER_COARSE
    21600,  // TIER_DAILY
    86400   // TIER_ARCHIVE
};

/**
 * @brief Time window in seconds for each view
 * These define how far back each "view" should show, regardless of tier data
 * Matched to actual storage capacity of each tier
 */
static const uint32_t view_time_windows[TIER_COUNT] = {
    1800,       // raw view: 30 min (1800 × 1s)
    21600,      // fine view: 6 hours (360 × 60s)
    86400,      // medium view: 24 hours (144 × 600s)
    604800,     // coarse view: 7 days (168 × 3600s)
    2592000,    // daily view: 30 days (120 × 21600s)
    94608000    // archive view: ~3 years (1095 × 86400s)
};

/**
 * @brief Output a single sample as CSV line
 */
static esp_err_t output_csv_sample(httpd_req_t *req, const history_sample_t *s, char *line_buf, size_t buf_size)
{
    int len = snprintf(line_buf, buf_size,
        "%llu,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%d,%d,%u,%u\n",
        (unsigned long long)s->timestamp,
        s->pm1_0, s->pm2_5, s->pm4_0, s->pm10,
        s->humidity, s->temperature,
        s->voc_index, s->nox_index,
        s->fan_rpm, s->fan_speed);
    return httpd_resp_send_chunk(req, line_buf, len);
}

/**
 * @brief Accumulator for aggregating samples into a bucket
 */
typedef struct {
    uint64_t bucket_start_ts;   // Timestamp of bucket start
    float sum_pm1, sum_pm25, sum_pm4, sum_pm10;
    float sum_hum, sum_temp;
    int32_t sum_voc, sum_nox;
    uint32_t sum_rpm, sum_speed;
    uint32_t count;
} sample_accumulator_t;

/**
 * @brief Reset accumulator for a new bucket
 */
static void reset_accumulator(sample_accumulator_t *acc, uint64_t bucket_ts)
{
    memset(acc, 0, sizeof(*acc));
    acc->bucket_start_ts = bucket_ts;
}

/**
 * @brief Add a sample to the accumulator
 */
static void accumulate_sample(sample_accumulator_t *acc, const history_sample_t *s)
{
    // Skip invalid readings
    if (s->pm2_5 < 0) return;

    acc->sum_pm1 += s->pm1_0;
    acc->sum_pm25 += s->pm2_5;
    acc->sum_pm4 += s->pm4_0;
    acc->sum_pm10 += s->pm10;
    acc->sum_hum += s->humidity;
    acc->sum_temp += s->temperature;
    acc->sum_voc += s->voc_index;
    acc->sum_nox += s->nox_index;
    acc->sum_rpm += s->fan_rpm;
    acc->sum_speed += s->fan_speed;
    acc->count++;
}

/**
 * @brief Output accumulated bucket as CSV line
 */
static esp_err_t output_accumulated_bucket(httpd_req_t *req, sample_accumulator_t *acc, char *line_buf, size_t buf_size)
{
    if (acc->count == 0) return ESP_OK;

    history_sample_t avg = {
        .timestamp = acc->bucket_start_ts,
        .pm1_0 = acc->sum_pm1 / acc->count,
        .pm2_5 = acc->sum_pm25 / acc->count,
        .pm4_0 = acc->sum_pm4 / acc->count,
        .pm10 = acc->sum_pm10 / acc->count,
        .humidity = acc->sum_hum / acc->count,
        .temperature = acc->sum_temp / acc->count,
        .voc_index = (int16_t)(acc->sum_voc / acc->count),
        .nox_index = (int16_t)(acc->sum_nox / acc->count),
        .fan_rpm = (uint16_t)(acc->sum_rpm / acc->count),
        .fan_speed = (uint8_t)(acc->sum_speed / acc->count),
    };
    return output_csv_sample(req, &avg, line_buf, buf_size);
}

/**
 * @brief Output samples from a tier within a BUCKET range
 *
 * Filters by which bucket a sample falls into, not raw timestamp.
 * This prevents overlap when samples from different tiers fall into the same bucket.
 *
 * @param req HTTP request for output
 * @param source_tier Tier to read samples from
 * @param target_resolution_s Target bucket size in seconds
 * @param min_bucket Minimum bucket timestamp (inclusive)
 * @param max_bucket Maximum bucket timestamp (exclusive)
 */
static esp_err_t output_tier_in_range(
    httpd_req_t *req,
    history_tier_t source_tier,
    uint32_t target_resolution_s,
    uint64_t min_bucket,
    uint64_t max_bucket)
{
    if (min_bucket >= max_bucket) return ESP_OK;

    const uint32_t batch_size = 50;
    history_sample_t *samples = malloc(batch_size * sizeof(history_sample_t));
    if (samples == NULL) return ESP_ERR_NO_MEM;

    char line[128];
    sample_accumulator_t acc;
    memset(&acc, 0, sizeof(acc));

    uint32_t total = history_get_count(source_tier);
    uint32_t offset = 0;
    bool first_sample = true;
    esp_err_t ret = ESP_OK;

    while (offset < total) {
        uint32_t count = 0;
        esp_err_t err = history_get_samples(source_tier, samples, batch_size, offset, &count);
        if (err != ESP_OK || count == 0) break;

        for (uint32_t i = 0; i < count; i++) {
            history_sample_t *s = &samples[i];

            // Calculate which bucket this sample belongs to
            uint64_t bucket_ts = (s->timestamp / target_resolution_s) * target_resolution_s;

            // Skip samples whose BUCKET is outside our range
            // This prevents overlap between tiers
            if (bucket_ts < min_bucket || bucket_ts >= max_bucket) continue;

            // If this is a new bucket, output the previous one
            if (first_sample) {
                reset_accumulator(&acc, bucket_ts);
                first_sample = false;
            } else if (bucket_ts != acc.bucket_start_ts) {
                ret = output_accumulated_bucket(req, &acc, line, sizeof(line));
                if (ret != ESP_OK) goto done;
                reset_accumulator(&acc, bucket_ts);
            }

            accumulate_sample(&acc, s);
        }
        offset += count;
    }

    // Output final bucket
    if (acc.count > 0) {
        ret = output_accumulated_bucket(req, &acc, line, sizeof(line));
    }

done:
    free(samples);
    return ret;
}

/**
 * @brief Find the oldest timestamp in a tier that's >= min_ts
 * @return The oldest timestamp, or UINT64_MAX if no samples in range
 */
static uint64_t find_tier_oldest_in_range(history_tier_t tier, uint64_t min_ts)
{
    uint32_t total = history_get_count(tier);
    if (total == 0) return UINT64_MAX;

    // Samples are stored oldest first, so scan from start
    const uint32_t batch_size = 50;
    history_sample_t *samples = malloc(batch_size * sizeof(history_sample_t));
    if (samples == NULL) return UINT64_MAX;

    uint32_t offset = 0;
    uint64_t oldest = UINT64_MAX;

    while (offset < total) {
        uint32_t count = 0;
        esp_err_t err = history_get_samples(tier, samples, batch_size, offset, &count);
        if (err != ESP_OK || count == 0) break;

        for (uint32_t i = 0; i < count; i++) {
            if (samples[i].timestamp >= min_ts) {
                oldest = samples[i].timestamp;
                goto done;  // Found oldest valid sample
            }
        }
        offset += count;
    }

done:
    free(samples);
    return oldest;
}

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * @brief GET /api/status - Current readings
 */
static esp_err_t status_handler(httpd_req_t *req)
{
    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;

    // Sensor data - use cached last reading to avoid racing the main loop
    sen55_data_t air;
    cJSON *sensor = cJSON_AddObjectToObject(root, "sensor");
    if (sen55_get_last_reading(&air)) {
        cJSON_AddNumberToObject(sensor, "pm1_0", air.pm1_0);
        cJSON_AddNumberToObject(sensor, "pm2_5", air.pm2_5);
        cJSON_AddNumberToObject(sensor, "pm4_0", air.pm4_0);
        cJSON_AddNumberToObject(sensor, "pm10", air.pm10);
        cJSON_AddNumberToObject(sensor, "humidity", air.humidity);
        cJSON_AddNumberToObject(sensor, "temperature", air.temperature);
        cJSON_AddNumberToObject(sensor, "voc_index", air.voc_index);
        cJSON_AddNumberToObject(sensor, "nox_index", air.nox_index);
        cJSON_AddBoolToObject(sensor, "valid", true);

        // PM number concentrations (supplementary, updated every ~30s)
        sen55_pm_detail_t pm_detail;
        if (sen55_get_last_pm_details(&pm_detail)) {
            cJSON *pm_num = cJSON_AddObjectToObject(sensor, "pm_number");
            cJSON_AddNumberToObject(pm_num, "nc_pm0_5", safe_float(pm_detail.nc_pm0_5));
            cJSON_AddNumberToObject(pm_num, "nc_pm1_0", safe_float(pm_detail.nc_pm1_0));
            cJSON_AddNumberToObject(pm_num, "nc_pm2_5", safe_float(pm_detail.nc_pm2_5));
            cJSON_AddNumberToObject(pm_num, "nc_pm4_0", safe_float(pm_detail.nc_pm4_0));
            cJSON_AddNumberToObject(pm_num, "nc_pm10", safe_float(pm_detail.nc_pm10));
            cJSON_AddNumberToObject(pm_num, "typical_size", safe_float(pm_detail.typical_size));
        }
    } else {
        cJSON_AddBoolToObject(sensor, "valid", false);
    }

    // Fan data
    cJSON *fan = cJSON_AddObjectToObject(root, "fan");
    cJSON_AddStringToObject(fan, "mode", fan_get_mode() == FAN_MODE_AUTO ? "auto" : "manual");
    cJSON_AddNumberToObject(fan, "speed_percent", fan_get_speed_percent());
    cJSON_AddNumberToObject(fan, "target_speed", fan_get_target_speed());
    cJSON_AddNumberToObject(fan, "rpm", fan_get_rpm());
    cJSON_AddBoolToObject(fan, "stalled", fan_is_stalled());

    // Timestamp
    cJSON_AddNumberToObject(root, "timestamp", (double)history_get_timestamp());

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief GET /api/fan - Fan settings
 */
static esp_err_t fan_get_handler(httpd_req_t *req)
{
    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;

    cJSON_AddStringToObject(root, "mode", fan_get_mode() == FAN_MODE_AUTO ? "auto" : "manual");
    cJSON_AddNumberToObject(root, "speed_percent", fan_get_speed_percent());
    cJSON_AddNumberToObject(root, "target_speed", fan_get_target_speed());
    cJSON_AddNumberToObject(root, "rpm", fan_get_rpm());
    cJSON_AddBoolToObject(root, "stalled", fan_is_stalled());

    fan_health_t health;
    fan_get_health(&health);
    cJSON_AddNumberToObject(root, "stall_events", health.stall_events);
    cJSON_AddNumberToObject(root, "recovery_attempts", health.recovery_attempts);

    int32_t remaining = fan_get_manual_remaining_sec();
    if (remaining >= 0) {
        cJSON_AddNumberToObject(root, "manual_timeout_remaining", remaining);
    }

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief POST /api/fan - Set fan mode and/or speed
 * Body: {"mode": "auto"} - switch to auto mode
 *       {"mode": "manual", "speed": 75} - switch to manual with speed
 *       {"speed": 50} - set speed (implies manual mode)
 */
static esp_err_t fan_post_handler(httpd_req_t *req)
{
    char buf[64];
    int ret = httpd_req_recv(req, buf, sizeof(buf) - 1);
    if (ret <= 0) {
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "No body");
        return ESP_FAIL;
    }
    buf[ret] = '\0';

    cJSON *json = cJSON_Parse(buf);
    if (json == NULL) {
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Invalid JSON");
        return ESP_FAIL;
    }

    cJSON *mode_item = cJSON_GetObjectItem(json, "mode");
    cJSON *speed_item = cJSON_GetObjectItem(json, "speed");

    // Handle mode change
    if (cJSON_IsString(mode_item)) {
        const char *mode_str = mode_item->valuestring;
        if (strcmp(mode_str, "auto") == 0) {
            fan_set_mode(FAN_MODE_AUTO);
            ESP_LOGI(TAG, "Fan mode set to AUTO via API");
        } else if (strcmp(mode_str, "manual") == 0) {
            // Manual mode requires speed
            if (!cJSON_IsNumber(speed_item)) {
                cJSON_Delete(json);
                send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Manual mode requires 'speed' field");
                return ESP_FAIL;
            }
            fan_set_mode(FAN_MODE_MANUAL);
            int speed = (int)speed_item->valuedouble;
            if (speed < 0 || speed > 100) {
                cJSON_Delete(json);
                send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Speed must be 0-100");
                return ESP_FAIL;
            }
            fan_set_speed_percent((uint8_t)speed);
            ESP_LOGI(TAG, "Fan mode set to MANUAL, speed %d%% via API", speed);
        } else {
            cJSON_Delete(json);
            send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Invalid mode (use 'auto' or 'manual')");
            return ESP_FAIL;
        }
    } else if (cJSON_IsNumber(speed_item)) {
        // Just speed change - switch to manual mode
        int speed = (int)speed_item->valuedouble;
        if (speed < 0 || speed > 100) {
            cJSON_Delete(json);
            send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Speed must be 0-100");
            return ESP_FAIL;
        }
        fan_set_mode(FAN_MODE_MANUAL);
        fan_set_speed_percent((uint8_t)speed);
        ESP_LOGI(TAG, "Fan speed set to %d%% via API (manual mode)", speed);
    } else {
        cJSON_Delete(json);
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Missing 'mode' or 'speed' field");
        return ESP_FAIL;
    }

    cJSON_Delete(json);

    // Return new status
    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;
    cJSON_AddBoolToObject(root, "success", true);
    cJSON_AddStringToObject(root, "mode", fan_get_mode() == FAN_MODE_AUTO ? "auto" : "manual");
    cJSON_AddNumberToObject(root, "speed_percent", fan_get_speed_percent());
    cJSON_AddNumberToObject(root, "target_speed", fan_get_target_speed());

    esp_err_t err = send_json_response(req, root);
    cJSON_Delete(root);
    return err;
}

/**
 * @brief GET /api/history/:tier - Historical data
 */
/**
 * @brief Send history data as CSV (streamed, memory-efficient)
 *
 * Uses TIME-BASED retrieval: returns all data within the requested time window
 * (e.g., "24h" = last 24 hours), using the finest resolution available for
 * each time period.
 *
 * For recent data, uses finer tiers (RAW, FINE). For older data where fine
 * tiers have no coverage, falls back to coarser tiers (MEDIUM, COARSE, etc).
 */
static esp_err_t history_send_csv(httpd_req_t *req, history_tier_t view)
{
    add_cors_headers(req);
    httpd_resp_set_type(req, "text/csv");

    // Send CSV header
    const char *header = "timestamp,pm1_0,pm2_5,pm4_0,pm10,humidity,temperature,voc_index,nox_index,fan_rpm,fan_speed\n";
    httpd_resp_send_chunk(req, header, strlen(header));

    // Get current time and calculate cutoff based on requested time window
    uint64_t now = history_get_timestamp();
    uint32_t time_window = view_time_windows[view];
    uint64_t cutoff = (now > time_window) ? (now - time_window) : 0;
    uint32_t target_resolution = tier_resolutions[view];

    // Find where each tier's data starts (within our time window)
    // This tells us which tier to use for each time period
    uint64_t tier_oldest[TIER_COUNT];
    for (int t = 0; t < TIER_COUNT; t++) {
        tier_oldest[t] = find_tier_oldest_in_range((history_tier_t)t, cutoff);
    }

    // Output data from coarsest to finest tier
    // Each tier fills in time periods that finer tiers don't cover
    for (int tier = TIER_ARCHIVE; tier >= TIER_RAW; tier--) {
        // Skip if this tier has no data in our time window
        if (tier_oldest[tier] == UINT64_MAX) continue;

        // Determine upper bound: where the next finer tier's data starts
        // This tier only outputs data OLDER than what finer tiers can provide
        uint64_t upper_bound = now + 1;  // Default: cover up to now

        // Find the finest tier (lower index) that has data
        for (int finer = tier - 1; finer >= TIER_RAW; finer--) {
            if (tier_oldest[finer] != UINT64_MAX) {
                upper_bound = tier_oldest[finer];
                break;
            }
        }

        // Align boundaries to bucket boundaries to prevent overlap
        // When samples from different tiers fall into the same bucket,
        // only the finer tier should output that bucket
        uint64_t range_start = tier_oldest[tier];
        if (range_start < cutoff) range_start = cutoff;

        // Align to bucket boundaries
        uint64_t min_bucket = (range_start / target_resolution) * target_resolution;
        uint64_t max_bucket = ((upper_bound + target_resolution - 1) / target_resolution) * target_resolution;

        esp_err_t err = output_tier_in_range(req, (history_tier_t)tier, target_resolution,
                            min_bucket, max_bucket);
        if (err != ESP_OK) {
            // Client likely disconnected - stop sending
            return err;
        }
    }

    httpd_resp_send_chunk(req, NULL, 0);  // End chunked response
    return ESP_OK;
}

static esp_err_t history_handler(httpd_req_t *req)
{
    // Parse tier from URI: /api/history/raw, /api/history/fine, etc.
    const char *uri = req->uri;
    const char *tier_start = strrchr(uri, '/');
    if (tier_start == NULL) {
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Invalid URI");
        return ESP_FAIL;
    }
    tier_start++;  // Skip '/'

    // Copy tier string, stripping any query params
    char tier_str[16];
    const char *query_start = strchr(tier_start, '?');
    size_t tier_len = query_start ? (size_t)(query_start - tier_start) : strlen(tier_start);
    if (tier_len >= sizeof(tier_str)) tier_len = sizeof(tier_str) - 1;
    strncpy(tier_str, tier_start, tier_len);
    tier_str[tier_len] = '\0';

    // Parse query parameters
    char query[64] = {0};
    httpd_req_get_url_query_str(req, query, sizeof(query));

    // Check for format=csv
    char format[16] = {0};
    httpd_query_key_value(query, "format", format, sizeof(format));
    bool use_csv = (strcmp(format, "csv") == 0);

    // Map tier string to enum
    history_tier_t tier;
    if (strcmp(tier_str, "raw") == 0) {
        tier = TIER_RAW;
    } else if (strcmp(tier_str, "fine") == 0) {
        tier = TIER_FINE;
    } else if (strcmp(tier_str, "medium") == 0) {
        tier = TIER_MEDIUM;
    } else if (strcmp(tier_str, "coarse") == 0) {
        tier = TIER_COARSE;
    } else if (strcmp(tier_str, "daily") == 0) {
        tier = TIER_DAILY;
    } else if (strcmp(tier_str, "archive") == 0) {
        tier = TIER_ARCHIVE;
    } else {
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST,
            "Invalid tier. Use: raw, fine, medium, coarse, daily, archive");
        return ESP_FAIL;
    }

    // CSV format: stream all data efficiently
    if (use_csv) {
        return history_send_csv(req, tier);
    }

    // JSON format: paginated (limited by heap)
    uint32_t offset = 0;
    uint32_t limit = 50;

    char param[16];
    if (httpd_query_key_value(query, "offset", param, sizeof(param)) == ESP_OK) {
        offset = (uint32_t)atoi(param);
    }
    if (httpd_query_key_value(query, "limit", param, sizeof(param)) == ESP_OK) {
        limit = (uint32_t)atoi(param);
        if (limit > 75) limit = 75;  // Cap to fit in ESP32 heap
    }

    // Allocate buffer for samples
    history_sample_t *samples = malloc(limit * sizeof(history_sample_t));
    if (samples == NULL) {
        send_error_with_cors(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Out of memory");
        return ESP_FAIL;
    }

    uint32_t count = 0;
    esp_err_t hist_err = history_get_samples(tier, samples, limit, offset, &count);
    if (hist_err != ESP_OK) {
        free(samples);
        send_error_with_cors(req, HTTPD_500_INTERNAL_SERVER_ERROR, "History not available");
        return ESP_FAIL;
    }

    // Build JSON response
    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;
    cJSON_AddStringToObject(root, "tier", tier_str);
    cJSON_AddNumberToObject(root, "resolution_seconds", tier_resolutions[tier]);
    cJSON_AddNumberToObject(root, "total_count", history_get_count(tier));
    cJSON_AddNumberToObject(root, "offset", offset);
    cJSON_AddNumberToObject(root, "count", count);

    cJSON *data = cJSON_AddArrayToObject(root, "samples");
    for (uint32_t i = 0; i < count; i++) {
        cJSON *sample = cJSON_CreateObject();
        cJSON_AddNumberToObject(sample, "timestamp", samples[i].timestamp);
        cJSON_AddNumberToObject(sample, "pm1_0", safe_float(samples[i].pm1_0));
        cJSON_AddNumberToObject(sample, "pm2_5", safe_float(samples[i].pm2_5));
        cJSON_AddNumberToObject(sample, "pm4_0", safe_float(samples[i].pm4_0));
        cJSON_AddNumberToObject(sample, "pm10", safe_float(samples[i].pm10));
        cJSON_AddNumberToObject(sample, "humidity", safe_float(samples[i].humidity));
        cJSON_AddNumberToObject(sample, "temperature", safe_float(samples[i].temperature));
        cJSON_AddNumberToObject(sample, "voc_index", samples[i].voc_index);
        cJSON_AddNumberToObject(sample, "nox_index", samples[i].nox_index);
        cJSON_AddNumberToObject(sample, "fan_rpm", samples[i].fan_rpm);
        cJSON_AddNumberToObject(sample, "fan_speed", samples[i].fan_speed);
        cJSON_AddItemToArray(data, sample);
    }

    free(samples);

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief GET /api/health - System health
 */
static esp_err_t health_handler(httpd_req_t *req)
{
    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;

    // SEN55 health
    sen55_health_t sen_health;
    sen55_get_health(&sen_health);
    cJSON *sensor = cJSON_AddObjectToObject(root, "sensor");
    cJSON_AddBoolToObject(sensor, "healthy", sen_health.is_healthy);
    cJSON_AddNumberToObject(sensor, "total_reads", sen_health.total_reads);
    cJSON_AddNumberToObject(sensor, "successful_reads", sen_health.successful_reads);
    cJSON_AddNumberToObject(sensor, "crc_errors", sen_health.crc_errors);
    cJSON_AddNumberToObject(sensor, "i2c_errors", sen_health.i2c_errors);
    cJSON_AddNumberToObject(sensor, "recoveries", sen_health.reinit_count);

    // Include last CRC error details if any errors occurred
    if (sen_health.crc_errors > 0) {
        cJSON *crc_err = cJSON_AddObjectToObject(sensor, "last_crc_error");
        cJSON_AddNumberToObject(crc_err, "read_number", sen_health.last_crc_error.read_number);
        cJSON_AddNumberToObject(crc_err, "word_index", sen_health.last_crc_error.word_index);

        // Format data bytes as hex string
        char data_hex[8];
        snprintf(data_hex, sizeof(data_hex), "0x%02X%02X",
                 sen_health.last_crc_error.data[0], sen_health.last_crc_error.data[1]);
        cJSON_AddStringToObject(crc_err, "data", data_hex);

        // Format CRCs as hex
        char recv_hex[8], calc_hex[8];
        snprintf(recv_hex, sizeof(recv_hex), "0x%02X", sen_health.last_crc_error.recv_crc);
        snprintf(calc_hex, sizeof(calc_hex), "0x%02X", sen_health.last_crc_error.calc_crc);
        cJSON_AddStringToObject(crc_err, "recv_crc", recv_hex);
        cJSON_AddStringToObject(crc_err, "calc_crc", calc_hex);

        // Human-readable word name
        static const char *word_names[] = {
            "PM1.0", "PM2.5", "PM4.0", "PM10",
            "Humidity", "Temperature", "VOC", "NOx"
        };
        if (sen_health.last_crc_error.word_index < 8) {
            cJSON_AddStringToObject(crc_err, "field", word_names[sen_health.last_crc_error.word_index]);
        }
    }

    // Include sensor busy event tracking (normal ~1-2% of reads)
    if (sen_health.busy_events.count > 0) {
        cJSON *busy = cJSON_AddObjectToObject(sensor, "busy_skips");
        cJSON_AddNumberToObject(busy, "count", sen_health.busy_events.count);
        cJSON_AddNumberToObject(busy, "last_read_number", sen_health.busy_events.last_read_number);
        cJSON_AddNumberToObject(busy, "last_uptime_ms", (double)sen_health.busy_events.last_uptime_ms);
    }

    // Device status register flags
    if (sen_health.device_status.valid) {
        cJSON *dev_status = cJSON_AddObjectToObject(sensor, "device_status");
        cJSON_AddBoolToObject(dev_status, "fan_speed_warning", sen_health.device_status.fan_speed_warning);
        cJSON_AddBoolToObject(dev_status, "fan_cleaning", sen_health.device_status.fan_cleaning_active);
        cJSON_AddBoolToObject(dev_status, "gas_sensor_error", sen_health.device_status.gas_sensor_error);
        cJSON_AddBoolToObject(dev_status, "rht_error", sen_health.device_status.rht_error);
        cJSON_AddBoolToObject(dev_status, "laser_failure", sen_health.device_status.laser_failure);
        cJSON_AddBoolToObject(dev_status, "fan_failure", sen_health.device_status.fan_failure);
    }

    // Fan health
    fan_health_t fan_health;
    fan_get_health(&fan_health);
    cJSON *fan = cJSON_AddObjectToObject(root, "fan");
    cJSON_AddBoolToObject(fan, "healthy", fan_health.is_healthy);
    cJSON_AddBoolToObject(fan, "stalled", fan_health.is_stalled);
    cJSON_AddNumberToObject(fan, "stall_events", fan_health.stall_events);
    cJSON_AddNumberToObject(fan, "recovery_attempts", fan_health.recovery_attempts);

    // WiFi health
    wifi_status_t wifi_stat;
    wifi_get_status(&wifi_stat);
    cJSON *wifi = cJSON_AddObjectToObject(root, "wifi");
    cJSON_AddBoolToObject(wifi, "connected", wifi_stat.connected);
    cJSON_AddStringToObject(wifi, "ip", wifi_stat.ip_addr);
    cJSON_AddNumberToObject(wifi, "rssi", wifi_stat.rssi);
    cJSON_AddNumberToObject(wifi, "connect_count", wifi_stat.connect_count);
    cJSON_AddNumberToObject(wifi, "disconnect_count", wifi_stat.disconnect_count);

    // History stats
    history_stats_t hist_stats;
    history_get_stats(&hist_stats);
    cJSON *history = cJSON_AddObjectToObject(root, "history");
    cJSON_AddNumberToObject(history, "total_samples", hist_stats.total_samples_recorded);
    cJSON_AddNumberToObject(history, "memory_bytes", hist_stats.memory_used_bytes);

    // Per-tier breakdown
    static const char *tier_names[] = {"raw", "fine", "medium", "coarse", "daily", "archive"};
    cJSON *tiers = cJSON_AddArrayToObject(history, "tiers");
    for (int t = 0; t < TIER_COUNT; t++) {
        cJSON *tier = cJSON_CreateObject();
        cJSON_AddStringToObject(tier, "name", tier_names[t]);
        cJSON_AddNumberToObject(tier, "resolution", hist_stats.tiers[t].resolution_s);
        cJSON_AddNumberToObject(tier, "count", hist_stats.tiers[t].count);
        cJSON_AddNumberToObject(tier, "capacity", hist_stats.tiers[t].capacity);
        cJSON_AddNumberToObject(tier, "compactions", hist_stats.tiers[t].compactions);
        cJSON_AddItemToArray(tiers, tier);
    }

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief GET /api/info - Device info
 */
static esp_err_t info_handler(httpd_req_t *req)
{
    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;

    cJSON_AddStringToObject(root, "device", "ESP32 Environmental Controller");
    cJSON_AddStringToObject(root, "version", "1.0.0");

    // Uptime
    int64_t uptime_us = esp_timer_get_time();
    uint32_t uptime_s = (uint32_t)(uptime_us / 1000000);
    cJSON_AddNumberToObject(root, "uptime_seconds", uptime_s);

    // Format uptime string
    uint32_t days = uptime_s / 86400;
    uint32_t hours = (uptime_s % 86400) / 3600;
    uint32_t mins = (uptime_s % 3600) / 60;
    char uptime_str[32];
    snprintf(uptime_str, sizeof(uptime_str), "%" PRIu32 "d %" PRIu32 "h %" PRIu32 "m", days, hours, mins);
    cJSON_AddStringToObject(root, "uptime", uptime_str);

    // Network info
    cJSON_AddStringToObject(root, "ip", wifi_get_ip());

    // Time sync info
    cJSON_AddBoolToObject(root, "time_synced", time_sync_is_synced());
    if (time_sync_is_synced()) {
        char time_str[32];
        time_sync_get_time_str(time_str, sizeof(time_str));
        cJSON_AddStringToObject(root, "current_time", time_str);
        cJSON_AddNumberToObject(root, "unix_timestamp", (double)time_sync_get_timestamp());
    }

    // Reset reason
    esp_reset_reason_t reason = esp_reset_reason();
    const char *reason_str;
    switch (reason) {
        case ESP_RST_POWERON:   reason_str = "power_on"; break;
        case ESP_RST_SW:        reason_str = "software"; break;
        case ESP_RST_PANIC:     reason_str = "panic"; break;
        case ESP_RST_INT_WDT:   reason_str = "interrupt_watchdog"; break;
        case ESP_RST_TASK_WDT:  reason_str = "task_watchdog"; break;
        case ESP_RST_WDT:       reason_str = "other_watchdog"; break;
        case ESP_RST_DEEPSLEEP: reason_str = "deep_sleep"; break;
        case ESP_RST_BROWNOUT:  reason_str = "brownout"; break;
        case ESP_RST_SDIO:      reason_str = "sdio"; break;
        default:                reason_str = "unknown"; break;
    }
    cJSON_AddStringToObject(root, "reset_reason", reason_str);

    // Sensor identity
    sen55_identity_t sen_id;
    if (sen55_get_identity(&sen_id)) {
        cJSON *sensor = cJSON_AddObjectToObject(root, "sensor");
        cJSON_AddStringToObject(sensor, "product", sen_id.product_name);
        cJSON_AddStringToObject(sensor, "serial", sen_id.serial_number);
        char fw_str[8];
        snprintf(fw_str, sizeof(fw_str), "%u", sen_id.firmware_version);
        cJSON_AddStringToObject(sensor, "firmware", fw_str);
    }

    // Free heap
    cJSON_AddNumberToObject(root, "free_heap", esp_get_free_heap_size());
    cJSON_AddNumberToObject(root, "min_free_heap", esp_get_minimum_free_heap_size());

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief GET /api/ota - OTA update status
 */
static esp_err_t ota_get_handler(httpd_req_t *req)
{
    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;

    ota_status_t status = ota_get_status();

    // State as string
    const char *state_str = "unknown";
    switch (status.state) {
        case OTA_STATE_IDLE:       state_str = "idle"; break;
        case OTA_STATE_DOWNLOADING: state_str = "downloading"; break;
        case OTA_STATE_VERIFYING:  state_str = "verifying"; break;
        case OTA_STATE_REBOOTING:  state_str = "rebooting"; break;
        case OTA_STATE_FAILED:     state_str = "failed"; break;
    }

    cJSON_AddStringToObject(root, "state", state_str);
    cJSON_AddNumberToObject(root, "progress", status.progress_percent);

    if (status.error_msg[0] != '\0') {
        cJSON_AddStringToObject(root, "error", status.error_msg);
    } else {
        cJSON_AddNullToObject(root, "error");
    }

    cJSON_AddStringToObject(root, "current_version", status.current_version);
    cJSON_AddStringToObject(root, "partition", status.partition);
    cJSON_AddBoolToObject(root, "pending_validation", ota_is_pending_validation());

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief POST /api/ota - Start OTA update
 * Body: {"url": "http://192.168.1.100:8000/firmware.bin"}
 */
static esp_err_t ota_post_handler(httpd_req_t *req)
{
    char buf[320];
    int ret = httpd_req_recv(req, buf, sizeof(buf) - 1);
    if (ret <= 0) {
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "No body");
        return ESP_FAIL;
    }
    buf[ret] = '\0';

    cJSON *json = cJSON_Parse(buf);
    if (json == NULL) {
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Invalid JSON");
        return ESP_FAIL;
    }

    cJSON *url_item = cJSON_GetObjectItem(json, "url");
    if (!cJSON_IsString(url_item) || url_item->valuestring == NULL) {
        cJSON_Delete(json);
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Missing 'url' field");
        return ESP_FAIL;
    }

    const char *url = url_item->valuestring;
    ESP_LOGI(TAG, "OTA update requested: %s", url);

    esp_err_t err = ota_start_update(url);
    cJSON_Delete(json);

    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;

    if (err == ESP_OK) {
        cJSON_AddBoolToObject(root, "success", true);
        cJSON_AddStringToObject(root, "status", "started");
    } else if (err == ESP_ERR_INVALID_STATE) {
        cJSON_AddBoolToObject(root, "success", false);
        cJSON_AddStringToObject(root, "error", "OTA already in progress");
    } else {
        cJSON_AddBoolToObject(root, "success", false);
        cJSON_AddStringToObject(root, "error", esp_err_to_name(err));
    }

    esp_err_t send_ret = send_json_response(req, root);
    cJSON_Delete(root);
    return send_ret;
}

// =============================================================================
// Binary History Endpoint
// =============================================================================

/**
 * Binary wire format header (32 bytes, packed):
 *   [4] magic: 0x48425F31 ("HB_1")
 *   [4] flags: bit 0 = incremental response
 *   [8] server_timestamp (uint64_t)
 *   [2] sample_size (sizeof(history_sample_t))
 *   [2] tier_count (6)
 *  [12] tier_sample_counts: uint16_t[6]
 */
typedef struct __attribute__((packed)) {
    uint32_t magic;
    uint32_t flags;
    uint64_t server_timestamp;
    uint16_t sample_size;
    uint16_t tier_count;
    uint16_t tier_sample_counts[TIER_COUNT];
} history_binary_header_t;

/**
 * @brief GET /api/history/all - All tier data as binary
 *
 * Returns raw struct bytes for all tiers in a single response.
 * Supports ?since=<timestamp> for incremental updates.
 */
static esp_err_t history_binary_handler(httpd_req_t *req)
{
    add_cors_headers(req);
    httpd_resp_set_type(req, "application/octet-stream");

    // Parse since query param
    char query[64] = {0};
    httpd_req_get_url_query_str(req, query, sizeof(query));
    uint64_t since_ts = 0;
    char param[24];
    if (httpd_query_key_value(query, "since", param, sizeof(param)) == ESP_OK) {
        since_ts = (uint64_t)strtoull(param, NULL, 10);
    }

    // Determine samples per tier
    uint16_t tier_counts[TIER_COUNT];
    uint32_t tier_start[TIER_COUNT];

    for (int t = 0; t < TIER_COUNT; t++) {
        uint32_t total = history_get_count((history_tier_t)t);
        uint32_t start = history_get_samples_since((history_tier_t)t, since_ts);
        if (start > total) start = total;
        uint32_t output = total - start;
        tier_counts[t] = (output > UINT16_MAX) ? UINT16_MAX : (uint16_t)output;
        tier_start[t] = start;
    }

    // Build and send header
    history_binary_header_t header = {
        .magic = 0x48425F31,
        .flags = (since_ts > 0) ? 1 : 0,
        .server_timestamp = history_get_timestamp(),
        .sample_size = (uint16_t)sizeof(history_sample_t),
        .tier_count = TIER_COUNT,
    };
    for (int t = 0; t < TIER_COUNT; t++) {
        header.tier_sample_counts[t] = tier_counts[t];
    }

    esp_err_t ret = httpd_resp_send_chunk(req, (const char *)&header, sizeof(header));
    if (ret != ESP_OK) return ret;

    // Send tier data in batches
    const uint32_t batch_size = 50;
    history_sample_t *batch = malloc(batch_size * sizeof(history_sample_t));
    if (batch == NULL) {
        httpd_resp_send_chunk(req, NULL, 0);
        return ESP_ERR_NO_MEM;
    }

    for (int t = 0; t < TIER_COUNT; t++) {
        uint32_t remaining = tier_counts[t];
        uint32_t offset = tier_start[t];

        while (remaining > 0) {
            uint32_t to_read = (remaining < batch_size) ? remaining : batch_size;
            uint32_t count = 0;
            esp_err_t err = history_get_samples((history_tier_t)t, batch, to_read, offset, &count);
            if (err != ESP_OK || count == 0) break;

            ret = httpd_resp_send_chunk(req, (const char *)batch,
                                        count * sizeof(history_sample_t));
            if (ret != ESP_OK) {
                free(batch);
                return ret;
            }

            offset += count;
            remaining -= count;
        }
    }

    free(batch);
    httpd_resp_send_chunk(req, NULL, 0);
    return ESP_OK;
}

/**
 * @brief POST /api/history/reset - Factory reset: clear history, NVS state, reboot
 */
static esp_err_t history_reset_handler(httpd_req_t *req)
{
    ESP_LOGW(TAG, "Factory reset requested");

    // Clear history (RAM + flash)
    history_clear();
    esp_err_t hist_err = history_save();

    // Clear SEN55 NVS state (VOC state, warm start, temp offset, last clean)
    esp_err_t nvs_err = sen55_clear_nvs();

    // Send response before rebooting
    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;
    bool success = (hist_err == ESP_OK && nvs_err == ESP_OK);
    cJSON_AddBoolToObject(root, "success", success);
    if (success) {
        cJSON_AddStringToObject(root, "message", "Factory reset complete, rebooting");
    } else {
        cJSON_AddStringToObject(root, "message", "Reset completed with warnings, rebooting");
        if (hist_err != ESP_OK) {
            cJSON_AddStringToObject(root, "history_error", esp_err_to_name(hist_err));
        }
        if (nvs_err != ESP_OK) {
            cJSON_AddStringToObject(root, "nvs_error", esp_err_to_name(nvs_err));
        }
    }

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);

    // Reboot after short delay so the response reaches the client
    ESP_LOGW(TAG, "Rebooting in 500ms...");
    vTaskDelay(pdMS_TO_TICKS(500));
    esp_restart();

    return ret;  // Unreachable, but keeps the compiler happy
}

/**
 * @brief POST /api/history/save - Save history to flash
 */
static esp_err_t history_save_handler(httpd_req_t *req)
{
    ESP_LOGI(TAG, "Manual history save requested");

    esp_err_t err = history_save();

    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;
    if (err == ESP_OK) {
        cJSON_AddBoolToObject(root, "success", true);
        cJSON_AddStringToObject(root, "message", "History saved to flash");
    } else {
        cJSON_AddBoolToObject(root, "success", false);
        cJSON_AddStringToObject(root, "error", esp_err_to_name(err));
    }

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

// =============================================================================
// Core Dump
// =============================================================================

/**
 * @brief GET /api/coredump - Get core dump summary if one exists
 */
static esp_err_t coredump_get_handler(httpd_req_t *req)
{
    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;

#if CONFIG_ESP_COREDUMP_ENABLE_TO_FLASH && CONFIG_ESP_COREDUMP_DATA_FORMAT_ELF
    esp_err_t err = esp_core_dump_image_check();
    if (err != ESP_OK) {
        cJSON_AddBoolToObject(root, "present", false);
        goto send;
    }

    cJSON_AddBoolToObject(root, "present", true);

    // Get size
    size_t addr, size;
    if (esp_core_dump_image_get(&addr, &size) == ESP_OK) {
        cJSON_AddNumberToObject(root, "size", size);
    }

    // Get panic reason
    char panic_reason[200];
    if (esp_core_dump_get_panic_reason(panic_reason, sizeof(panic_reason)) == ESP_OK) {
        cJSON_AddStringToObject(root, "panic_reason", panic_reason);
    }

    // Get summary
    esp_core_dump_summary_t *summary = malloc(sizeof(esp_core_dump_summary_t));
    if (summary == NULL) {
        cJSON_AddStringToObject(root, "error", "Out of memory for summary");
        goto send;
    }

    if (esp_core_dump_get_summary(summary) == ESP_OK) {
        cJSON_AddStringToObject(root, "task", summary->exc_task);
        char pc_str[12];
        snprintf(pc_str, sizeof(pc_str), "0x%08lx", (unsigned long)summary->exc_pc);
        cJSON_AddStringToObject(root, "pc", pc_str);

        // Exception info (Xtensa)
        char cause_str[12];
        snprintf(cause_str, sizeof(cause_str), "0x%08lx", (unsigned long)summary->ex_info.exc_cause);
        cJSON_AddStringToObject(root, "exc_cause", cause_str);

        // Backtrace
        cJSON *bt = cJSON_CreateArray();
        for (uint32_t i = 0; i < summary->exc_bt_info.depth && i < 16; i++) {
            char addr_str[12];
            snprintf(addr_str, sizeof(addr_str), "0x%08lx", (unsigned long)summary->exc_bt_info.bt[i]);
            cJSON_AddItemToArray(bt, cJSON_CreateString(addr_str));
        }
        cJSON_AddItemToObject(root, "backtrace", bt);
        cJSON_AddBoolToObject(root, "backtrace_corrupted", summary->exc_bt_info.corrupted);

        // ELF SHA256 for matching with the build
        cJSON_AddStringToObject(root, "app_elf_sha256", (const char *)summary->app_elf_sha256);
    }
    free(summary);
#else
    cJSON_AddBoolToObject(root, "present", false);
    cJSON_AddStringToObject(root, "error", "Core dump not enabled");
#endif

send:;
    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief GET /api/coredump/raw - Download raw core dump binary from flash
 *
 * Returns the raw ELF core dump for offline analysis with:
 *   idf.py coredump-info --core /path/to/downloaded.bin
 */
static esp_err_t coredump_raw_handler(httpd_req_t *req)
{
    add_cors_headers(req);

    size_t addr, img_size;
    esp_err_t err = esp_core_dump_image_get(&addr, &img_size);
    if (err != ESP_OK) {
        httpd_resp_send_err(req, HTTPD_404_NOT_FOUND, "No core dump present");
        return ESP_FAIL;
    }

    const esp_partition_t *part = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_COREDUMP, NULL);
    if (part == NULL) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Coredump partition not found");
        return ESP_FAIL;
    }

    httpd_resp_set_type(req, "application/octet-stream");
    httpd_resp_set_hdr(req, "Content-Disposition", "attachment; filename=\"coredump.bin\"");

    const size_t chunk_size = 1024;
    char *buf = malloc(chunk_size);
    if (buf == NULL) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Out of memory");
        return ESP_FAIL;
    }

    size_t offset = 0;
    while (offset < img_size) {
        size_t to_read = (img_size - offset < chunk_size) ? (img_size - offset) : chunk_size;
        err = esp_partition_read(part, offset, buf, to_read);
        if (err != ESP_OK) {
            free(buf);
            return ESP_FAIL;
        }
        esp_err_t ret = httpd_resp_send_chunk(req, buf, to_read);
        if (ret != ESP_OK) {
            free(buf);
            return ret;
        }
        offset += to_read;
    }

    free(buf);
    httpd_resp_send_chunk(req, NULL, 0);
    return ESP_OK;
}

/**
 * @brief POST /api/coredump/clear - Erase core dump from flash
 */
static esp_err_t coredump_clear_handler(httpd_req_t *req)
{
    esp_err_t err = esp_core_dump_image_erase();

    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;
    cJSON_AddBoolToObject(root, "success", err == ESP_OK);
    if (err != ESP_OK) {
        cJSON_AddStringToObject(root, "error", esp_err_to_name(err));
    }

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief POST /api/sensor/clean - Trigger sensor fan cleaning
 */
static esp_err_t sensor_clean_handler(httpd_req_t *req)
{
    ESP_LOGI(TAG, "Sensor fan cleaning requested via API");

    esp_err_t err = sen55_start_fan_cleaning();

    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;
    if (err == ESP_OK) {
        cJSON_AddBoolToObject(root, "success", true);
        cJSON_AddStringToObject(root, "message", "Fan cleaning started");
    } else {
        cJSON_AddBoolToObject(root, "success", false);
        cJSON_AddStringToObject(root, "error", esp_err_to_name(err));
    }

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief GET /api/sensor/temp-offset - Get temperature compensation offset
 */
static esp_err_t temp_offset_get_handler(httpd_req_t *req)
{
    int16_t offset_scaled = 0;
    sen55_get_temp_offset(&offset_scaled);

    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;
    cJSON_AddNumberToObject(root, "offset", offset_scaled / 200.0);
    cJSON_AddNumberToObject(root, "offset_raw", offset_scaled);

    esp_err_t ret = send_json_response(req, root);
    cJSON_Delete(root);
    return ret;
}

/**
 * @brief POST /api/sensor/temp-offset - Set temperature compensation offset
 * Body: {"offset": -2.0}  (in degrees C)
 */
static esp_err_t temp_offset_post_handler(httpd_req_t *req)
{
    char buf[64];
    int ret = httpd_req_recv(req, buf, sizeof(buf) - 1);
    if (ret <= 0) {
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "No body");
        return ESP_FAIL;
    }
    buf[ret] = '\0';

    cJSON *json = cJSON_Parse(buf);
    if (json == NULL) {
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Invalid JSON");
        return ESP_FAIL;
    }

    cJSON *offset_item = cJSON_GetObjectItem(json, "offset");
    if (!cJSON_IsNumber(offset_item)) {
        cJSON_Delete(json);
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Missing 'offset' field (degrees C)");
        return ESP_FAIL;
    }

    double offset_c = offset_item->valuedouble;
    cJSON_Delete(json);

    // Sanity check: offset should be small
    if (offset_c < -10.0 || offset_c > 10.0) {
        send_error_with_cors(req, HTTPD_400_BAD_REQUEST, "Offset must be between -10.0 and 10.0 C");
        return ESP_FAIL;
    }

    int16_t offset_scaled = (int16_t)(offset_c * 200.0);
    ESP_LOGI(TAG, "Setting temp offset: %.2f C (raw: %d)", offset_c, offset_scaled);

    esp_err_t err = sen55_set_temp_offset(offset_scaled);

    cJSON *root = create_json_or_500(req);
    if (root == NULL) return ESP_FAIL;
    if (err == ESP_OK) {
        cJSON_AddBoolToObject(root, "success", true);
        cJSON_AddNumberToObject(root, "offset", offset_scaled / 200.0);
    } else {
        cJSON_AddBoolToObject(root, "success", false);
        cJSON_AddStringToObject(root, "error", esp_err_to_name(err));
    }

    esp_err_t send_ret = send_json_response(req, root);
    cJSON_Delete(root);
    return send_ret;
}

// =============================================================================
// Server Setup
// =============================================================================

esp_err_t api_server_start(void)
{
    if (server != NULL) {
        ESP_LOGW(TAG, "Server already running");
        return ESP_OK;
    }

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.uri_match_fn = httpd_uri_match_wildcard;
    config.max_uri_handlers = 20;
    config.max_open_sockets = 8;    // default is 4, dashboard fires 8 concurrent requests
    config.stack_size = 8192;
    config.recv_wait_timeout = 10;  // seconds - explicit to survive ESP-IDF default changes
    config.send_wait_timeout = 10;  // seconds - explicit to survive ESP-IDF default changes
    config.lru_purge_enable = true;

    ESP_LOGI(TAG, "Starting HTTP server on port %d", config.server_port);

    esp_err_t ret = httpd_start(&server, &config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start server: %s", esp_err_to_name(ret));
        return ret;
    }

    // Register URI handlers
    httpd_uri_t uris[] = {
        // OPTIONS handlers for CORS preflight
        {.uri = "/api/*", .method = HTTP_OPTIONS, .handler = options_handler},

        // API endpoints
        {.uri = "/api/status", .method = HTTP_GET, .handler = status_handler},
        {.uri = "/api/fan", .method = HTTP_GET, .handler = fan_get_handler},
        {.uri = "/api/fan", .method = HTTP_POST, .handler = fan_post_handler},
        {.uri = "/api/history/save", .method = HTTP_POST, .handler = history_save_handler},
        {.uri = "/api/history/reset", .method = HTTP_POST, .handler = history_reset_handler},
        {.uri = "/api/history/all", .method = HTTP_GET, .handler = history_binary_handler},
        {.uri = "/api/history/*", .method = HTTP_GET, .handler = history_handler},
        {.uri = "/api/health", .method = HTTP_GET, .handler = health_handler},
        {.uri = "/api/info", .method = HTTP_GET, .handler = info_handler},
        {.uri = "/api/ota", .method = HTTP_GET, .handler = ota_get_handler},
        {.uri = "/api/ota", .method = HTTP_POST, .handler = ota_post_handler},
        {.uri = "/api/coredump", .method = HTTP_GET, .handler = coredump_get_handler},
        {.uri = "/api/coredump/raw", .method = HTTP_GET, .handler = coredump_raw_handler},
        {.uri = "/api/coredump/clear", .method = HTTP_POST, .handler = coredump_clear_handler},
        {.uri = "/api/sensor/clean", .method = HTTP_POST, .handler = sensor_clean_handler},
        {.uri = "/api/sensor/temp-offset", .method = HTTP_GET, .handler = temp_offset_get_handler},
        {.uri = "/api/sensor/temp-offset", .method = HTTP_POST, .handler = temp_offset_post_handler},
    };

    for (size_t i = 0; i < sizeof(uris) / sizeof(uris[0]); i++) {
        ret = httpd_register_uri_handler(server, &uris[i]);
        if (ret != ESP_OK) {
            ESP_LOGW(TAG, "Failed to register %s: %s", uris[i].uri, esp_err_to_name(ret));
        }
    }

    ESP_LOGI(TAG, "HTTP server started");
    ESP_LOGI(TAG, "API endpoints:");
    ESP_LOGI(TAG, "  GET  /api/status");
    ESP_LOGI(TAG, "  GET  /api/fan");
    ESP_LOGI(TAG, "  POST /api/fan");
    ESP_LOGI(TAG, "  GET  /api/history/all (binary)");
    ESP_LOGI(TAG, "  GET  /api/history/{tier}?format=csv");
    ESP_LOGI(TAG, "  POST /api/history/save");
    ESP_LOGI(TAG, "  POST /api/history/reset");
    ESP_LOGI(TAG, "  GET  /api/health");
    ESP_LOGI(TAG, "  GET  /api/info");
    ESP_LOGI(TAG, "  GET  /api/ota");
    ESP_LOGI(TAG, "  POST /api/ota");
    ESP_LOGI(TAG, "  POST /api/sensor/clean");
    ESP_LOGI(TAG, "  GET  /api/sensor/temp-offset");
    ESP_LOGI(TAG, "  POST /api/sensor/temp-offset");

    return ESP_OK;
}

esp_err_t api_server_stop(void)
{
    if (server == NULL) {
        return ESP_OK;
    }

    esp_err_t ret = httpd_stop(server);
    server = NULL;
    ESP_LOGI(TAG, "HTTP server stopped");
    return ret;
}
