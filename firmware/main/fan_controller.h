/**
 * @file fan_controller.h
 * @brief PWM fan control and tachometer reading using ESP32 hardware peripherals
 *
 * Features:
 * - 25kHz PWM output (PC fan standard)
 * - Hardware pulse counting with glitch filter
 * - Non-blocking RPM measurement via background timer
 * - Fan stall detection for long-term reliability
 */

#ifndef FAN_CONTROLLER_H
#define FAN_CONTROLLER_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

/**
 * @brief Fan health status structure
 */
typedef struct {
    uint32_t rpm_samples;       // Total RPM measurement samples
    uint32_t stall_events;      // Number of stall detections
    uint32_t recovery_attempts; // Fan recovery attempts
    bool is_stalled;            // Current stall status
    bool is_healthy;            // Overall health status
} fan_health_t;

/**
 * @brief Fan control mode
 */
typedef enum {
    FAN_MODE_MANUAL = 0,    // User sets speed directly
    FAN_MODE_AUTO = 1       // Speed based on PM2.5 levels
} fan_mode_t;

/**
 * @brief Initialize the fan controller (PWM output and tachometer input)
 *
 * Sets up:
 * - LEDC for PWM output
 * - PCNT with hardware glitch filter for tach input
 * - Background timer for non-blocking RPM measurement
 * - Stall detection monitoring
 *
 * @return ESP_OK on success
 */
esp_err_t fan_controller_init(void);

/**
 * @brief Set fan speed as a percentage (0-100)
 * @param percent Speed percentage (0 = off, 100 = full speed)
 */
void fan_set_speed_percent(uint8_t percent);

/**
 * @brief Set fan speed as raw duty cycle (0-255)
 * @param duty Raw 8-bit duty cycle value
 */
void fan_set_speed_duty(uint8_t duty);

/**
 * @brief Get the current fan RPM (non-blocking)
 *
 * Returns the most recent RPM measurement from the background timer.
 * Updates approximately once per second.
 *
 * @return Current RPM reading (0 if not yet measured or stalled)
 */
uint32_t fan_get_rpm(void);

/**
 * @brief Get the current fan speed setting as percentage
 * @return Current speed setting (0-100)
 */
uint8_t fan_get_speed_percent(void);

/**
 * @brief Check if the fan is currently stalled
 *
 * A fan is considered stalled if PWM duty > minimum threshold
 * but RPM reads 0 for multiple consecutive samples.
 *
 * @return true if fan appears to be stalled
 */
bool fan_is_stalled(void);

/**
 * @brief Attempt to recover a stalled fan
 *
 * Tries to restart a stalled fan by cycling the PWM signal.
 * Call this if fan_is_stalled() returns true.
 *
 * @return ESP_OK if recovery initiated (check is_stalled after delay)
 */
esp_err_t fan_recover_stall(void);

/**
 * @brief Get fan health statistics
 *
 * @param health Pointer to structure to receive health data
 */
void fan_get_health(fan_health_t *health);

/**
 * @brief Reset health statistics counters
 */
void fan_reset_health(void);

/**
 * @brief Get current fan control mode
 * @return Current mode (FAN_MODE_MANUAL or FAN_MODE_AUTO)
 */
fan_mode_t fan_get_mode(void);

/**
 * @brief Set fan control mode
 * @param mode FAN_MODE_MANUAL or FAN_MODE_AUTO
 */
void fan_set_mode(fan_mode_t mode);

/**
 * @brief Update fan speed based on PM2.5 reading (AUTO mode only)
 *
 * Call this with each new sensor reading. In AUTO mode, adjusts
 * fan speed based on PM2.5 thresholds. In MANUAL mode, does nothing.
 *
 * @param pm2_5 Current PM2.5 reading in µg/m³
 */
void fan_auto_update(float pm2_5);

/**
 * @brief Get the target speed (for AUTO mode)
 * @return Target speed percentage (0-100)
 */
uint8_t fan_get_target_speed(void);

/**
 * @brief Check if manual mode has timed out
 *
 * If in manual mode and the timeout period has elapsed (6 hours),
 * automatically switches back to AUTO mode. Call this periodically
 * from the main loop.
 */
void fan_check_auto_timeout(void);

/**
 * @brief Get seconds remaining until manual mode auto-reverts to auto
 * @return Seconds remaining (>0), 0 if expired, -1 if not in manual mode
 */
int32_t fan_get_manual_remaining_sec(void);

#endif // FAN_CONTROLLER_H
