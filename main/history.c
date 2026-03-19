/**
 * @file history.c
 * @brief Tiered historical data storage implementation
 *
 * Memory layout (all static, pre-allocated):
 * - Raw:     1800 samples × 40 bytes = 72,000 bytes (~1 hour @ 2s)
 * - Fine:    360 samples × 40 bytes  = 14,400 bytes (6 hours @ 1min)
 * - Medium:  144 samples × 40 bytes  =  5,760 bytes (24 hours @ 10min)
 * - Coarse:  168 samples × 40 bytes  =  6,720 bytes (7 days @ 1hr)
 * - Daily:   120 samples × 40 bytes  =  4,800 bytes (30 days @ 6hr)
 * - Archive: 1095 samples × 40 bytes = 43,800 bytes (3 years @ 24hr)
 * - Total:                           = 147,480 bytes (~144 KB)
 */

#include "history.h"
#include "time_sync.h"
#include "esp_log.h"
#include "esp_partition.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include <string.h>

static const char *TAG = "history";

// =============================================================================
// Tier Configuration
// =============================================================================

#define RAW_CAPACITY      1800    // ~1 hour at 2s intervals
#define FINE_CAPACITY     360     // 6 hours at 1 min
#define MEDIUM_CAPACITY   144     // 24 hours at 10 min
#define COARSE_CAPACITY   168     // 7 days at 1 hour
#define DAILY_CAPACITY    120     // 30 days at 6 hours
#define ARCHIVE_CAPACITY  1095    // 3 years at 24 hours

// Samples to average when compacting to next tier
#define RAW_TO_FINE_RATIO      30    // 30 × 2s = 1 min
#define FINE_TO_MEDIUM_RATIO   10    // 10 × 1min = 10 min
#define MEDIUM_TO_COARSE_RATIO 6     // 6 × 10min = 1 hour
#define COARSE_TO_DAILY_RATIO  6     // 6 × 1hr = 6 hours
#define DAILY_TO_ARCHIVE_RATIO 4     // 4 × 6hr = 24 hours

// =============================================================================
// Static Storage (pre-allocated)
// =============================================================================

static history_sample_t raw_buffer[RAW_CAPACITY];
static history_sample_t fine_buffer[FINE_CAPACITY];
static history_sample_t medium_buffer[MEDIUM_CAPACITY];
static history_sample_t coarse_buffer[COARSE_CAPACITY];
static history_sample_t daily_buffer[DAILY_CAPACITY];
static history_sample_t archive_buffer[ARCHIVE_CAPACITY];

// Ring buffer state for each tier
typedef struct {
    history_sample_t *buffer;
    uint32_t capacity;
    uint32_t head;          // Next write position
    uint32_t count;         // Current number of samples
    uint32_t resolution_s;  // Seconds per sample
    uint32_t compactions;   // Compaction counter
    uint32_t compact_ratio;         // Samples to average for next tier
    uint32_t pushes_since_compact;  // Pushes since last compaction
} tier_state_t;

static tier_state_t tiers[TIER_COUNT];

// Global stats
static uint32_t total_samples = 0;
static uint32_t total_compactions = 0;
static bool initialized = false;

// Thread safety: protects all ring buffer state, accumulators, and stats
static SemaphoreHandle_t history_mutex = NULL;
#define HISTORY_MUTEX_TIMEOUT pdMS_TO_TICKS(100)

// Wide accumulator for averaging raw samples into fine tier
// Uses wider types to prevent overflow (e.g., uint16_t fan_rpm * 30 samples > 65535)
typedef struct {
    uint32_t timestamp;
    float pm1_0, pm2_5, pm4_0, pm10;
    float humidity, temperature;
    int32_t voc_index, nox_index;
    uint32_t fan_rpm, fan_speed;
    uint32_t valid_count;  // Number of valid (non-error) samples accumulated
} fine_accumulator_t;

static fine_accumulator_t accumulator;
static uint32_t accumulator_count = 0;  // Total samples (including invalid)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * @brief Get current timestamp for history records
 *
 * Returns Unix timestamp if NTP is synced, otherwise seconds since boot.
 */
uint32_t history_get_timestamp(void)
{
    return (uint32_t)time_sync_get_timestamp();
}

/**
 * @brief Average multiple samples into one
 */
static void average_samples(const history_sample_t *samples, uint32_t count,
                            history_sample_t *output)
{
    if (count == 0) return;

    // Use first sample's timestamp as the period start
    output->timestamp = samples[0].timestamp;

    // Accumulate sums
    float sum_pm1 = 0, sum_pm25 = 0, sum_pm4 = 0, sum_pm10 = 0;
    float sum_hum = 0, sum_temp = 0;
    int32_t sum_voc = 0, sum_nox = 0;
    uint32_t sum_rpm = 0, sum_speed = 0;
    uint32_t valid_count = 0;

    for (uint32_t i = 0; i < count; i++) {
        const history_sample_t *s = &samples[i];

        // Skip invalid readings (negative values indicate sensor error)
        if (s->pm2_5 >= 0) {
            sum_pm1 += s->pm1_0;
            sum_pm25 += s->pm2_5;
            sum_pm4 += s->pm4_0;
            sum_pm10 += s->pm10;
            sum_hum += s->humidity;
            sum_temp += s->temperature;
            sum_voc += s->voc_index;
            sum_nox += s->nox_index;
            sum_rpm += s->fan_rpm;
            sum_speed += s->fan_speed;
            valid_count++;
        }
    }

    if (valid_count > 0) {
        output->pm1_0 = sum_pm1 / valid_count;
        output->pm2_5 = sum_pm25 / valid_count;
        output->pm4_0 = sum_pm4 / valid_count;
        output->pm10 = sum_pm10 / valid_count;
        output->humidity = sum_hum / valid_count;
        output->temperature = sum_temp / valid_count;
        output->voc_index = (int16_t)(sum_voc / valid_count);
        output->nox_index = (int16_t)(sum_nox / valid_count);
        output->fan_rpm = (uint16_t)(sum_rpm / valid_count);
        output->fan_speed = (uint8_t)(sum_speed / valid_count);
    } else {
        // All samples were invalid
        output->pm1_0 = -1;
        output->pm2_5 = -1;
        output->pm4_0 = -1;
        output->pm10 = -1;
        output->humidity = -1;
        output->temperature = -1;
        output->voc_index = -1;
        output->nox_index = -1;
        output->fan_rpm = 0;
        output->fan_speed = 0;
    }

    output->_reserved = 0;
}

/**
 * @brief Add a sample to a tier's ring buffer
 */
static void tier_push(history_tier_t tier_id, const history_sample_t *sample)
{
    tier_state_t *tier = &tiers[tier_id];

    // Write to head position
    memcpy(&tier->buffer[tier->head], sample, sizeof(history_sample_t));

    // Advance head
    tier->head = (tier->head + 1) % tier->capacity;

    // Update count (cap at capacity for ring buffer)
    if (tier->count < tier->capacity) {
        tier->count++;
    }

    // Track pushes for compaction scheduling
    tier->pushes_since_compact++;
}

/**
 * @brief Get sample at index (0 = oldest)
 */
static bool tier_get(history_tier_t tier_id, uint32_t index, history_sample_t *sample)
{
    tier_state_t *tier = &tiers[tier_id];

    if (index >= tier->count) {
        return false;
    }

    // Calculate actual buffer position
    // If buffer is full, oldest is at head, otherwise oldest is at 0
    uint32_t start;
    if (tier->count == tier->capacity) {
        start = tier->head;  // head points to oldest when full
    } else {
        start = 0;
    }

    uint32_t pos = (start + index) % tier->capacity;
    memcpy(sample, &tier->buffer[pos], sizeof(history_sample_t));
    return true;
}

/**
 * @brief Compact oldest samples from one tier to the next
 */
static void compact_tier(history_tier_t source_tier)
{
    if (source_tier >= TIER_ARCHIVE) {
        return;  // Archive tier doesn't compact further
    }

    tier_state_t *src = &tiers[source_tier];
    history_tier_t dest_tier = source_tier + 1;

    // Get oldest samples to average
    history_sample_t samples[32];  // Max ratio is 30
    uint32_t ratio = src->compact_ratio;

    if (ratio > 32) ratio = 32;
    if (src->count < ratio) return;  // Not enough samples

    // Read oldest samples
    for (uint32_t i = 0; i < ratio; i++) {
        tier_get(source_tier, i, &samples[i]);
    }

    // Average them
    history_sample_t averaged;
    average_samples(samples, ratio, &averaged);

    // Push to next tier
    tier_push(dest_tier, &averaged);

    // "Remove" oldest samples by adjusting the logical start
    // For a ring buffer, we just let them be overwritten
    // But we need to track that we've compacted

    src->compactions++;
    src->pushes_since_compact = 0;
    total_compactions++;

    ESP_LOGD(TAG, "Compacted %lu samples from tier %d to tier %d",
             ratio, source_tier, dest_tier);
}

// =============================================================================
// Public API
// =============================================================================

esp_err_t history_init(void)
{
    if (initialized) {
        ESP_LOGW(TAG, "History already initialized");
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Initializing history storage");

    // Create mutex for thread safety (main task vs HTTP server task)
    if (history_mutex == NULL) {
        history_mutex = xSemaphoreCreateMutex();
        if (history_mutex == NULL) {
            ESP_LOGE(TAG, "Failed to create history mutex");
            return ESP_ERR_NO_MEM;
        }
    }

    // Initialize tier configurations
    tiers[TIER_RAW] = (tier_state_t){
        .buffer = raw_buffer,
        .capacity = RAW_CAPACITY,
        .resolution_s = 2,
        .compact_ratio = RAW_TO_FINE_RATIO
    };

    tiers[TIER_FINE] = (tier_state_t){
        .buffer = fine_buffer,
        .capacity = FINE_CAPACITY,
        .resolution_s = 60,
        .compact_ratio = FINE_TO_MEDIUM_RATIO
    };

    tiers[TIER_MEDIUM] = (tier_state_t){
        .buffer = medium_buffer,
        .capacity = MEDIUM_CAPACITY,
        .resolution_s = 600,
        .compact_ratio = MEDIUM_TO_COARSE_RATIO
    };

    tiers[TIER_COARSE] = (tier_state_t){
        .buffer = coarse_buffer,
        .capacity = COARSE_CAPACITY,
        .resolution_s = 3600,
        .compact_ratio = COARSE_TO_DAILY_RATIO
    };

    tiers[TIER_DAILY] = (tier_state_t){
        .buffer = daily_buffer,
        .capacity = DAILY_CAPACITY,
        .resolution_s = 21600,
        .compact_ratio = DAILY_TO_ARCHIVE_RATIO
    };

    tiers[TIER_ARCHIVE] = (tier_state_t){
        .buffer = archive_buffer,
        .capacity = ARCHIVE_CAPACITY,
        .resolution_s = 86400,
        .compact_ratio = 0  // Archive doesn't compact
    };

    // Clear all buffers
    memset(raw_buffer, 0, sizeof(raw_buffer));
    memset(fine_buffer, 0, sizeof(fine_buffer));
    memset(medium_buffer, 0, sizeof(medium_buffer));
    memset(coarse_buffer, 0, sizeof(coarse_buffer));
    memset(daily_buffer, 0, sizeof(daily_buffer));
    memset(archive_buffer, 0, sizeof(archive_buffer));

    // Reset state
    for (int i = 0; i < TIER_COUNT; i++) {
        tiers[i].head = 0;
        tiers[i].count = 0;
        tiers[i].compactions = 0;
        tiers[i].pushes_since_compact = 0;
    }

    total_samples = 0;
    total_compactions = 0;
    accumulator_count = 0;
    memset(&accumulator, 0, sizeof(accumulator));

    initialized = true;

    // Try to restore saved history from flash
    esp_err_t restore_ret = history_restore();
    if (restore_ret == ESP_OK) {
        ESP_LOGI(TAG, "History restored from flash");
    } else if (restore_ret == ESP_ERR_NOT_FOUND) {
        ESP_LOGI(TAG, "No saved history found, starting fresh");
    } else {
        ESP_LOGW(TAG, "Failed to restore history: %s", esp_err_to_name(restore_ret));
    }

    uint32_t total_bytes = sizeof(raw_buffer) + sizeof(fine_buffer) +
                           sizeof(medium_buffer) + sizeof(coarse_buffer) +
                           sizeof(daily_buffer) + sizeof(archive_buffer);

    ESP_LOGI(TAG, "History initialized: %lu bytes allocated", total_bytes);
    ESP_LOGI(TAG, "  Raw:     %d samples (%.1f hours)", RAW_CAPACITY,
             RAW_CAPACITY * 2.0 / 3600);
    ESP_LOGI(TAG, "  Fine:    %d samples (%d hours)", FINE_CAPACITY,
             FINE_CAPACITY / 60);
    ESP_LOGI(TAG, "  Medium:  %d samples (%d hours)", MEDIUM_CAPACITY,
             MEDIUM_CAPACITY * 10 / 60);
    ESP_LOGI(TAG, "  Coarse:  %d samples (%d days)", COARSE_CAPACITY,
             COARSE_CAPACITY / 24);
    ESP_LOGI(TAG, "  Daily:   %d samples (%d days)", DAILY_CAPACITY,
             DAILY_CAPACITY * 6 / 24);
    ESP_LOGI(TAG, "  Archive: %d samples (%d days)", ARCHIVE_CAPACITY,
             ARCHIVE_CAPACITY);

    return ESP_OK;
}

esp_err_t history_record(const history_sample_t *sample)
{
    if (!initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    if (sample == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (xSemaphoreTake(history_mutex, HISTORY_MUTEX_TIMEOUT) != pdTRUE) {
        ESP_LOGW(TAG, "history_record: mutex timeout");
        return ESP_ERR_TIMEOUT;
    }

    total_samples++;

    // Always add to raw tier
    tier_push(TIER_RAW, sample);

    // Accumulate for fine tier (using wide types to prevent overflow)
    if (accumulator_count == 0) {
        memset(&accumulator, 0, sizeof(accumulator));
        accumulator.timestamp = sample->timestamp;
    }
    accumulator_count++;

    // Skip invalid sensor readings (negative PM values indicate error)
    if (sample->pm2_5 >= 0) {
        accumulator.pm1_0 += sample->pm1_0;
        accumulator.pm2_5 += sample->pm2_5;
        accumulator.pm4_0 += sample->pm4_0;
        accumulator.pm10 += sample->pm10;
        accumulator.humidity += sample->humidity;
        accumulator.temperature += sample->temperature;
        accumulator.voc_index += sample->voc_index;
        accumulator.nox_index += sample->nox_index;
        accumulator.fan_rpm += sample->fan_rpm;
        accumulator.fan_speed += sample->fan_speed;
        accumulator.valid_count++;
    }

    // When we have enough samples, push averaged to fine tier
    if (accumulator_count >= RAW_TO_FINE_RATIO) {
        history_sample_t averaged;
        if (accumulator.valid_count > 0) {
            averaged = (history_sample_t){
                .timestamp = accumulator.timestamp,
                .pm1_0 = accumulator.pm1_0 / accumulator.valid_count,
                .pm2_5 = accumulator.pm2_5 / accumulator.valid_count,
                .pm4_0 = accumulator.pm4_0 / accumulator.valid_count,
                .pm10 = accumulator.pm10 / accumulator.valid_count,
                .humidity = accumulator.humidity / accumulator.valid_count,
                .temperature = accumulator.temperature / accumulator.valid_count,
                .voc_index = (int16_t)(accumulator.voc_index / (int32_t)accumulator.valid_count),
                .nox_index = (int16_t)(accumulator.nox_index / (int32_t)accumulator.valid_count),
                .fan_rpm = (uint16_t)(accumulator.fan_rpm / accumulator.valid_count),
                .fan_speed = (uint8_t)(accumulator.fan_speed / accumulator.valid_count),
            };
        } else {
            // All samples in this window were invalid
            averaged = (history_sample_t){
                .timestamp = accumulator.timestamp,
                .pm1_0 = -1, .pm2_5 = -1, .pm4_0 = -1, .pm10 = -1,
                .humidity = -1, .temperature = -1,
                .voc_index = -1, .nox_index = -1,
                .fan_rpm = 0, .fan_speed = 0,
            };
        }

        tier_push(TIER_FINE, &averaged);
        accumulator_count = 0;
        tiers[TIER_RAW].compactions++;

        // Check if we need to compact fine -> medium
        // Only compact every N pushes (not every push after tier is full)
        if (tiers[TIER_FINE].count >= tiers[TIER_FINE].capacity &&
            tiers[TIER_FINE].pushes_since_compact >= tiers[TIER_FINE].compact_ratio) {
            compact_tier(TIER_FINE);
        }

        // Check if we need to compact medium -> coarse
        if (tiers[TIER_MEDIUM].count >= tiers[TIER_MEDIUM].capacity &&
            tiers[TIER_MEDIUM].pushes_since_compact >= tiers[TIER_MEDIUM].compact_ratio) {
            compact_tier(TIER_MEDIUM);
        }

        // Check if we need to compact coarse -> daily
        if (tiers[TIER_COARSE].count >= tiers[TIER_COARSE].capacity &&
            tiers[TIER_COARSE].pushes_since_compact >= tiers[TIER_COARSE].compact_ratio) {
            compact_tier(TIER_COARSE);
        }

        // Check if we need to compact daily -> archive
        if (tiers[TIER_DAILY].count >= tiers[TIER_DAILY].capacity &&
            tiers[TIER_DAILY].pushes_since_compact >= tiers[TIER_DAILY].compact_ratio) {
            compact_tier(TIER_DAILY);
        }
    }

    xSemaphoreGive(history_mutex);
    return ESP_OK;
}

esp_err_t history_get_samples(history_tier_t tier,
                               history_sample_t *samples,
                               uint32_t max_samples,
                               uint32_t start_index,
                               uint32_t *count)
{
    if (!initialized || tier >= TIER_COUNT || samples == NULL || count == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (xSemaphoreTake(history_mutex, HISTORY_MUTEX_TIMEOUT) != pdTRUE) {
        ESP_LOGW(TAG, "history_get_samples: mutex timeout");
        return ESP_ERR_TIMEOUT;
    }

    tier_state_t *t = &tiers[tier];
    *count = 0;

    if (start_index >= t->count) {
        xSemaphoreGive(history_mutex);
        return ESP_OK;  // No samples at this index
    }

    uint32_t available = t->count - start_index;
    uint32_t to_copy = (available < max_samples) ? available : max_samples;

    for (uint32_t i = 0; i < to_copy; i++) {
        if (!tier_get(tier, start_index + i, &samples[i])) {
            break;
        }
        (*count)++;
    }

    xSemaphoreGive(history_mutex);
    return ESP_OK;
}

esp_err_t history_get_latest(history_tier_t tier, history_sample_t *sample)
{
    if (!initialized || tier >= TIER_COUNT || sample == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (xSemaphoreTake(history_mutex, HISTORY_MUTEX_TIMEOUT) != pdTRUE) {
        ESP_LOGW(TAG, "history_get_latest: mutex timeout");
        return ESP_ERR_TIMEOUT;
    }

    tier_state_t *t = &tiers[tier];

    if (t->count == 0) {
        xSemaphoreGive(history_mutex);
        return ESP_ERR_NOT_FOUND;
    }

    // Latest is at head - 1 (or wrapped)
    uint32_t latest_idx = (t->head == 0) ? t->capacity - 1 : t->head - 1;
    memcpy(sample, &t->buffer[latest_idx], sizeof(history_sample_t));

    xSemaphoreGive(history_mutex);
    return ESP_OK;
}

uint32_t history_get_count(history_tier_t tier)
{
    if (!initialized || tier >= TIER_COUNT) {
        return 0;
    }
    if (xSemaphoreTake(history_mutex, HISTORY_MUTEX_TIMEOUT) != pdTRUE) {
        return 0;
    }
    uint32_t count = tiers[tier].count;
    xSemaphoreGive(history_mutex);
    return count;
}

void history_get_stats(history_stats_t *stats)
{
    if (stats == NULL) return;

    if (xSemaphoreTake(history_mutex, HISTORY_MUTEX_TIMEOUT) != pdTRUE) {
        memset(stats, 0, sizeof(*stats));
        return;
    }

    stats->total_samples_recorded = total_samples;
    stats->total_compactions = total_compactions;
    stats->uptime_seconds = total_samples * 2;  // Approximate

    stats->memory_used_bytes = sizeof(raw_buffer) + sizeof(fine_buffer) +
                               sizeof(medium_buffer) + sizeof(coarse_buffer) +
                               sizeof(daily_buffer) + sizeof(archive_buffer);

    for (int i = 0; i < TIER_COUNT; i++) {
        stats->tiers[i].capacity = tiers[i].capacity;
        stats->tiers[i].count = tiers[i].count;
        stats->tiers[i].resolution_s = tiers[i].resolution_s;
        stats->tiers[i].compactions = tiers[i].compactions;
    }

    xSemaphoreGive(history_mutex);
}

void history_clear(void)
{
    if (!initialized) return;

    if (xSemaphoreTake(history_mutex, HISTORY_MUTEX_TIMEOUT) != pdTRUE) {
        ESP_LOGW(TAG, "history_clear: mutex timeout");
        return;
    }

    for (int i = 0; i < TIER_COUNT; i++) {
        tiers[i].head = 0;
        tiers[i].count = 0;
        tiers[i].compactions = 0;
        tiers[i].pushes_since_compact = 0;
    }

    total_samples = 0;
    total_compactions = 0;
    accumulator_count = 0;
    memset(&accumulator, 0, sizeof(accumulator));

    xSemaphoreGive(history_mutex);
    ESP_LOGI(TAG, "History cleared");
}

// =============================================================================
// Flash Persistence
// =============================================================================

#define HISTORY_MAGIC       0x48495354  // "HIST"
#define HISTORY_VERSION     2

// Header stored at start of partition
typedef struct {
    uint32_t magic;
    uint32_t version;
    uint32_t total_samples;
    uint32_t total_compactions;
    uint32_t accumulator_count;
    // Tier state (head, count, compactions for each tier)
    struct {
        uint32_t head;
        uint32_t count;
        uint32_t compactions;
        uint32_t pushes_since_compact;
    } tier_state[TIER_COUNT];
    uint32_t checksum;  // Simple checksum of header
} history_flash_header_t;

static uint32_t calc_checksum(const history_flash_header_t *hdr)
{
    // Simple checksum: sum all fields except checksum itself
    const uint32_t *data = (const uint32_t *)hdr;
    uint32_t sum = 0;
    // Sum all uint32_t fields except the last one (checksum)
    size_t count = (sizeof(history_flash_header_t) - sizeof(uint32_t)) / sizeof(uint32_t);
    for (size_t i = 0; i < count; i++) {
        sum += data[i];
    }
    return sum;
}

esp_err_t history_save(void)
{
    if (!initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    if (xSemaphoreTake(history_mutex, HISTORY_MUTEX_TIMEOUT) != pdTRUE) {
        ESP_LOGW(TAG, "history_save: mutex timeout");
        return ESP_ERR_TIMEOUT;
    }

    esp_err_t ret = ESP_OK;

    // Find the history partition
    const esp_partition_t *part = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "history");
    if (part == NULL) {
        ESP_LOGE(TAG, "History partition not found");
        ret = ESP_ERR_NOT_FOUND;
        goto save_done;
    }

    ESP_LOGI(TAG, "Saving history to flash (%lu bytes partition)", (unsigned long)part->size);

    // Erase partition
    ret = esp_partition_erase_range(part, 0, part->size);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to erase partition: %s", esp_err_to_name(ret));
        goto save_done;
    }

    // Prepare header
    history_flash_header_t header = {
        .magic = HISTORY_MAGIC,
        .version = HISTORY_VERSION,
        .total_samples = total_samples,
        .total_compactions = total_compactions,
        .accumulator_count = accumulator_count,
    };

    for (int i = 0; i < TIER_COUNT; i++) {
        header.tier_state[i].head = tiers[i].head;
        header.tier_state[i].count = tiers[i].count;
        header.tier_state[i].compactions = tiers[i].compactions;
        header.tier_state[i].pushes_since_compact = tiers[i].pushes_since_compact;
    }

    header.checksum = calc_checksum(&header);

    // Write header
    size_t offset = 0;
    ret = esp_partition_write(part, offset, &header, sizeof(header));
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write header: %s", esp_err_to_name(ret));
        goto save_done;
    }
    offset += sizeof(header);

    // Write accumulator
    ret = esp_partition_write(part, offset, &accumulator, sizeof(accumulator));
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write accumulator: %s", esp_err_to_name(ret));
        goto save_done;
    }
    offset += sizeof(accumulator);

    // Write each tier's buffer
    struct {
        void *buffer;
        size_t size;
        const char *name;
    } buffers[] = {
        {raw_buffer, sizeof(raw_buffer), "raw"},
        {fine_buffer, sizeof(fine_buffer), "fine"},
        {medium_buffer, sizeof(medium_buffer), "medium"},
        {coarse_buffer, sizeof(coarse_buffer), "coarse"},
        {daily_buffer, sizeof(daily_buffer), "daily"},
        {archive_buffer, sizeof(archive_buffer), "archive"},
    };

    for (int i = 0; i < TIER_COUNT; i++) {
        ret = esp_partition_write(part, offset, buffers[i].buffer, buffers[i].size);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Failed to write %s buffer: %s", buffers[i].name, esp_err_to_name(ret));
            goto save_done;
        }
        ESP_LOGD(TAG, "Wrote %s: %zu bytes at offset %zu", buffers[i].name, buffers[i].size, offset);
        offset += buffers[i].size;
    }

    ESP_LOGI(TAG, "History saved: %lu samples, %zu bytes written", total_samples, offset);

save_done:
    xSemaphoreGive(history_mutex);
    return ret;
}

esp_err_t history_restore(void)
{
    if (xSemaphoreTake(history_mutex, HISTORY_MUTEX_TIMEOUT) != pdTRUE) {
        ESP_LOGW(TAG, "history_restore: mutex timeout");
        return ESP_ERR_TIMEOUT;
    }

    esp_err_t ret = ESP_OK;

    // Find the history partition
    const esp_partition_t *part = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "history");
    if (part == NULL) {
        ESP_LOGW(TAG, "History partition not found");
        ret = ESP_ERR_NOT_FOUND;
        goto restore_done;
    }

    // Read header
    history_flash_header_t header;
    ret = esp_partition_read(part, 0, &header, sizeof(header));
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read header: %s", esp_err_to_name(ret));
        goto restore_done;
    }

    // Validate magic and version
    if (header.magic != HISTORY_MAGIC) {
        ESP_LOGI(TAG, "No saved history found (magic mismatch)");
        ret = ESP_ERR_NOT_FOUND;
        goto restore_done;
    }

    if (header.version != HISTORY_VERSION) {
        ESP_LOGW(TAG, "History version mismatch (got %lu, expected %d)",
                 header.version, HISTORY_VERSION);
        ret = ESP_ERR_INVALID_VERSION;
        goto restore_done;
    }

    // Validate checksum
    uint32_t expected_checksum = calc_checksum(&header);
    if (header.checksum != expected_checksum) {
        ESP_LOGW(TAG, "History checksum mismatch");
        ret = ESP_ERR_INVALID_CRC;
        goto restore_done;
    }

    ESP_LOGI(TAG, "Restoring history from flash (%lu samples)", header.total_samples);

    // Read accumulator
    size_t offset = sizeof(header);
    ret = esp_partition_read(part, offset, &accumulator, sizeof(accumulator));
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read accumulator: %s", esp_err_to_name(ret));
        goto restore_done;
    }
    offset += sizeof(accumulator);

    // Read each tier's buffer
    struct {
        void *buffer;
        size_t size;
        const char *name;
    } buffers[] = {
        {raw_buffer, sizeof(raw_buffer), "raw"},
        {fine_buffer, sizeof(fine_buffer), "fine"},
        {medium_buffer, sizeof(medium_buffer), "medium"},
        {coarse_buffer, sizeof(coarse_buffer), "coarse"},
        {daily_buffer, sizeof(daily_buffer), "daily"},
        {archive_buffer, sizeof(archive_buffer), "archive"},
    };

    for (int i = 0; i < TIER_COUNT; i++) {
        ret = esp_partition_read(part, offset, buffers[i].buffer, buffers[i].size);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Failed to read %s buffer: %s", buffers[i].name, esp_err_to_name(ret));
            goto restore_done;
        }
        offset += buffers[i].size;
    }

    // Restore state
    total_samples = header.total_samples;
    total_compactions = header.total_compactions;
    accumulator_count = header.accumulator_count;

    for (int i = 0; i < TIER_COUNT; i++) {
        tiers[i].head = header.tier_state[i].head;
        tiers[i].count = header.tier_state[i].count;
        tiers[i].compactions = header.tier_state[i].compactions;
        tiers[i].pushes_since_compact = header.tier_state[i].pushes_since_compact;
    }

    ESP_LOGI(TAG, "History restored: %lu samples", total_samples);
    for (int i = 0; i < TIER_COUNT; i++) {
        if (tiers[i].count > 0) {
            ESP_LOGI(TAG, "  Tier %d: %lu samples", i, tiers[i].count);
        }
    }

restore_done:
    xSemaphoreGive(history_mutex);
    return ret;
}
