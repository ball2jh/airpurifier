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
 * @brief SEN55 PM number concentration and particle size data
 *
 * From command 0x0413. Requires sensor firmware >= 0.7.
 */
typedef struct {
    float nc_pm0_5;       // Number concentration PM0.5 [#/cm³]
    float nc_pm1_0;       // Number concentration PM1.0 [#/cm³]
    float nc_pm2_5;       // Number concentration PM2.5 [#/cm³]
    float nc_pm4_0;       // Number concentration PM4.0 [#/cm³]
    float nc_pm10;        // Number concentration PM10 [#/cm³]
    float typical_size;   // Typical particle size [µm]
    bool valid;           // Whether data was successfully read
} sen55_pm_detail_t;

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
 * @brief SEN55 device status register flags (datasheet Section 5.4)
 */
typedef struct {
    bool fan_speed_warning;    // Bit 21: Fan not running at expected speed
    bool fan_cleaning_active;  // Bit 19: Fan cleaning in progress
    bool gas_sensor_error;     // Bit 7: Gas sensor error
    bool rht_error;            // Bit 6: RHT communication error
    bool laser_failure;        // Bit 5: Laser failure
    bool fan_failure;          // Bit 4: Fan not running
    uint32_t raw;              // Raw 32-bit register value
    bool valid;                // Whether status was successfully read
} sen55_device_status_t;

/**
 * @brief SEN55 sensor identity (read once at init)
 */
typedef struct {
    char product_name[32];  // e.g. "SEN55"
    char serial_number[32]; // Unique serial
    uint8_t firmware_version; // Firmware version (byte 0 of 0xD100 response)
    bool valid;             // Whether identity was successfully read
} sen55_identity_t;

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
    sen55_device_status_t device_status;  // Last device status register reading
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

/**
 * @brief Read the device status register
 *
 * Returns error flags: fan failure, laser failure, gas sensor error, etc.
 * Also updates the device_status field in the health struct.
 *
 * @param status Pointer to structure to receive status flags
 * @return ESP_OK on success
 */
esp_err_t sen55_read_device_status(sen55_device_status_t *status);

/**
 * @brief Trigger manual fan cleaning cycle
 *
 * Fan runs at max speed for ~10 seconds. Readings are stale during cleaning.
 *
 * @return ESP_OK on success
 */
esp_err_t sen55_start_fan_cleaning(void);

/**
 * @brief Check if fan cleaning is needed and trigger if overdue
 *
 * Compares current time against last cleaning time stored in NVS.
 * Triggers cleaning if more than 1 week (604800s) has elapsed.
 *
 * @param current_unix_time Current Unix timestamp (from NTP)
 * @return true if cleaning was triggered
 */
bool sen55_check_fan_cleaning(uint32_t current_unix_time);

/**
 * @brief Save VOC algorithm state to NVS
 *
 * Per datasheet, only meaningful after >= 3 hours of continuous operation.
 * Should be called periodically and before OTA/reboot.
 *
 * @return ESP_OK on success, or ESP_OK (no-op) if uptime < 3 hours
 */
esp_err_t sen55_save_voc_state(void);

/**
 * @brief Get sensor identity (product name, serial, firmware version)
 *
 * Read once during init. Returns cached result.
 *
 * @param identity Pointer to structure to receive identity data
 * @return true if identity is available
 */
bool sen55_get_identity(sen55_identity_t *identity);

/**
 * @brief Set temperature compensation offset and persist to NVS
 *
 * Compensates for ESP32 self-heating bias. Stops measurement, writes
 * offset to sensor, then restarts measurement.
 *
 * Calibration: compare dashboard temp to a reference thermometer at
 * steady state, then POST the difference as a negative offset.
 *
 * @param offset_scaled200 Temperature offset scaled by 200 (e.g., -2.0C = -400)
 * @return ESP_OK on success
 */
esp_err_t sen55_set_temp_offset(int16_t offset_scaled200);

/**
 * @brief Get current temperature compensation offset from NVS
 *
 * @param offset_scaled200 Pointer to receive the offset (scaled by 200)
 * @return ESP_OK on success (returns 0 if no offset configured)
 */
esp_err_t sen55_get_temp_offset(int16_t *offset_scaled200);

/**
 * @brief Read PM number concentrations and typical particle size
 *
 * Uses command 0x0413 which returns mass + number concentrations + particle size.
 * Only the number concentrations and particle size are stored (mass data comes
 * from the regular sen55_read). Safe to call after sen55_read() in the same cycle.
 *
 * @param data Pointer to structure to receive PM detail data
 * @return ESP_OK on success
 */
esp_err_t sen55_read_pm_details(sen55_pm_detail_t *data);

/**
 * @brief Get the last PM detail reading without performing I2C transaction
 *
 * @param data Pointer to structure to receive PM detail data
 * @return true if valid data is available
 */
bool sen55_get_last_pm_details(sen55_pm_detail_t *data);

/**
 * @brief Erase all SEN55 NVS state (VOC state, warm start, temp offset, last clean)
 *
 * Used for factory reset. Wipes the entire "sen55" NVS namespace.
 * Device should be rebooted after calling this.
 *
 * @return ESP_OK on success
 */
esp_err_t sen55_clear_nvs(void);

#endif // SEN55_H
