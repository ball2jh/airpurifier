/**
 * @file sen55.h
 * @brief Sensirion SEN55 Environmental Sensor Driver
 *
 * Features:
 * - PM1.0, PM2.5, PM4.0, PM10 particulate matter
 * - Temperature and relative humidity
 * - VOC and NOx index
 * - I2C communication with CRC-8 validation
 * - Robust error handling with retry logic and bus recovery
 */

#ifndef SEN55_H
#define SEN55_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

/**
 * @brief SEN55 measurement data structure
 */
typedef struct {
    float pm1_0;        // PM1.0 [µg/m³]
    float pm2_5;        // PM2.5 [µg/m³]
    float pm4_0;        // PM4.0 [µg/m³]
    float pm10;         // PM10 [µg/m³]
    float humidity;     // Relative humidity [%RH]
    float temperature;  // Temperature [°C]
    int16_t voc_index;  // VOC index (1-500, 100 = normal)
    int16_t nox_index;  // NOx index (1-500, 1 = normal)
} sen55_data_t;

/**
 * @brief Last CRC error details for debugging
 */
typedef struct {
    uint32_t read_number;           // Which read attempt this occurred on
    uint8_t word_index;             // Which word failed (0-7)
    uint8_t data[2];                // The two data bytes received
    uint8_t recv_crc;               // CRC byte received from sensor
    uint8_t calc_crc;               // CRC we calculated
} sen55_crc_error_t;

/**
 * @brief 0xFFFF "sensor busy" event tracking
 *
 * The sensor occasionally returns all-0xFF when briefly busy during
 * its internal measurement cycle. This is normal (~1-2% of reads)
 * and documented in the Sensirion datasheet as "value unknown".
 */
typedef struct {
    uint32_t count;                 // How many times this has occurred
    uint32_t last_read_number;      // Read number when last occurred
    int64_t last_uptime_ms;         // Uptime in ms when last occurred
} sen55_busy_diag_t;

/**
 * @brief SEN55 health status structure
 */
typedef struct {
    uint32_t total_reads;           // Total read attempts
    uint32_t successful_reads;      // Successful reads
    uint32_t crc_errors;            // CRC validation failures
    uint32_t i2c_errors;            // I2C communication errors
    uint32_t bus_recoveries;        // Bus recovery attempts
    uint32_t reinit_count;          // Full re-initialization count
    bool is_healthy;                // Current health status
    sen55_crc_error_t last_crc_error; // Details of last CRC error
    sen55_busy_diag_t busy_events;  // Sensor busy (0xFFFF) tracking
} sen55_health_t;

/**
 * @brief Initialize the SEN55 sensor
 *
 * Sets up I2C communication and starts measurement mode.
 * Sensor needs ~1 second warmup before first valid reading.
 *
 * @return ESP_OK on success
 */
esp_err_t sen55_init(void);

/**
 * @brief Read all measurements from the sensor
 *
 * Includes automatic retry logic and bus recovery on failure.
 *
 * @param data Pointer to structure to receive measurement data
 * @return ESP_OK on success, error code on persistent failure
 */
esp_err_t sen55_read(sen55_data_t *data);

/**
 * @brief Check if measurement data is ready
 *
 * @return true if new data is available
 */
bool sen55_data_ready(void);

/**
 * @brief Stop measurement mode (low power)
 *
 * @return ESP_OK on success
 */
esp_err_t sen55_stop(void);

/**
 * @brief Start measurement mode
 *
 * @return ESP_OK on success
 */
esp_err_t sen55_start(void);

/**
 * @brief Attempt to recover the sensor after failures
 *
 * Performs I2C bus recovery and sensor re-initialization.
 * Call this if sen55_read() returns persistent errors.
 *
 * @return ESP_OK if recovery successful
 */
esp_err_t sen55_recover(void);

/**
 * @brief Get the last successful sensor reading without consuming new data
 *
 * Returns the most recent successful reading cached by sen55_read().
 * Safe to call from any context (e.g., API handler) without racing
 * the main loop for sensor data.
 *
 * @param data Pointer to structure to receive measurement data
 * @return true if a valid reading is available, false if no reading yet
 */
bool sen55_get_last_reading(sen55_data_t *data);

/**
 * @brief Get sensor health statistics
 *
 * @param health Pointer to structure to receive health data
 */
void sen55_get_health(sen55_health_t *health);

/**
 * @brief Reset health statistics counters
 */
void sen55_reset_health(void);

#endif // SEN55_H
