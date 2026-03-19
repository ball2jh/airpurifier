/**
 * @file api_server.h
 * @brief REST API HTTP server
 *
 * Provides JSON REST API endpoints for:
 * - Current sensor/fan status
 * - Historical data access
 * - Fan speed control
 * - System health monitoring
 *
 * CORS enabled for cross-origin requests from external web apps.
 */

#ifndef API_SERVER_H
#define API_SERVER_H

#include "esp_err.h"

/**
 * @brief Start the REST API HTTP server
 *
 * Starts HTTP server on port 80 with the following endpoints:
 *
 * GET  /api/status      - Current sensor readings and fan status
 * GET  /api/fan         - Fan settings
 * POST /api/fan         - Set fan speed {"speed": 0-100}
 * GET  /api/history/:tier - Historical data (tier: raw,fine,medium,coarse,daily,archive)
 * GET  /api/health      - System health statistics
 * GET  /api/info        - Device info and uptime
 *
 * @return ESP_OK on success
 */
esp_err_t api_server_start(void);

/**
 * @brief Stop the HTTP server
 *
 * @return ESP_OK on success
 */
esp_err_t api_server_stop(void);

#endif // API_SERVER_H
