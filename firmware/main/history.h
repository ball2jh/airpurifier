/**
 * @file history.h
 * @brief Tiered historical data storage with automatic compaction
 *
 * Stores sensor and fan data in a tiered ring buffer system:
 * - Recent data kept at full resolution
 * - Older data progressively averaged/compacted
 * - All memory pre-allocated at startup (no runtime malloc)
 *
 * Tier structure:
 * - Raw:     2 sec resolution,  ~1 hour
 * - Fine:    1 min resolution,  6 hours
 * - Medium:  10 min resolution, 24 hours
 * - Coarse:  1 hour resolution, 7 days
 * - Daily:   6 hour resolution, 30 days
 * - Archive: 24 hour resolution, 3 years
 */

#ifndef HISTORY_H
#define HISTORY_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

/**
 * @brief Single data sample (36 bytes)
 */
typedef struct {
    uint32_t timestamp;     // Unix timestamp (seconds since boot or epoch)
    float pm1_0;            // PM1.0 [µg/m³]
    float pm2_5;            // PM2.5 [µg/m³]
    float pm4_0;            // PM4.0 [µg/m³]
    float pm10;             // PM10 [µg/m³]
    float humidity;         // Relative humidity [%RH]
    float temperature;      // Temperature [°C]
    int16_t voc_index;      // VOC index
    int16_t nox_index;      // NOx index
    uint16_t fan_rpm;       // Fan RPM (max 65535)
    uint8_t fan_speed;      // Fan speed percent (0-100)
    uint8_t _reserved;      // Padding for alignment
} history_sample_t;

/**
 * @brief Tier identifiers
 */
typedef enum {
    TIER_RAW = 0,       // 2 second samples
    TIER_FINE,          // 1 minute averages
    TIER_MEDIUM,        // 10 minute averages
    TIER_COARSE,        // 1 hour averages
    TIER_DAILY,         // 6 hour averages
    TIER_ARCHIVE,       // 24 hour averages
    TIER_COUNT
} history_tier_t;

/**
 * @brief Tier statistics
 */
typedef struct {
    uint32_t capacity;      // Max samples in tier
    uint32_t count;         // Current sample count
    uint32_t resolution_s;  // Seconds per sample
    uint32_t compactions;   // Times this tier has compacted
} history_tier_stats_t;

/**
 * @brief Overall history statistics
 */
typedef struct {
    uint32_t total_samples_recorded;
    uint32_t total_compactions;
    uint32_t memory_used_bytes;
    uint32_t uptime_seconds;
    history_tier_stats_t tiers[TIER_COUNT];
} history_stats_t;

/**
 * @brief Initialize the history system
 *
 * Pre-allocates all buffers. Call once at startup.
 * Automatically restores saved history from flash if available.
 *
 * @return ESP_OK on success
 */
esp_err_t history_init(void);

/**
 * @brief Get current timestamp for history records
 *
 * Returns Unix timestamp if NTP is synced, otherwise seconds since boot.
 *
 * @return Timestamp in seconds
 */
uint32_t history_get_timestamp(void);

/**
 * @brief Record a new sample
 *
 * Adds sample to raw tier. Automatically compacts older
 * data when tiers fill up.
 *
 * @param sample Pointer to sample data to record
 * @return ESP_OK on success
 */
esp_err_t history_record(const history_sample_t *sample);

/**
 * @brief Get samples from a specific tier
 *
 * @param tier Which tier to read from
 * @param samples Output buffer for samples
 * @param max_samples Size of output buffer
 * @param start_index Starting index (0 = oldest)
 * @param count Output: number of samples returned
 * @return ESP_OK on success
 */
esp_err_t history_get_samples(history_tier_t tier,
                               history_sample_t *samples,
                               uint32_t max_samples,
                               uint32_t start_index,
                               uint32_t *count);

/**
 * @brief Get the most recent sample from a tier
 *
 * @param tier Which tier to read from
 * @param sample Output sample
 * @return ESP_OK on success, ESP_ERR_NOT_FOUND if tier empty
 */
esp_err_t history_get_latest(history_tier_t tier, history_sample_t *sample);

/**
 * @brief Get number of samples in a tier
 *
 * @param tier Which tier to query
 * @return Number of samples currently stored
 */
uint32_t history_get_count(history_tier_t tier);

/**
 * @brief Get history statistics
 *
 * @param stats Output structure for statistics
 */
void history_get_stats(history_stats_t *stats);

/**
 * @brief Get start index of samples newer than a timestamp
 *
 * Useful for incremental updates. Backward scan from newest sample
 * makes this efficient when only a few new samples exist (typical case).
 *
 * @param tier Which tier to query
 * @param since_ts Timestamp threshold (returns samples with ts > since_ts)
 * @return Start index of first sample newer than since_ts (0 = all samples)
 */
uint32_t history_get_samples_since(history_tier_t tier, uint32_t since_ts);

/**
 * @brief Clear all history data
 */
void history_clear(void);

/**
 * @brief Save history to flash partition
 *
 * Call before OTA update or controlled shutdown to preserve data.
 *
 * @return ESP_OK on success
 */
esp_err_t history_save(void);

/**
 * @brief Restore history from flash partition
 *
 * Called automatically by history_init() if valid data exists.
 *
 * @return ESP_OK on success, ESP_ERR_NOT_FOUND if no valid data
 */
esp_err_t history_restore(void);

#endif // HISTORY_H
