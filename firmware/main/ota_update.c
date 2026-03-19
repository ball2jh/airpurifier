/**
 * @file ota_update.c
 * @brief Over-The-Air firmware update implementation
 *
 * Non-blocking OTA updates via FreeRTOS task.
 * Supports automatic rollback on boot failure.
 */

#include "ota_update.h"
#include "history.h"
#include "sen55.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_http_client.h"
#include "esp_app_format.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include <string.h>

static const char *TAG = "ota";

// =============================================================================
// Configuration
// =============================================================================

#define OTA_BUFFER_SIZE     4096
#define OTA_TASK_STACK_SIZE 8192
#define OTA_TASK_PRIORITY   5
#define OTA_HTTP_TIMEOUT_MS 30000
#define MAX_URL_LENGTH      256

// =============================================================================
// State
// =============================================================================

static ota_status_t s_status = {
    .state = OTA_STATE_IDLE,
    .progress_percent = 0,
    .error_msg = {0},
    .current_version = {0},
    .partition = {0}
};

static SemaphoreHandle_t s_status_mutex = NULL;
static char s_update_url[MAX_URL_LENGTH] = {0};
static TaskHandle_t s_ota_task_handle = NULL;

// =============================================================================
// Status Helpers
// =============================================================================

static void set_status(ota_state_t state, int progress, const char *error)
{
    if (xSemaphoreTake(s_status_mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        s_status.state = state;
        s_status.progress_percent = progress;
        if (error != NULL) {
            strncpy(s_status.error_msg, error, sizeof(s_status.error_msg) - 1);
            s_status.error_msg[sizeof(s_status.error_msg) - 1] = '\0';
        } else {
            s_status.error_msg[0] = '\0';
        }
        xSemaphoreGive(s_status_mutex);
    }
}

// =============================================================================
// OTA Download Task
// =============================================================================

static void ota_task(void *pvParameter)
{
    ESP_LOGI(TAG, "Starting OTA update from: %s", s_update_url);
    set_status(OTA_STATE_DOWNLOADING, 0, NULL);

    esp_err_t err;
    esp_ota_handle_t ota_handle = 0;
    const esp_partition_t *update_partition = NULL;
    char *buffer = NULL;
    esp_http_client_handle_t client = NULL;
    int content_length = 0;
    int total_written = 0;

    // Get the next OTA partition to write to
    update_partition = esp_ota_get_next_update_partition(NULL);
    if (update_partition == NULL) {
        ESP_LOGE(TAG, "No OTA partition available");
        set_status(OTA_STATE_FAILED, 0, "No OTA partition");
        goto cleanup;
    }
    ESP_LOGI(TAG, "Writing to partition: %s at 0x%lx",
             update_partition->label, update_partition->address);

    // Allocate download buffer
    buffer = malloc(OTA_BUFFER_SIZE);
    if (buffer == NULL) {
        ESP_LOGE(TAG, "Failed to allocate buffer");
        set_status(OTA_STATE_FAILED, 0, "Out of memory");
        goto cleanup;
    }

    // Configure HTTP client
    esp_http_client_config_t http_config = {
        .url = s_update_url,
        .timeout_ms = OTA_HTTP_TIMEOUT_MS,
        .keep_alive_enable = true,
    };

    client = esp_http_client_init(&http_config);
    if (client == NULL) {
        ESP_LOGE(TAG, "Failed to create HTTP client");
        set_status(OTA_STATE_FAILED, 0, "HTTP client error");
        goto cleanup;
    }

    // Open connection
    err = esp_http_client_open(client, 0);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "HTTP open failed: %s", esp_err_to_name(err));
        set_status(OTA_STATE_FAILED, 0, "Connection failed");
        goto cleanup;
    }

    // Get content length
    content_length = esp_http_client_fetch_headers(client);
    if (content_length <= 0) {
        ESP_LOGE(TAG, "Invalid content length: %d", content_length);
        set_status(OTA_STATE_FAILED, 0, "Invalid firmware size");
        goto cleanup;
    }
    ESP_LOGI(TAG, "Firmware size: %d bytes", content_length);

    // Begin OTA
    err = esp_ota_begin(update_partition, OTA_WITH_SEQUENTIAL_WRITES, &ota_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_ota_begin failed: %s", esp_err_to_name(err));
        set_status(OTA_STATE_FAILED, 0, "OTA begin failed");
        goto cleanup;
    }

    // Download and write firmware
    while (1) {
        int read_len = esp_http_client_read(client, buffer, OTA_BUFFER_SIZE);
        if (read_len < 0) {
            ESP_LOGE(TAG, "HTTP read error");
            set_status(OTA_STATE_FAILED, 0, "Download error");
            goto cleanup;
        }
        if (read_len == 0) {
            // Check if we got all data
            if (esp_http_client_is_complete_data_received(client)) {
                break;
            }
            // Timeout waiting for data
            ESP_LOGE(TAG, "Connection closed prematurely");
            set_status(OTA_STATE_FAILED, 0, "Incomplete download");
            goto cleanup;
        }

        // Validate download size against Content-Length
        if (total_written + read_len > content_length) {
            ESP_LOGE(TAG, "Received more data than expected (%d > %d)",
                     total_written + read_len, content_length);
            set_status(OTA_STATE_FAILED, 0, "Download size mismatch");
            goto cleanup;
        }

        // Write to flash
        err = esp_ota_write(ota_handle, buffer, read_len);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "esp_ota_write failed: %s", esp_err_to_name(err));
            set_status(OTA_STATE_FAILED, 0, "Flash write failed");
            goto cleanup;
        }

        total_written += read_len;
        int progress = (total_written * 100) / content_length;
        set_status(OTA_STATE_DOWNLOADING, progress, NULL);

        // Log progress periodically
        if (progress % 10 == 0) {
            ESP_LOGI(TAG, "Download progress: %d%%", progress);
        }
    }

    ESP_LOGI(TAG, "Download complete: %d bytes written", total_written);
    set_status(OTA_STATE_VERIFYING, 100, NULL);

    // Finish OTA (validates image)
    err = esp_ota_end(ota_handle);
    ota_handle = 0;  // Mark as finished
    if (err != ESP_OK) {
        if (err == ESP_ERR_OTA_VALIDATE_FAILED) {
            ESP_LOGE(TAG, "Image validation failed");
            set_status(OTA_STATE_FAILED, 0, "Invalid firmware image");
        } else {
            ESP_LOGE(TAG, "esp_ota_end failed: %s", esp_err_to_name(err));
            set_status(OTA_STATE_FAILED, 0, "OTA finalize failed");
        }
        goto cleanup;
    }

    // Set boot partition
    err = esp_ota_set_boot_partition(update_partition);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_ota_set_boot_partition failed: %s", esp_err_to_name(err));
        set_status(OTA_STATE_FAILED, 0, "Set boot partition failed");
        goto cleanup;
    }

    ESP_LOGI(TAG, "OTA update successful! Rebooting in 2 seconds...");
    set_status(OTA_STATE_REBOOTING, 100, NULL);

    // Cleanup before reboot
    if (client) {
        esp_http_client_close(client);
        esp_http_client_cleanup(client);
    }
    free(buffer);

    // Save VOC algorithm state before reboot (only effective after 3h uptime)
    sen55_save_voc_state();

    // Save history again to preserve samples collected during download
    ESP_LOGI(TAG, "Saving history before reboot...");
    history_save();

    // Delay then reboot
    vTaskDelay(pdMS_TO_TICKS(2000));
    esp_restart();
    return;  // Never reached

cleanup:
    if (ota_handle != 0) {
        esp_ota_abort(ota_handle);
    }
    if (client) {
        esp_http_client_close(client);
        esp_http_client_cleanup(client);
    }
    if (buffer) {
        free(buffer);
    }
    s_ota_task_handle = NULL;
    vTaskDelete(NULL);
}

// =============================================================================
// Public API
// =============================================================================

esp_err_t ota_init(void)
{
    // Create mutex for status access
    if (s_status_mutex == NULL) {
        s_status_mutex = xSemaphoreCreateMutex();
        if (s_status_mutex == NULL) {
            ESP_LOGE(TAG, "Failed to create mutex");
            return ESP_ERR_NO_MEM;
        }
    }

    // Get current partition info
    const esp_partition_t *running = esp_ota_get_running_partition();
    if (running != NULL) {
        strncpy(s_status.partition, running->label, sizeof(s_status.partition) - 1);
    }

    // Get app version
    const esp_app_desc_t *app_desc = esp_app_get_description();
    if (app_desc != NULL) {
        strncpy(s_status.current_version, app_desc->version,
                sizeof(s_status.current_version) - 1);
    }

    // Check if we're running a pending (unvalidated) update
    esp_ota_img_states_t ota_state;
    if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
        if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
            ESP_LOGW(TAG, "Running unvalidated firmware - awaiting validation");
        }
    }

    ESP_LOGI(TAG, "OTA initialized (partition: %s, version: %s)",
             s_status.partition, s_status.current_version);

    return ESP_OK;
}

esp_err_t ota_start_update(const char *url)
{
    if (url == NULL || strlen(url) == 0) {
        return ESP_ERR_INVALID_ARG;
    }

    if (strlen(url) >= MAX_URL_LENGTH) {
        return ESP_ERR_INVALID_ARG;
    }

    if (ota_is_busy()) {
        ESP_LOGW(TAG, "OTA already in progress");
        return ESP_ERR_INVALID_STATE;
    }

    // Store URL for task
    strncpy(s_update_url, url, MAX_URL_LENGTH - 1);
    s_update_url[MAX_URL_LENGTH - 1] = '\0';

    // Create OTA task
    BaseType_t ret = xTaskCreate(
        ota_task,
        "ota_task",
        OTA_TASK_STACK_SIZE,
        NULL,
        OTA_TASK_PRIORITY,
        &s_ota_task_handle
    );

    if (ret != pdPASS) {
        ESP_LOGE(TAG, "Failed to create OTA task");
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

ota_status_t ota_get_status(void)
{
    ota_status_t status = {0};

    if (s_status_mutex != NULL &&
        xSemaphoreTake(s_status_mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        memcpy(&status, &s_status, sizeof(ota_status_t));
        xSemaphoreGive(s_status_mutex);
    }

    return status;
}

bool ota_is_busy(void)
{
    ota_status_t status = ota_get_status();
    return (status.state == OTA_STATE_DOWNLOADING ||
            status.state == OTA_STATE_VERIFYING ||
            status.state == OTA_STATE_REBOOTING);
}

esp_err_t ota_mark_valid(void)
{
    const esp_partition_t *running = esp_ota_get_running_partition();
    esp_ota_img_states_t ota_state;

    esp_err_t err = esp_ota_get_state_partition(running, &ota_state);
    if (err != ESP_OK) {
        // Partition doesn't support states (e.g., factory partition)
        ESP_LOGI(TAG, "Partition state not available - skipping validation");
        return ESP_OK;
    }

    if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
        err = esp_ota_mark_app_valid_cancel_rollback();
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to mark app valid: %s", esp_err_to_name(err));
            return err;
        }
        ESP_LOGI(TAG, "Firmware marked as valid - rollback disabled");
    } else {
        ESP_LOGI(TAG, "Firmware already validated (state: %d)", ota_state);
    }

    return ESP_OK;
}

bool ota_is_pending_validation(void)
{
    const esp_partition_t *running = esp_ota_get_running_partition();
    esp_ota_img_states_t ota_state;

    if (esp_ota_get_state_partition(running, &ota_state) != ESP_OK) {
        return false;
    }

    return (ota_state == ESP_OTA_IMG_PENDING_VERIFY);
}
