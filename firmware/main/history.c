/**
 * @file history.c
 * @brief Tiered historical data storage implementation
 *
 * Memory layout (all static, pre-allocated):
 * - Raw:     1800 samples × 36 bytes = 64,800 bytes (~30 min @ 1s)
 * - Fine:    360 samples × 36 bytes  = 12,960 bytes (6 hours @ 1min)
 * - Medium:  144 samples × 36 bytes  =  5,184 bytes (24 hours @ 10min)
 * - Coarse:  168 samples × 36 bytes  =  6,048 bytes (7 days @ 1hr)
 * - Daily:   120 samples × 36 bytes  =  4,320 bytes (30 days @ 6hr)
 * - Archive: 1095 samples × 36 bytes = 39,420 bytes (3 years @ 24hr)
 * - Total:                           = 132,732 bytes (~130 KB)
 */

#include "history.h"
#include <assert.h>
#include "time_sync.h"

_Static_assert(sizeof(history_sample_t) == 36,
               "history_sample_t size changed — update binary decoder and wire format");
#include "esp_log.h"
#include "esp_partition.h"
#include "esp_rom_crc.h"
#include "esp_task_wdt.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include <string.h>

static const char *TAG = "history";

// =============================================================================
// Tier Configuration
// =============================================================================

#define RAW_CAPACITY      1800    // ~30 min at 1s intervals
#define FINE_CAPACITY     360     // 6 hours at 1 min
#define MEDIUM_CAPACITY   144     // 24 hours at 10 min
#define COARSE_CAPACITY   168     // 7 days at 1 hour
#define DAILY_CAPACITY    120     // 30 days at 6 hours
#define ARCHIVE_CAPACITY  1095    // 3 years at 24 hours

// Samples to average when compacting to next tier
#define RAW_TO_FINE_RATIO      60    // 60 × 1s = 1 min
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
#define HISTORY_MUTEX_TIMEOUT pdMS_TO_TICKS(2000)
#define HISTORY_SAVE_MUTEX_TIMEOUT pdMS_TO_TICKS(5000)

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
        .resolution_s = 1,
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
             RAW_CAPACITY * 1.0 / 3600);
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
    stats->uptime_seconds = (uint32_t)(esp_timer_get_time() / 1000000);

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

uint32_t history_get_samples_since(history_tier_t tier, uint32_t since_ts)
{
    if (!initialized || tier >= TIER_COUNT) {
        return 0;
    }

    // since_ts == 0 means "return all samples"
    if (since_ts == 0) {
        return 0;
    }

    if (xSemaphoreTake(history_mutex, HISTORY_MUTEX_TIMEOUT) != pdTRUE) {
        return 0;
    }

    tier_state_t *t = &tiers[tier];
    uint32_t count = t->count;

    if (count == 0) {
        xSemaphoreGive(history_mutex);
        return 0;
    }

    // Backward scan from newest — typical case checks only 2-3 samples
    history_sample_t sample;
    for (int32_t i = (int32_t)count - 1; i >= 0; i--) {
        if (tier_get(tier, (uint32_t)i, &sample)) {
            if (sample.timestamp <= since_ts) {
                xSemaphoreGive(history_mutex);
                return (uint32_t)(i + 1);  // First sample newer than since_ts
            }
        }
    }

    xSemaphoreGive(history_mutex);
    return 0;  // All samples are newer than since_ts
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
// Flash Persistence — A/B Ping-Pong with CRC32
// =============================================================================

#define HISTORY_MAGIC       0x48495354  // "HIST"
#define HISTORY_VERSION     1

#define SLOT_SIZE           (33 * 4096)     // 135168 bytes = 132KB
#define SLOT_A_OFFSET       0
#define SLOT_B_OFFSET       SLOT_SIZE
#define SECTOR_SIZE         4096

typedef struct {
    uint32_t magic;                     // 0x48495354 "HIST"
    uint32_t version;                   // 3
    uint32_t save_seq;                  // Monotonically increasing sequence number
    uint32_t total_samples;
    uint32_t total_compactions;
    uint32_t accumulator_count;
    struct {
        uint32_t head;
        uint32_t count;
        uint32_t compactions;
        uint32_t pushes_since_compact;
    } tier_state[TIER_COUNT];           // 6 × 16 = 96 bytes
    uint32_t accum_crc;                 // CRC32 of accumulator data
    uint32_t tier_crc[TIER_COUNT];      // CRC32 of each tier buffer
    uint32_t header_crc;                // CRC32 of bytes 0..sizeof-4 (must be last)
} history_flash_header_t;

_Static_assert(sizeof(history_flash_header_t) == 152,
               "history_flash_header_t size changed — update flash layout");

_Static_assert(sizeof(history_flash_header_t) + sizeof(fine_accumulator_t) +
               sizeof(raw_buffer) + sizeof(fine_buffer) + sizeof(medium_buffer) +
               sizeof(coarse_buffer) + sizeof(daily_buffer) + sizeof(archive_buffer)
               <= SLOT_SIZE,
               "Save data exceeds slot size");

static uint32_t calc_header_crc(const history_flash_header_t *hdr)
{
    return esp_rom_crc32_le(0, (const uint8_t *)hdr,
                            sizeof(*hdr) - sizeof(uint32_t));
}

static uint32_t calc_data_crc(const void *data, size_t len)
{
    return esp_rom_crc32_le(0, (const uint8_t *)data, len);
}

static bool read_and_validate_slot(const esp_partition_t *part, size_t offset,
                                   history_flash_header_t *out_header)
{
    if (esp_partition_read(part, offset, out_header, sizeof(*out_header)) != ESP_OK) {
        return false;
    }
    if (out_header->magic != HISTORY_MAGIC) return false;
    if (out_header->version != HISTORY_VERSION) return false;
    if (out_header->header_crc != calc_header_crc(out_header)) return false;
    return true;
}

static void clear_buffers(void)
{
    memset(raw_buffer, 0, sizeof(raw_buffer));
    memset(fine_buffer, 0, sizeof(fine_buffer));
    memset(medium_buffer, 0, sizeof(medium_buffer));
    memset(coarse_buffer, 0, sizeof(coarse_buffer));
    memset(daily_buffer, 0, sizeof(daily_buffer));
    memset(archive_buffer, 0, sizeof(archive_buffer));
    memset(&accumulator, 0, sizeof(accumulator));
}

/**
 * @brief Try to restore history data from a specific slot
 *
 * Reads and verifies all data CRCs, validates bounds, then applies state.
 * On failure, buffers may be partially overwritten — caller must clear before retry.
 */
static esp_err_t try_restore_from_slot(const esp_partition_t *part, size_t slot_offset,
                                       const history_flash_header_t *hdr,
                                       const char *slot_name)
{
    size_t offset = slot_offset + sizeof(*hdr);
    esp_err_t ret;

    // Read and verify accumulator
    ret = esp_partition_read(part, offset, &accumulator, sizeof(accumulator));
    if (ret != ESP_OK) return ret;
    if (hdr->accum_crc != calc_data_crc(&accumulator, sizeof(accumulator))) {
        ESP_LOGW(TAG, "Slot %s: accumulator CRC mismatch", slot_name);
        return ESP_ERR_INVALID_CRC;
    }
    offset += sizeof(accumulator);

    // Read and verify each tier buffer
    struct { void *buffer; size_t size; const char *name; } bufs[] = {
        {raw_buffer,     sizeof(raw_buffer),     "raw"},
        {fine_buffer,    sizeof(fine_buffer),     "fine"},
        {medium_buffer,  sizeof(medium_buffer),   "medium"},
        {coarse_buffer,  sizeof(coarse_buffer),   "coarse"},
        {daily_buffer,   sizeof(daily_buffer),    "daily"},
        {archive_buffer, sizeof(archive_buffer),  "archive"},
    };

    for (int i = 0; i < TIER_COUNT; i++) {
        ret = esp_partition_read(part, offset, bufs[i].buffer, bufs[i].size);
        if (ret != ESP_OK) return ret;
        if (hdr->tier_crc[i] != calc_data_crc(bufs[i].buffer, bufs[i].size)) {
            ESP_LOGW(TAG, "Slot %s: %s tier CRC mismatch", slot_name, bufs[i].name);
            return ESP_ERR_INVALID_CRC;
        }
        offset += bufs[i].size;
    }

    // Bounds validation (CRC passed, but values might be out of range)
    for (int i = 0; i < TIER_COUNT; i++) {
        if (hdr->tier_state[i].head >= tiers[i].capacity) {
            ESP_LOGW(TAG, "Slot %s: tier %d head out of bounds (%lu >= %lu)",
                     slot_name, i, hdr->tier_state[i].head, tiers[i].capacity);
            return ESP_ERR_INVALID_SIZE;
        }
        if (hdr->tier_state[i].count > tiers[i].capacity) {
            ESP_LOGW(TAG, "Slot %s: tier %d count out of bounds (%lu > %lu)",
                     slot_name, i, hdr->tier_state[i].count, tiers[i].capacity);
            return ESP_ERR_INVALID_SIZE;
        }
    }
    if (hdr->accumulator_count >= RAW_TO_FINE_RATIO) {
        ESP_LOGW(TAG, "Slot %s: accumulator_count out of bounds (%lu)",
                 slot_name, hdr->accumulator_count);
        return ESP_ERR_INVALID_SIZE;
    }

    // Soft check for pushes_since_compact (warn but don't reject)
    for (int i = 0; i < TIER_COUNT; i++) {
        if (tiers[i].compact_ratio > 0 &&
            hdr->tier_state[i].pushes_since_compact >= tiers[i].compact_ratio) {
            ESP_LOGW(TAG, "Slot %s: tier %d pushes_since_compact=%lu (ratio=%lu)",
                     slot_name, i, hdr->tier_state[i].pushes_since_compact,
                     tiers[i].compact_ratio);
        }
    }

    // Apply validated state to in-memory structs
    total_samples = hdr->total_samples;
    total_compactions = hdr->total_compactions;
    accumulator_count = hdr->accumulator_count;

    for (int i = 0; i < TIER_COUNT; i++) {
        tiers[i].head = hdr->tier_state[i].head;
        tiers[i].count = hdr->tier_state[i].count;
        tiers[i].compactions = hdr->tier_state[i].compactions;
        tiers[i].pushes_since_compact = hdr->tier_state[i].pushes_since_compact;
    }

    return ESP_OK;
}

esp_err_t history_save(void)
{
    if (!initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    if (xSemaphoreTake(history_mutex, HISTORY_SAVE_MUTEX_TIMEOUT) != pdTRUE) {
        ESP_LOGW(TAG, "history_save: mutex timeout");
        return ESP_ERR_TIMEOUT;
    }

    esp_err_t ret = ESP_OK;

    const esp_partition_t *part = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "history");
    if (part == NULL) {
        ESP_LOGE(TAG, "History partition not found");
        ret = ESP_ERR_NOT_FOUND;
        goto save_done;
    }

    // Read both slot headers to determine which slot to write
    history_flash_header_t hdr_a, hdr_b;
    bool valid_a = read_and_validate_slot(part, SLOT_A_OFFSET, &hdr_a);
    bool valid_b = read_and_validate_slot(part, SLOT_B_OFFSET, &hdr_b);

    uint32_t seq_a = valid_a ? hdr_a.save_seq : 0;
    uint32_t seq_b = valid_b ? hdr_b.save_seq : 0;

    // Pick the inactive slot (opposite of higher save_seq)
    size_t target_offset;
    const char *slot_name;
    if (!valid_a && !valid_b) {
        target_offset = SLOT_A_OFFSET;
        slot_name = "A";
    } else if (seq_a >= seq_b) {
        target_offset = SLOT_B_OFFSET;
        slot_name = "B";
    } else {
        target_offset = SLOT_A_OFFSET;
        slot_name = "A";
    }

    uint32_t new_seq = (seq_a > seq_b ? seq_a : seq_b) + 1;

    // Prepare header
    history_flash_header_t header = {
        .magic = HISTORY_MAGIC,
        .version = HISTORY_VERSION,
        .save_seq = new_seq,
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

    // Compute data CRCs
    header.accum_crc = calc_data_crc(&accumulator, sizeof(accumulator));

    struct { void *buffer; size_t size; const char *name; } bufs[] = {
        {raw_buffer,     sizeof(raw_buffer),     "raw"},
        {fine_buffer,    sizeof(fine_buffer),     "fine"},
        {medium_buffer,  sizeof(medium_buffer),   "medium"},
        {coarse_buffer,  sizeof(coarse_buffer),   "coarse"},
        {daily_buffer,   sizeof(daily_buffer),    "daily"},
        {archive_buffer, sizeof(archive_buffer),  "archive"},
    };

    for (int i = 0; i < TIER_COUNT; i++) {
        header.tier_crc[i] = calc_data_crc(bufs[i].buffer, bufs[i].size);
    }

    header.header_crc = calc_header_crc(&header);

    // Sector-by-sector erase of target slot (not full-partition erase)
    ESP_LOGI(TAG, "Saving history to slot %s (seq=%lu)", slot_name, new_seq);
    for (size_t s = 0; s < SLOT_SIZE; s += SECTOR_SIZE) {
        ret = esp_partition_erase_range(part, target_offset + s, SECTOR_SIZE);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Failed to erase sector at 0x%x: %s",
                     (unsigned)(target_offset + s), esp_err_to_name(ret));
            goto save_done;
        }
        esp_task_wdt_reset();
    }

    // Write header + accumulator + tier buffers sequentially
    size_t write_offset = target_offset;
    ret = esp_partition_write(part, write_offset, &header, sizeof(header));
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write header: %s", esp_err_to_name(ret));
        goto save_done;
    }
    write_offset += sizeof(header);

    ret = esp_partition_write(part, write_offset, &accumulator, sizeof(accumulator));
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write accumulator: %s", esp_err_to_name(ret));
        goto save_done;
    }
    write_offset += sizeof(accumulator);

    for (int i = 0; i < TIER_COUNT; i++) {
        ret = esp_partition_write(part, write_offset, bufs[i].buffer, bufs[i].size);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Failed to write %s buffer: %s",
                     bufs[i].name, esp_err_to_name(ret));
            goto save_done;
        }
        write_offset += bufs[i].size;
        esp_task_wdt_reset();
    }

    // Read-back header and verify CRC
    history_flash_header_t verify_hdr;
    ret = esp_partition_read(part, target_offset, &verify_hdr, sizeof(verify_hdr));
    if (ret != ESP_OK || verify_hdr.header_crc != calc_header_crc(&verify_hdr)) {
        ESP_LOGE(TAG, "Header read-back verification failed");
        ret = ESP_ERR_INVALID_CRC;
        goto save_done;
    }

    ESP_LOGI(TAG, "History saved to slot %s, seq=%lu (%lu samples, %zu bytes)",
             slot_name, new_seq, total_samples, write_offset - target_offset);

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

    esp_err_t ret;

    const esp_partition_t *part = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "history");
    if (part == NULL) {
        ESP_LOGW(TAG, "History partition not found");
        ret = ESP_ERR_NOT_FOUND;
        goto restore_done;
    }

    // Read and validate both slot headers
    history_flash_header_t hdr_a, hdr_b;
    bool valid_a = read_and_validate_slot(part, SLOT_A_OFFSET, &hdr_a);
    bool valid_b = read_and_validate_slot(part, SLOT_B_OFFSET, &hdr_b);

    if (!valid_a && !valid_b) {
        ESP_LOGI(TAG, "No valid slots found, starting fresh");
        ret = ESP_ERR_NOT_FOUND;
        goto restore_done;
    }

    // Determine primary (higher seq) and fallback slots
    size_t primary_offset = SLOT_A_OFFSET, fallback_offset = SLOT_B_OFFSET;
    history_flash_header_t *primary_hdr = &hdr_a, *fallback_hdr = &hdr_b;
    const char *primary_name = "A", *fallback_name = "B";
    bool has_fallback = false;

    if (valid_a && valid_b) {
        has_fallback = true;
        if (hdr_b.save_seq > hdr_a.save_seq) {
            primary_offset = SLOT_B_OFFSET;  primary_hdr = &hdr_b;  primary_name = "B";
            fallback_offset = SLOT_A_OFFSET; fallback_hdr = &hdr_a; fallback_name = "A";
        }
    } else if (valid_b) {
        primary_offset = SLOT_B_OFFSET;
        primary_hdr = &hdr_b;
        primary_name = "B";
    }

    // Try primary slot
    ret = try_restore_from_slot(part, primary_offset, primary_hdr, primary_name);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "History restored from slot %s, seq=%lu (%lu samples)",
                 primary_name, primary_hdr->save_seq, total_samples);
        for (int i = 0; i < TIER_COUNT; i++) {
            if (tiers[i].count > 0) {
                ESP_LOGI(TAG, "  Tier %d: %lu samples", i, tiers[i].count);
            }
        }
        goto restore_done;
    }

    ESP_LOGW(TAG, "Slot %s restore failed: %s", primary_name, esp_err_to_name(ret));

    // Try fallback slot
    if (has_fallback) {
        clear_buffers();
        ret = try_restore_from_slot(part, fallback_offset, fallback_hdr, fallback_name);
        if (ret == ESP_OK) {
            ESP_LOGI(TAG, "History restored from fallback slot %s, seq=%lu (%lu samples)",
                     fallback_name, fallback_hdr->save_seq, total_samples);
            for (int i = 0; i < TIER_COUNT; i++) {
                if (tiers[i].count > 0) {
                    ESP_LOGI(TAG, "  Tier %d: %lu samples", i, tiers[i].count);
                }
            }
            goto restore_done;
        }
        ESP_LOGW(TAG, "Fallback slot %s also failed: %s",
                 fallback_name, esp_err_to_name(ret));
    }

    // Both slots failed — clear and start fresh
    clear_buffers();
    ret = ESP_ERR_NOT_FOUND;

restore_done:
    xSemaphoreGive(history_mutex);
    return ret;
}
