/**
 * @file wifi.h
 * @brief WiFi station management
 *
 * Connects to configured WiFi network and maintains connection.
 * Automatically reconnects on disconnection.
 */

#ifndef WIFI_H
#define WIFI_H

#include <stdbool.h>
#include "esp_err.h"
#include "esp_netif_ip_addr.h"

/**
 * @brief WiFi connection status
 */
typedef struct {
    bool connected;
    char ip_addr[16];       // e.g., "192.168.1.100"
    int8_t rssi;            // Signal strength (dBm)
    uint32_t connect_count; // Number of successful connections
    uint32_t disconnect_count; // Number of disconnections
} wifi_status_t;

/**
 * @brief Initialize WiFi in station mode
 *
 * Initializes WiFi subsystem and begins connection attempt.
 * Connection happens asynchronously - use wifi_wait_connected()
 * or wifi_is_connected() to check status.
 *
 * @return ESP_OK on successful initialization
 */
esp_err_t wifi_init(void);

/**
 * @brief Check if WiFi is currently connected
 *
 * @return true if connected to AP
 */
bool wifi_is_connected(void);

/**
 * @brief Wait for WiFi connection with timeout
 *
 * @param timeout_ms Maximum time to wait (0 = wait forever)
 * @return ESP_OK if connected, ESP_ERR_TIMEOUT if timed out
 */
esp_err_t wifi_wait_connected(uint32_t timeout_ms);

/**
 * @brief Get current WiFi status
 *
 * @param status Output structure for status info
 */
void wifi_get_status(wifi_status_t *status);

/**
 * @brief Get IP address as string
 *
 * @return IP address string or "0.0.0.0" if not connected
 */
const char* wifi_get_ip(void);

#endif // WIFI_H
