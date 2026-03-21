/**
 * @file fan_controller.c
 * @brief PWM fan control and tachometer reading using ESP32 hardware peripherals
 *
 * Uses:
 * - LEDC peripheral for 25kHz PWM output (PC fan standard)
 * - PCNT peripheral with hardware glitch filter for tachometer input
 * - GPTimer for efficient periodic RPM measurement (ISR context, no task overhead)
 * - Internal pull-up resistor for open-collector tach signal
 *
 * Reliability features:
 * - Fan stall detection (PWM on but no RPM)
 * - Automatic stall recovery via PWM cycling
 * - Health statistics tracking
 */

#include "fan_controller.h"
#include "driver/ledc.h"
#include "driver/pulse_cnt.h"
#include "driver/gptimer.h"
#include "hal/pcnt_ll.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_check.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdatomic.h>
#include <string.h>

static const char *TAG = "fan_ctrl";

// =============================================================================
// Configuration
// =============================================================================

// Pin configuration
#define PWM_GPIO            18
#define TACH_GPIO           19

// PWM configuration
#define PWM_FREQUENCY       25000   // 25kHz - PC fan standard
#define PWM_RESOLUTION      LEDC_TIMER_8_BIT
#define PWM_MAX_DUTY        255

// Tachometer configuration
#define PULSES_PER_REV      2       // Standard: 2 pulses per revolution
#define GLITCH_FILTER_NS    12000   // 12us hardware glitch filter

// Timer configuration
#define TIMER_RESOLUTION_HZ 1000000 // 1MHz = 1us resolution
#define RPM_UPDATE_US       1000000 // 1 second in microseconds

// Stall detection configuration
#define MIN_DUTY_FOR_STALL  26      // ~10% duty - below this, 0 RPM is expected
#define STALL_SAMPLES       3       // Consecutive 0 RPM samples to declare stall
#define RECOVERY_BURST_MS   500     // Full-speed burst duration for recovery
#define STARTUP_GRACE_SEC   5       // Grace period for fan spin-up before stall detection

// Continuous auto mode: linear map PM2.5 -> fan speed
#define AUTO_PM25_FLOOR       5.0f   // WHO annual guideline — excellent air below this
#define AUTO_PM25_CEILING    35.0f   // EPA Moderate/USG boundary
#define AUTO_SPEED_MIN        25     // Minimum fan speed in AUTO (percent)
#define AUTO_SPEED_MAX       100     // Maximum fan speed in AUTO (percent)
#define AUTO_SLEW_RATE         2     // Max percent change per second

// Manual mode timeout (return to auto after this long)
#define MANUAL_TIMEOUT_SEC   (6 * 60 * 60)  // 6 hours

// =============================================================================
// State
// =============================================================================

static pcnt_unit_handle_t pcnt_unit = NULL;
static int pcnt_unit_id = -1;  // Hardware unit number for IRAM-safe LL access in ISR
static gptimer_handle_t gptimer = NULL;
static uint8_t current_duty = 0;
static atomic_uint_fast32_t current_rpm = 0;

// Stall detection state (updated in ISR)
static atomic_uint_fast32_t zero_rpm_count = 0;
static atomic_bool stall_detected = false;
static atomic_uint_fast32_t startup_grace_countdown = 0;  // ISR decrements; stall detection disabled while >0

// Health tracking
static fan_health_t health = {0};
static portMUX_TYPE health_spinlock = portMUX_INITIALIZER_UNLOCKED;

// Auto mode state (accessed from main loop and HTTP server task)
static atomic_int current_mode = FAN_MODE_MANUAL;
static atomic_uint_fast8_t auto_target_speed = AUTO_SPEED_MIN;
static atomic_uint_fast8_t auto_ramped_speed = AUTO_SPEED_MIN;
static atomic_int_fast64_t manual_mode_start_us = 0;

// =============================================================================
// Timer ISR - RPM Calculation and Stall Detection
// =============================================================================

/**
 * @brief Timer ISR callback - calculates RPM and monitors for stall
 * Runs in ISR context for minimal overhead
 */
static bool IRAM_ATTR rpm_timer_isr(gptimer_handle_t timer, const gptimer_alarm_event_data_t *edata, void *user_ctx)
{
    // Use IRAM-safe LL register access instead of driver API (which may live in flash)
    int pulse_count = pcnt_ll_get_count(&PCNT, pcnt_unit_id);
    pcnt_ll_clear_count(&PCNT, pcnt_unit_id);

    // Calculate RPM: (pulses per second * 60) / pulses per revolution
    uint32_t rpm = (pulse_count * 60) / PULSES_PER_REV;
    atomic_store(&current_rpm, rpm);

    // Handle startup grace period (decremented each ISR tick)
    // Use CAS to avoid race with fan_set_speed_duty() setting a new grace period
    uint32_t grace = atomic_load(&startup_grace_countdown);
    if (grace > 0) {
        atomic_compare_exchange_strong(&startup_grace_countdown, &grace, grace - 1);
    }

    // Stall detection logic (disabled during startup grace period)
    if (grace == 0 && rpm == 0 && current_duty >= MIN_DUTY_FOR_STALL) {
        uint32_t count = atomic_load(&zero_rpm_count) + 1;
        atomic_store(&zero_rpm_count, count);

        if (count >= STALL_SAMPLES && !atomic_load(&stall_detected)) {
            atomic_store(&stall_detected, true);
        }
    } else {
        // Reset stall detection on any RPM reading
        atomic_store(&zero_rpm_count, 0);
        if (rpm > 0) {
            atomic_store(&stall_detected, false);
        }
    }

    return false;  // No need to yield to higher priority task
}

// =============================================================================
// Initialization
// =============================================================================

esp_err_t fan_controller_init(void)
{
    ESP_LOGI(TAG, "Initializing fan controller");
    ESP_LOGI(TAG, "  PWM output: GPIO %d (%d Hz)", PWM_GPIO, PWM_FREQUENCY);
    ESP_LOGI(TAG, "  Tach input: GPIO %d", TACH_GPIO);

    // === Configure PWM (LEDC) ===
    ledc_timer_config_t ledc_timer = {
        .speed_mode      = LEDC_LOW_SPEED_MODE,
        .timer_num       = LEDC_TIMER_0,
        .duty_resolution = PWM_RESOLUTION,
        .freq_hz         = PWM_FREQUENCY,
        .clk_cfg         = LEDC_AUTO_CLK
    };
    ESP_RETURN_ON_ERROR(ledc_timer_config(&ledc_timer), TAG, "LEDC timer config failed");

    ledc_channel_config_t ledc_channel = {
        .speed_mode = LEDC_LOW_SPEED_MODE,
        .channel    = LEDC_CHANNEL_0,
        .timer_sel  = LEDC_TIMER_0,
        .intr_type  = LEDC_INTR_DISABLE,
        .gpio_num   = PWM_GPIO,
        .duty       = 0,
        .hpoint     = 0
    };
    ESP_RETURN_ON_ERROR(ledc_channel_config(&ledc_channel), TAG, "LEDC channel config failed");

    // === Configure Tachometer GPIO ===
    gpio_config_t tach_gpio_config = {
        .pin_bit_mask = (1ULL << TACH_GPIO),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_RETURN_ON_ERROR(gpio_config(&tach_gpio_config), TAG, "Tach GPIO config failed");

    // === Configure PCNT for pulse counting ===
    pcnt_unit_config_t pcnt_config = {
        .high_limit = 32767,
        .low_limit  = -32768,
    };
    ESP_RETURN_ON_ERROR(pcnt_new_unit(&pcnt_config, &pcnt_unit), TAG, "PCNT unit create failed");
    pcnt_unit_id = 0;  // First (and only) PCNT allocation — unit 0 guaranteed

    pcnt_glitch_filter_config_t filter_config = {
        .max_glitch_ns = GLITCH_FILTER_NS,
    };
    ESP_RETURN_ON_ERROR(pcnt_unit_set_glitch_filter(pcnt_unit, &filter_config), TAG,
                        "PCNT glitch filter failed");

    pcnt_chan_config_t chan_config = {
        .edge_gpio_num  = TACH_GPIO,
        .level_gpio_num = -1,
    };
    pcnt_channel_handle_t pcnt_chan = NULL;
    ESP_RETURN_ON_ERROR(pcnt_new_channel(pcnt_unit, &chan_config, &pcnt_chan), TAG,
                        "PCNT channel create failed");

    ESP_RETURN_ON_ERROR(pcnt_channel_set_edge_action(pcnt_chan,
        PCNT_CHANNEL_EDGE_ACTION_INCREASE,
        PCNT_CHANNEL_EDGE_ACTION_HOLD), TAG, "PCNT edge action failed");

    ESP_RETURN_ON_ERROR(pcnt_unit_enable(pcnt_unit), TAG, "PCNT enable failed");

    pcnt_unit_clear_count(pcnt_unit);
    pcnt_unit_start(pcnt_unit);

    // === Configure GPTimer for RPM measurement ===
    gptimer_config_t timer_config = {
        .clk_src = GPTIMER_CLK_SRC_DEFAULT,
        .direction = GPTIMER_COUNT_UP,
        .resolution_hz = TIMER_RESOLUTION_HZ,
    };
    ESP_RETURN_ON_ERROR(gptimer_new_timer(&timer_config, &gptimer), TAG, "GPTimer create failed");

    // Configure alarm to fire every 1 second with auto-reload
    gptimer_alarm_config_t alarm_config = {
        .alarm_count = RPM_UPDATE_US,
        .reload_count = 0,
        .flags.auto_reload_on_alarm = true,
    };
    ESP_RETURN_ON_ERROR(gptimer_set_alarm_action(gptimer, &alarm_config), TAG,
                        "GPTimer alarm config failed");

    // Register ISR callback
    gptimer_event_callbacks_t cbs = {
        .on_alarm = rpm_timer_isr,
    };
    ESP_RETURN_ON_ERROR(gptimer_register_event_callbacks(gptimer, &cbs, NULL), TAG,
                        "GPTimer callback register failed");

    ESP_RETURN_ON_ERROR(gptimer_enable(gptimer), TAG, "GPTimer enable failed");
    ESP_RETURN_ON_ERROR(gptimer_start(gptimer), TAG, "GPTimer start failed");

    // Initialize health status
    health.is_healthy = true;

    ESP_LOGI(TAG, "Fan controller initialized (stall detection enabled)");
    return ESP_OK;
}

// =============================================================================
// Speed Control
// =============================================================================

void fan_set_speed_percent(uint8_t percent)
{
    if (percent > 100) percent = 100;
    uint8_t duty = (percent * PWM_MAX_DUTY) / 100;
    fan_set_speed_duty(duty);
}

void fan_set_speed_duty(uint8_t duty)
{
    uint8_t prev_duty = current_duty;
    current_duty = duty;
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, duty);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);

    // Reset stall detection when duty changes significantly
    if (duty < MIN_DUTY_FOR_STALL) {
        atomic_store(&zero_rpm_count, 0);
        atomic_store(&stall_detected, false);
    }

    // Start grace period when fan is turned on (duty crosses threshold upward)
    if (prev_duty < MIN_DUTY_FOR_STALL && duty >= MIN_DUTY_FOR_STALL) {
        atomic_store(&startup_grace_countdown, STARTUP_GRACE_SEC);
        atomic_store(&zero_rpm_count, 0);
        ESP_LOGI(TAG, "Fan starting, %d sec grace period before stall detection", STARTUP_GRACE_SEC);
    }
}

// =============================================================================
// Status Queries
// =============================================================================

uint32_t fan_get_rpm(void)
{
    taskENTER_CRITICAL(&health_spinlock);
    health.rpm_samples++;
    taskEXIT_CRITICAL(&health_spinlock);
    return atomic_load(&current_rpm);
}

uint8_t fan_get_speed_percent(void)
{
    return (current_duty * 100 + PWM_MAX_DUTY / 2) / PWM_MAX_DUTY;
}

bool fan_is_stalled(void)
{
    bool stalled = atomic_load(&stall_detected);

    // Update health status
    taskENTER_CRITICAL(&health_spinlock);
    if (stalled && !health.is_stalled) {
        health.stall_events++;
        health.is_stalled = true;
        health.is_healthy = false;
        taskEXIT_CRITICAL(&health_spinlock);
        ESP_LOGW(TAG, "Fan stall detected (duty=%d, rpm=0)", current_duty);
    } else if (!stalled && health.is_stalled) {
        health.is_stalled = false;
        health.is_healthy = true;
        taskEXIT_CRITICAL(&health_spinlock);
        ESP_LOGI(TAG, "Fan recovered from stall");
    } else {
        taskEXIT_CRITICAL(&health_spinlock);
    }

    return stalled;
}

// =============================================================================
// Stall Recovery
// =============================================================================

esp_err_t fan_recover_stall(void)
{
    if (!atomic_load(&stall_detected)) {
        return ESP_OK;  // Not stalled
    }

    ESP_LOGW(TAG, "Attempting fan stall recovery");
    taskENTER_CRITICAL(&health_spinlock);
    health.recovery_attempts++;
    taskEXIT_CRITICAL(&health_spinlock);

    uint8_t original_duty = current_duty;

    // Step 1: Stop fan completely
    fan_set_speed_duty(0);
    vTaskDelay(pdMS_TO_TICKS(100));

    // Step 2: Full-speed burst to overcome static friction
    fan_set_speed_duty(PWM_MAX_DUTY);
    vTaskDelay(pdMS_TO_TICKS(RECOVERY_BURST_MS));

    // Step 3: Return to original speed
    fan_set_speed_duty(original_duty);

    // Reset stall detection and give fan time to spin up
    atomic_store(&zero_rpm_count, 0);
    atomic_store(&stall_detected, false);
    atomic_store(&startup_grace_countdown, STARTUP_GRACE_SEC);

    // Resync ramped speed so auto ramp resumes from actual speed after recovery
    atomic_store(&auto_ramped_speed, fan_get_speed_percent());

    ESP_LOGI(TAG, "Stall recovery sequence completed, %d sec grace period", STARTUP_GRACE_SEC);
    return ESP_OK;
}

// =============================================================================
// Health Monitoring
// =============================================================================

void fan_get_health(fan_health_t *health_out)
{
    if (health_out) {
        taskENTER_CRITICAL(&health_spinlock);
        health.is_stalled = atomic_load(&stall_detected);
        *health_out = health;
        taskEXIT_CRITICAL(&health_spinlock);
    }
}

void fan_reset_health(void)
{
    taskENTER_CRITICAL(&health_spinlock);
    memset(&health, 0, sizeof(health));
    health.is_healthy = true;
    health.is_stalled = atomic_load(&stall_detected);
    taskEXIT_CRITICAL(&health_spinlock);
}

// =============================================================================
// Auto Mode Control
// =============================================================================

fan_mode_t fan_get_mode(void)
{
    return (fan_mode_t)atomic_load(&current_mode);
}

void fan_set_mode(fan_mode_t mode)
{
    if (mode != FAN_MODE_MANUAL && mode != FAN_MODE_AUTO) {
        ESP_LOGW(TAG, "Invalid mode %d, ignoring", mode);
        return;
    }

    fan_mode_t old_mode = (fan_mode_t)atomic_load(&current_mode);
    atomic_store(&current_mode, mode);

    if (old_mode != mode) {
        ESP_LOGI(TAG, "Fan mode changed: %s -> %s",
                 old_mode == FAN_MODE_AUTO ? "AUTO" : "MANUAL",
                 mode == FAN_MODE_AUTO ? "AUTO" : "MANUAL");

        if (mode == FAN_MODE_MANUAL) {
            // Record when we entered manual mode for timeout tracking
            atomic_store(&manual_mode_start_us, esp_timer_get_time());
        } else {
            // Switching to AUTO - seed ramped speed from current duty so ramp is seamless
            atomic_store(&auto_ramped_speed, fan_get_speed_percent());
        }
    } else if (mode == FAN_MODE_MANUAL) {
        // Already in manual mode but got another manual command - reset timeout
        atomic_store(&manual_mode_start_us, esp_timer_get_time());
    }
}

void fan_auto_update(float pm2_5)
{
    // Only process in AUTO mode
    if ((fan_mode_t)atomic_load(&current_mode) != FAN_MODE_AUTO) {
        return;
    }

    // Compute target speed via linear mapping (hold previous target on sensor error)
    if (pm2_5 >= 0) {
        float t = (pm2_5 - AUTO_PM25_FLOOR) / (AUTO_PM25_CEILING - AUTO_PM25_FLOOR);
        if (t < 0.0f) t = 0.0f;
        if (t > 1.0f) t = 1.0f;
        uint8_t target = AUTO_SPEED_MIN + (uint8_t)(t * (AUTO_SPEED_MAX - AUTO_SPEED_MIN) + 0.5f);

        uint8_t prev_target = (uint8_t)atomic_load(&auto_target_speed);
        if (target != prev_target) {
            ESP_LOGI(TAG, "AUTO mode: PM2.5=%.1f -> target %d%%", pm2_5, target);
            atomic_store(&auto_target_speed, target);
        }
    }

    // Slew limiter: move ramped speed toward target by at most AUTO_SLEW_RATE per call
    uint8_t target = (uint8_t)atomic_load(&auto_target_speed);
    uint8_t ramped = (uint8_t)atomic_load(&auto_ramped_speed);

    if (ramped < target) {
        uint8_t step = target - ramped;
        if (step > AUTO_SLEW_RATE) step = AUTO_SLEW_RATE;
        ramped += step;
    } else if (ramped > target) {
        uint8_t step = ramped - target;
        if (step > AUTO_SLEW_RATE) step = AUTO_SLEW_RATE;
        ramped -= step;
    } else {
        return;  // Already at target, nothing to do
    }

    atomic_store(&auto_ramped_speed, ramped);
    fan_set_speed_percent(ramped);
}

uint8_t fan_get_target_speed(void)
{
    return (uint8_t)atomic_load(&auto_target_speed);
}

void fan_check_auto_timeout(void)
{
    // Only check if we're in manual mode
    if ((fan_mode_t)atomic_load(&current_mode) != FAN_MODE_MANUAL) {
        return;
    }

    // Check if timeout has elapsed
    int64_t now = esp_timer_get_time();
    int64_t elapsed_us = now - atomic_load(&manual_mode_start_us);
    int64_t timeout_us = (int64_t)MANUAL_TIMEOUT_SEC * 1000000;

    if (elapsed_us >= timeout_us) {
        ESP_LOGI(TAG, "Manual mode timeout (%d hours) - returning to AUTO mode",
                 MANUAL_TIMEOUT_SEC / 3600);
        fan_set_mode(FAN_MODE_AUTO);
    }
}

int32_t fan_get_manual_remaining_sec(void)
{
    if ((fan_mode_t)atomic_load(&current_mode) != FAN_MODE_MANUAL) {
        return -1;
    }

    int64_t now = esp_timer_get_time();
    int64_t elapsed_us = now - atomic_load(&manual_mode_start_us);
    int64_t timeout_us = (int64_t)MANUAL_TIMEOUT_SEC * 1000000;
    int64_t remaining_us = timeout_us - elapsed_us;

    if (remaining_us <= 0) return 0;
    return (int32_t)(remaining_us / 1000000);
}
