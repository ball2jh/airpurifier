/**
 * @file sen55.c
 * @brief Sensirion SEN55 Environmental Sensor Driver Implementation
 *
 * Uses ESP-IDF I2C master driver with CRC-8 validation.
 * Includes robust error handling for long-term reliability:
 * - Automatic retry with exponential backoff
 * - I2C bus recovery on communication failures
 * - Sensor re-initialization on persistent errors
 * - Health statistics tracking
 */

#include "sen55.h"
#include "driver/i2c_master.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_check.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "esp_timer.h"
#include <string.h>
#include "nvs.h"

static const char *TAG = "sen55";

// =============================================================================
// Configuration
// =============================================================================

// I2C configuration
#define I2C_PORT            I2C_NUM_0
#define I2C_SDA_GPIO        21
#define I2C_SCL_GPIO        22
#define I2C_FREQ_HZ         100000  // 100kHz max for SEN55
#define I2C_TIMEOUT_MS      100     // I2C transaction timeout
#define SCL_WAIT_US         10000   // Clock stretch timeout (10ms)

// SEN55 I2C address
#define SEN55_ADDR          0x69

// SEN55 commands
#define CMD_START_MEAS      0x0021
#define CMD_STOP_MEAS       0x0104
#define CMD_READ_DATA_READY 0x0202
#define CMD_READ_VALUES     0x03C4
#define CMD_DEVICE_STATUS   0xD206
#define CMD_RESET           0xD304
#define CMD_START_FAN_CLEAN 0x5607
#define CMD_VOC_STATE       0x6181  // Same address for get (read) and set (write)

// CRC-8 polynomial (x^8 + x^5 + x^4 + 1)
#define CRC8_POLYNOMIAL     0x31
#define CRC8_INIT           0xFF

// Retry configuration
#define MAX_RETRIES         3       // Retries before bus recovery
#define RETRY_DELAY_MS      50      // Initial retry delay
#define MAX_CONSECUTIVE_FAILURES 10 // Failures before re-init

// NVS namespace for persistent sensor state
#define NVS_NAMESPACE       "sen55"
#define NVS_KEY_VOC_STATE   "voc_state"
#define NVS_KEY_LAST_CLEAN  "last_clean"

// =============================================================================
// State
// =============================================================================

static i2c_master_bus_handle_t bus_handle = NULL;
static i2c_master_dev_handle_t dev_handle = NULL;
static bool initialized = false;

// Health tracking
static sen55_health_t health = {0};
static portMUX_TYPE health_spinlock = portMUX_INITIALIZER_UNLOCKED;
static uint32_t consecutive_failures = 0;

// Last successful reading cache (for API access without consuming sensor data)
static sen55_data_t last_reading = {0};
static bool has_valid_reading = false;
static SemaphoreHandle_t reading_mutex = NULL;

// =============================================================================
// CRC-8 Calculation
// =============================================================================

/**
 * @brief Calculate CRC-8 checksum for SEN55
 */
static uint8_t calc_crc8(const uint8_t *data, size_t len)
{
    uint8_t crc = CRC8_INIT;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int bit = 0; bit < 8; bit++) {
            if (crc & 0x80) {
                crc = (crc << 1) ^ CRC8_POLYNOMIAL;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

// =============================================================================
// I2C Bus Recovery
// =============================================================================

/**
 * @brief Perform I2C bus recovery by toggling SCL
 *
 * This helps recover from stuck SDA conditions caused by
 * interrupted transactions or sensor glitches.
 */
static esp_err_t i2c_bus_recovery(void)
{
    ESP_LOGW(TAG, "Attempting I2C bus recovery");
    health.bus_recoveries++;

    // First, delete the existing bus to release GPIO control
    if (dev_handle) {
        i2c_master_bus_rm_device(dev_handle);
        dev_handle = NULL;
    }
    if (bus_handle) {
        i2c_del_master_bus(bus_handle);
        bus_handle = NULL;
    }

    // Configure SCL as GPIO output for manual toggling
    gpio_config_t scl_config = {
        .pin_bit_mask = (1ULL << I2C_SCL_GPIO),
        .mode = GPIO_MODE_OUTPUT_OD,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&scl_config);

    // Configure SDA as input to monitor
    gpio_config_t sda_config = {
        .pin_bit_mask = (1ULL << I2C_SDA_GPIO),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&sda_config);

    // Toggle SCL up to 9 times to clock out any stuck transaction
    // A slave holding SDA low will release it after receiving clock pulses
    for (int i = 0; i < 9; i++) {
        gpio_set_level(I2C_SCL_GPIO, 0);
        esp_rom_delay_us(5);
        gpio_set_level(I2C_SCL_GPIO, 1);
        esp_rom_delay_us(5);

        // Check if SDA is released
        if (gpio_get_level(I2C_SDA_GPIO) == 1) {
            ESP_LOGI(TAG, "SDA released after %d clock pulses", i + 1);
            break;
        }
    }

    // Generate STOP condition: SDA low->high while SCL high
    gpio_set_level(I2C_SCL_GPIO, 0);
    esp_rom_delay_us(5);

    // Reconfigure SDA as output for STOP
    sda_config.mode = GPIO_MODE_OUTPUT_OD;
    gpio_config(&sda_config);
    gpio_set_level(I2C_SDA_GPIO, 0);
    esp_rom_delay_us(5);

    gpio_set_level(I2C_SCL_GPIO, 1);
    esp_rom_delay_us(5);
    gpio_set_level(I2C_SDA_GPIO, 1);
    esp_rom_delay_us(5);

    // Reset GPIO to default before re-init
    gpio_reset_pin(I2C_SCL_GPIO);
    gpio_reset_pin(I2C_SDA_GPIO);

    // Small delay before re-initializing
    vTaskDelay(pdMS_TO_TICKS(10));

    return ESP_OK;
}

// =============================================================================
// Low-Level I2C Operations (with retry)
// =============================================================================

/**
 * @brief Send a command to the sensor with retry logic
 */
static esp_err_t sen55_send_cmd_internal(uint16_t cmd)
{
    uint8_t buf[2] = {cmd >> 8, cmd & 0xFF};
    esp_err_t ret;

    for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
        ret = i2c_master_transmit(dev_handle, buf, sizeof(buf), I2C_TIMEOUT_MS);
        if (ret == ESP_OK) {
            return ESP_OK;
        }

        ESP_LOGW(TAG, "Command 0x%04X failed (attempt %d): %s",
                 cmd, attempt + 1, esp_err_to_name(ret));

        if (attempt < MAX_RETRIES - 1) {
            vTaskDelay(pdMS_TO_TICKS(RETRY_DELAY_MS * (attempt + 1)));
        }
    }

    health.i2c_errors++;
    return ret;
}

/**
 * @brief Read data from the sensor with CRC validation and retry logic
 */
static esp_err_t sen55_read_data_internal(uint8_t *data, size_t words)
{
    size_t total_bytes = words * 3;  // Each word: 2 data bytes + 1 CRC
    uint8_t raw[24];  // Max 8 words = 24 bytes

    if (total_bytes > sizeof(raw)) {
        return ESP_ERR_INVALID_SIZE;
    }

    esp_err_t ret;
    bool had_crc_error = false;

    for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
        ret = i2c_master_receive(dev_handle, raw, total_bytes, I2C_TIMEOUT_MS);
        if (ret != ESP_OK) {
            ESP_LOGW(TAG, "Read failed (attempt %d): %s",
                     attempt + 1, esp_err_to_name(ret));

            if (attempt < MAX_RETRIES - 1) {
                vTaskDelay(pdMS_TO_TICKS(RETRY_DELAY_MS * (attempt + 1)));
            }
            continue;
        }

        // Validate CRC for each word
        bool crc_ok = true;
        for (size_t i = 0; i < words; i++) {
            uint8_t *word = &raw[i * 3];
            uint8_t crc = calc_crc8(word, 2);
            if (crc != word[2]) {
                ESP_LOGW(TAG, "CRC error at word %zu (attempt %d): data=[0x%02X,0x%02X] recv_crc=0x%02X calc_crc=0x%02X",
                         i, attempt + 1, word[0], word[1], word[2], crc);
                // Store error details for debugging via API
                health.last_crc_error.read_number = health.total_reads;
                health.last_crc_error.word_index = (uint8_t)i;
                health.last_crc_error.data[0] = word[0];
                health.last_crc_error.data[1] = word[1];
                health.last_crc_error.recv_crc = word[2];
                health.last_crc_error.calc_crc = crc;
                crc_ok = false;
                had_crc_error = true;
                break;
            }
            data[i * 2] = word[0];
            data[i * 2 + 1] = word[1];
        }

        if (crc_ok) {
            return ESP_OK;
        }

        if (attempt < MAX_RETRIES - 1) {
            vTaskDelay(pdMS_TO_TICKS(RETRY_DELAY_MS * (attempt + 1)));
        }
    }

    // Count error only once per failed read operation (not per retry)
    if (had_crc_error) {
        health.crc_errors++;
        return ESP_ERR_INVALID_CRC;
    } else {
        health.i2c_errors++;
        return ret;
    }
}

/**
 * @brief Send a command with data words to the sensor
 *
 * Each data word is sent as 2 data bytes + 1 CRC byte.
 */
static esp_err_t sen55_write_data_internal(uint16_t cmd, const uint8_t *data, size_t words)
{
    size_t total = 2 + words * 3;
    uint8_t buf[20];  // Max: 2 cmd + 4 words * 3 = 14
    if (total > sizeof(buf)) {
        return ESP_ERR_INVALID_SIZE;
    }

    buf[0] = cmd >> 8;
    buf[1] = cmd & 0xFF;

    for (size_t i = 0; i < words; i++) {
        buf[2 + i * 3]     = data[i * 2];
        buf[2 + i * 3 + 1] = data[i * 2 + 1];
        buf[2 + i * 3 + 2] = calc_crc8(&data[i * 2], 2);
    }

    esp_err_t ret;
    for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
        ret = i2c_master_transmit(dev_handle, buf, total, I2C_TIMEOUT_MS);
        if (ret == ESP_OK) {
            return ESP_OK;
        }
        if (attempt < MAX_RETRIES - 1) {
            vTaskDelay(pdMS_TO_TICKS(RETRY_DELAY_MS * (attempt + 1)));
        }
    }

    health.i2c_errors++;
    return ret;
}

// =============================================================================
// VOC Algorithm State Persistence
// =============================================================================

/**
 * @brief Restore VOC algorithm state from NVS
 *
 * Must be called in idle mode (before start measurement) per datasheet.
 * Reduces VOC index learning time from ~1 hour to ~15 minutes after reboot.
 */
static void restore_voc_state(void)
{
    nvs_handle_t nvs;
    esp_err_t ret = nvs_open(NVS_NAMESPACE, NVS_READONLY, &nvs);
    if (ret != ESP_OK) {
        return;  // No saved state — normal on first boot
    }

    uint8_t state[8];
    size_t len = sizeof(state);
    ret = nvs_get_blob(nvs, NVS_KEY_VOC_STATE, state, &len);
    nvs_close(nvs);

    if (ret != ESP_OK || len != sizeof(state)) {
        return;
    }

    ret = sen55_write_data_internal(CMD_VOC_STATE, state, 4);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "VOC algorithm state restored from NVS");
        vTaskDelay(pdMS_TO_TICKS(20));
    } else {
        ESP_LOGW(TAG, "VOC state restore failed: %s", esp_err_to_name(ret));
    }
}

// =============================================================================
// I2C Bus Initialization
// =============================================================================

/**
 * @brief Initialize or re-initialize the I2C bus and device
 */
static esp_err_t sen55_init_bus(void)
{
    // Clean up existing handles if re-initializing
    if (dev_handle) {
        i2c_master_bus_rm_device(dev_handle);
        dev_handle = NULL;
    }
    if (bus_handle) {
        i2c_del_master_bus(bus_handle);
        bus_handle = NULL;
    }

    // Configure I2C bus
    i2c_master_bus_config_t bus_config = {
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .i2c_port = I2C_PORT,
        .scl_io_num = I2C_SCL_GPIO,
        .sda_io_num = I2C_SDA_GPIO,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = false,  // Using external 10kΩ pull-ups
    };
    ESP_RETURN_ON_ERROR(i2c_new_master_bus(&bus_config, &bus_handle), TAG,
                        "I2C bus create failed");

    // Brief delay for sensor to be ready
    vTaskDelay(pdMS_TO_TICKS(100));

    // Add SEN55 device
    i2c_device_config_t dev_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = SEN55_ADDR,
        .scl_speed_hz = I2C_FREQ_HZ,
        .scl_wait_us = SCL_WAIT_US,
    };
    ESP_RETURN_ON_ERROR(i2c_master_bus_add_device(bus_handle, &dev_config, &dev_handle), TAG,
                        "I2C device add failed");

    return ESP_OK;
}

// =============================================================================
// Public API
// =============================================================================

esp_err_t sen55_init(void)
{
    esp_err_t ret;

    ESP_LOGI(TAG, "Initializing SEN55 (I2C GPIO %d/%d)", I2C_SDA_GPIO, I2C_SCL_GPIO);

    ret = sen55_init_bus();
    if (ret != ESP_OK) {
        return ret;
    }

    // Restore VOC algorithm state from NVS (must be in idle mode, before start)
    restore_voc_state();

    // Start measurement mode
    ret = sen55_start();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start measurement: %s", esp_err_to_name(ret));
        return ret;
    }

    if (reading_mutex == NULL) {
        reading_mutex = xSemaphoreCreateMutex();
    }

    initialized = true;
    health.is_healthy = true;
    consecutive_failures = 0;

    // Per Sensirion: "After starting the measurement, it takes some time (~1s)
    // until the first measurement results are available"
    // Wait for data to become available before returning
    ESP_LOGI(TAG, "Waiting for first measurement...");
    for (int i = 0; i < 20; i++) {  // Up to 2 seconds
        vTaskDelay(pdMS_TO_TICKS(100));
        if (sen55_data_ready()) {
            ESP_LOGI(TAG, "SEN55 initialized successfully (data ready after %dms)", (i + 1) * 100);
            return ESP_OK;
        }
    }

    // Data not ready after timeout - sensor may still work, just slower startup
    ESP_LOGW(TAG, "SEN55 initialized but data not yet ready (will retry in main loop)");
    return ESP_OK;
}

esp_err_t sen55_start(void)
{
    esp_err_t ret = sen55_send_cmd_internal(CMD_START_MEAS);
    if (ret == ESP_OK) {
        // Per Sensirion driver: 50ms delay after start measurement
        vTaskDelay(pdMS_TO_TICKS(50));
    }
    return ret;
}

esp_err_t sen55_stop(void)
{
    esp_err_t ret = sen55_send_cmd_internal(CMD_STOP_MEAS);
    if (ret == ESP_OK) {
        // Per Sensirion driver: 200ms delay after stop measurement
        vTaskDelay(pdMS_TO_TICKS(200));
    }
    return ret;
}

bool sen55_data_ready(void)
{
    if (!initialized || !dev_handle) {
        return false;
    }

    esp_err_t ret = sen55_send_cmd_internal(CMD_READ_DATA_READY);
    if (ret != ESP_OK) {
        return false;
    }

    vTaskDelay(pdMS_TO_TICKS(20));

    uint8_t data[2];
    ret = sen55_read_data_internal(data, 1);
    if (ret != ESP_OK) {
        // Check for "sensor busy" pattern - don't count as CRC error
        if (ret == ESP_ERR_INVALID_CRC &&
            health.last_crc_error.data[0] == 0xFF &&
            health.last_crc_error.data[1] == 0xFF &&
            health.last_crc_error.recv_crc == 0xFF) {
            // Undo the CRC error count - sensor was just busy
            if (health.crc_errors > 0) health.crc_errors--;
            // Track as busy event
            health.busy_events.count++;
            health.busy_events.last_read_number = health.total_reads;
            health.busy_events.last_uptime_ms = esp_timer_get_time() / 1000;
        }
        return false;
    }

    return (data[1] & 0x01) != 0;
}

esp_err_t sen55_read(sen55_data_t *data)
{
    if (data == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (!initialized || !dev_handle) {
        return ESP_ERR_INVALID_STATE;
    }

    // Check if new data is ready before reading (per Sensirion official driver)
    // This prevents the 0xFFFF "not ready" responses
    if (!sen55_data_ready()) {
        return ESP_ERR_NOT_FOUND;  // No new data - normal, will try again next cycle
    }

    health.total_reads++;

    // Send read command
    esp_err_t ret = sen55_send_cmd_internal(CMD_READ_VALUES);
    if (ret != ESP_OK) {
        consecutive_failures++;
        goto handle_failure;
    }

    // Per Sensirion datasheet: 20ms delay for sensor to fill data buffers
    vTaskDelay(pdMS_TO_TICKS(20));

    // Read 8 words (16 data bytes): PM1, PM2.5, PM4, PM10, Hum, Temp, VOC, NOx
    uint8_t raw[16];
    ret = sen55_read_data_internal(raw, 8);

    if (ret != ESP_OK) {
        // Check for "sensor busy" pattern: all 0xFF including CRC
        // Per Sensirion datasheet, 0xFFFF means "value unknown" - sensor was briefly busy
        // This is normal (~1-2% of reads), not an error - just skip this reading
        if (ret == ESP_ERR_INVALID_CRC &&
            health.last_crc_error.data[0] == 0xFF &&
            health.last_crc_error.data[1] == 0xFF &&
            health.last_crc_error.recv_crc == 0xFF) {

            // Track for diagnostics but don't treat as error
            health.busy_events.count++;
            health.busy_events.last_read_number = health.total_reads;
            health.busy_events.last_uptime_ms = esp_timer_get_time() / 1000;

            // Undo the CRC error count - this isn't corruption, just sensor busy
            if (health.crc_errors > 0) health.crc_errors--;

            ESP_LOGD(TAG, "Sensor busy (0xFFFF), skipping this reading");
            return ESP_ERR_NOT_FOUND;  // Treat like "no data ready"
        }

        // Real error
        consecutive_failures++;
        goto handle_failure;
    }

    // Success
    consecutive_failures = 0;
    health.successful_reads++;
    health.is_healthy = true;

    // Convert raw data to physical values
    // PM values are uint16_t, others are int16_t per Sensirion datasheet
    uint16_t pm1_raw = (raw[0] << 8) | raw[1];
    uint16_t pm25_raw = (raw[2] << 8) | raw[3];
    uint16_t pm4_raw = (raw[4] << 8) | raw[5];
    uint16_t pm10_raw = (raw[6] << 8) | raw[7];
    int16_t hum_raw = (raw[8] << 8) | raw[9];
    int16_t temp_raw = (raw[10] << 8) | raw[11];
    int16_t voc_raw = (raw[12] << 8) | raw[13];
    int16_t nox_raw = (raw[14] << 8) | raw[15];

    // Check for invalid values per Sensirion datasheet:
    // - PM values (uint16): 0xFFFF means unknown
    // - Humidity/Temp/VOC/NOx (int16): 0x7FFF means unknown
    data->pm1_0 = (pm1_raw == 0xFFFF) ? -1.0f : pm1_raw / 10.0f;
    data->pm2_5 = (pm25_raw == 0xFFFF) ? -1.0f : pm25_raw / 10.0f;
    data->pm4_0 = (pm4_raw == 0xFFFF) ? -1.0f : pm4_raw / 10.0f;
    data->pm10 = (pm10_raw == 0xFFFF) ? -1.0f : pm10_raw / 10.0f;
    data->humidity = (hum_raw == 0x7FFF) ? -1.0f : hum_raw / 100.0f;
    data->temperature = (temp_raw == 0x7FFF) ? -1.0f : temp_raw / 200.0f;
    data->voc_index = (voc_raw == 0x7FFF) ? -1 : voc_raw / 10;
    data->nox_index = (nox_raw == 0x7FFF) ? -1 : nox_raw / 10;

    // Cache for non-consuming access (e.g., API handler)
    if (reading_mutex && xSemaphoreTake(reading_mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        last_reading = *data;
        has_valid_reading = true;
        xSemaphoreGive(reading_mutex);
    }

    return ESP_OK;

handle_failure:
    health.is_healthy = false;

    // Auto-recovery after too many consecutive failures
    if (consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
        ESP_LOGW(TAG, "Too many consecutive failures (%lu), attempting recovery",
                 consecutive_failures);
        sen55_recover();
    }

    return ret;
}

esp_err_t sen55_recover(void)
{
    ESP_LOGW(TAG, "Starting sensor recovery sequence");
    health.reinit_count++;

    // Step 1: I2C bus recovery
    i2c_bus_recovery();

    // Step 2: Re-initialize I2C bus
    esp_err_t ret = sen55_init_bus();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to re-init I2C bus: %s", esp_err_to_name(ret));
        return ret;
    }

    // Step 3: Send soft reset command (may fail if sensor is stuck)
    // Per Sensirion driver: 200ms delay after reset
    sen55_send_cmd_internal(CMD_RESET);
    vTaskDelay(pdMS_TO_TICKS(200));

    // Step 4: Re-start measurement
    ret = sen55_start();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to restart measurement: %s", esp_err_to_name(ret));
        return ret;
    }

    // Wait for data to become available (same as init)
    for (int i = 0; i < 20; i++) {  // Up to 2 seconds
        vTaskDelay(pdMS_TO_TICKS(100));
        if (sen55_data_ready()) {
            break;
        }
    }

    consecutive_failures = 0;
    health.is_healthy = true;

    ESP_LOGI(TAG, "Sensor recovery completed successfully");
    return ESP_OK;
}

void sen55_get_health(sen55_health_t *health_out)
{
    if (health_out) {
        taskENTER_CRITICAL(&health_spinlock);
        *health_out = health;
        taskEXIT_CRITICAL(&health_spinlock);
    }
}

void sen55_reset_health(void)
{
    taskENTER_CRITICAL(&health_spinlock);
    memset(&health, 0, sizeof(health));
    health.is_healthy = initialized;
    taskEXIT_CRITICAL(&health_spinlock);
}

bool sen55_get_last_reading(sen55_data_t *data)
{
    if (data == NULL || !has_valid_reading) {
        return false;
    }
    if (reading_mutex && xSemaphoreTake(reading_mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        *data = last_reading;
        xSemaphoreGive(reading_mutex);
        return true;
    }
    return false;
}

// =============================================================================
// Device Status & Maintenance
// =============================================================================

esp_err_t sen55_read_device_status(sen55_device_status_t *status)
{
    if (status == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    if (!initialized || !dev_handle) {
        return ESP_ERR_INVALID_STATE;
    }

    memset(status, 0, sizeof(*status));

    esp_err_t ret = sen55_send_cmd_internal(CMD_DEVICE_STATUS);
    if (ret != ESP_OK) {
        return ret;
    }

    vTaskDelay(pdMS_TO_TICKS(20));

    // Status register is 32-bit = 2 words (4 data bytes)
    uint8_t data[4];
    ret = sen55_read_data_internal(data, 2);
    if (ret != ESP_OK) {
        return ret;
    }

    status->raw = ((uint32_t)data[0] << 24) | ((uint32_t)data[1] << 16) |
                  ((uint32_t)data[2] << 8) | data[3];
    status->fan_speed_warning   = (status->raw >> 21) & 1;
    status->fan_cleaning_active = (status->raw >> 19) & 1;
    status->gas_sensor_error    = (status->raw >> 7) & 1;
    status->rht_error           = (status->raw >> 6) & 1;
    status->laser_failure       = (status->raw >> 5) & 1;
    status->fan_failure         = (status->raw >> 4) & 1;
    status->valid = true;

    // Update health struct
    taskENTER_CRITICAL(&health_spinlock);
    health.device_status = *status;
    taskEXIT_CRITICAL(&health_spinlock);

    // Log any active error flags
    if (status->fan_failure) {
        ESP_LOGE(TAG, "Device status: Fan failure!");
    }
    if (status->laser_failure) {
        ESP_LOGE(TAG, "Device status: Laser failure!");
    }
    if (status->gas_sensor_error) {
        ESP_LOGE(TAG, "Device status: Gas sensor error");
    }
    if (status->rht_error) {
        ESP_LOGW(TAG, "Device status: RHT communication error");
    }
    if (status->fan_speed_warning) {
        ESP_LOGW(TAG, "Device status: Fan speed warning");
    }
    if (status->fan_cleaning_active) {
        ESP_LOGI(TAG, "Device status: Fan cleaning in progress");
    }

    return ESP_OK;
}

esp_err_t sen55_start_fan_cleaning(void)
{
    if (!initialized || !dev_handle) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Starting manual fan cleaning cycle (~10s)");
    return sen55_send_cmd_internal(CMD_START_FAN_CLEAN);
}

bool sen55_check_fan_cleaning(uint32_t current_unix_time)
{
    if (!initialized || current_unix_time == 0) {
        return false;
    }

    nvs_handle_t nvs;
    esp_err_t ret = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &nvs);
    if (ret != ESP_OK) {
        return false;
    }

    uint32_t last_clean = 0;
    nvs_get_u32(nvs, NVS_KEY_LAST_CLEAN, &last_clean);

    bool needed = (last_clean == 0) || (current_unix_time - last_clean >= 604800);

    if (needed) {
        ESP_LOGI(TAG, "Fan cleaning needed (last: %lus ago)",
                 last_clean ? (unsigned long)(current_unix_time - last_clean) : 0);
        ret = sen55_start_fan_cleaning();
        if (ret == ESP_OK) {
            nvs_set_u32(nvs, NVS_KEY_LAST_CLEAN, current_unix_time);
            nvs_commit(nvs);
        }
    }

    nvs_close(nvs);
    return needed;
}

esp_err_t sen55_save_voc_state(void)
{
    if (!initialized || !dev_handle) {
        return ESP_ERR_INVALID_STATE;
    }

    // Per datasheet: only save after >= 3 hours of continuous operation
    int64_t uptime_s = esp_timer_get_time() / 1000000;
    if (uptime_s < 10800) {
        ESP_LOGD(TAG, "VOC state not saved (uptime %llds < 3h)", uptime_s);
        return ESP_OK;
    }

    // Read VOC algorithm state (must be in measurement mode)
    // Note: if called from non-main task (e.g., OTA), a concurrent sen55_read()
    // may cause a transient I2C error on either side — both handle this gracefully
    esp_err_t ret = sen55_send_cmd_internal(CMD_VOC_STATE);
    if (ret != ESP_OK) {
        return ret;
    }

    vTaskDelay(pdMS_TO_TICKS(20));

    uint8_t state[8];  // 4 words = 8 data bytes
    ret = sen55_read_data_internal(state, 4);
    if (ret != ESP_OK) {
        return ret;
    }

    // Save to NVS
    nvs_handle_t nvs;
    ret = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &nvs);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "NVS open failed for VOC save: %s", esp_err_to_name(ret));
        return ret;
    }

    ret = nvs_set_blob(nvs, NVS_KEY_VOC_STATE, state, sizeof(state));
    if (ret == ESP_OK) {
        ret = nvs_commit(nvs);
    }
    nvs_close(nvs);

    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "VOC algorithm state saved to NVS");
    } else {
        ESP_LOGW(TAG, "VOC state save failed: %s", esp_err_to_name(ret));
    }

    return ret;
}
