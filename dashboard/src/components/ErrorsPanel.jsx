export default function ErrorsPanel({ health }) {
  const ds = health?.sensor?.device_status;
  const hasDeviceStatus = ds && (
    ds.fan_speed_warning || ds.fan_cleaning || ds.gas_sensor_error ||
    ds.rht_error || ds.laser_failure || ds.fan_failure
  );
  const hasErrors = health && (
    health.sensor?.crc_errors > 0 ||
    health.sensor?.i2c_errors > 0 ||
    health.sensor?.busy_skips?.count > 0 ||
    health.fan?.stall_events > 0 ||
    health.wifi?.disconnect_count > 0 ||
    hasDeviceStatus
  );

  return (
    <div className="bg-surface rounded-xl p-6">
      <h2 className="text-xl font-semibold text-text mb-6">Error Log</h2>

      {!health && <p className="text-center text-overlay py-8">Loading health data...</p>}

      {health && !hasErrors && (
        <div className="text-center py-12 text-green">
          <span className="text-4xl block mb-4">&#10003;</span>
          <p className="text-lg">No errors recorded</p>
        </div>
      )}

      {hasDeviceStatus && (
        <div className="mb-6 p-4 bg-mantle rounded-lg">
          <h3 className="text-base font-medium text-text border-b border-surface-1 pb-2 mb-4">Device Status</h3>
          <div className="flex flex-wrap gap-2">
            {ds.fan_cleaning && (
              <span className="px-3 py-1.5 text-sm font-medium rounded-lg bg-yellow text-base">Fan Cleaning</span>
            )}
            {ds.fan_speed_warning && (
              <span className="px-3 py-1.5 text-sm font-medium rounded-lg bg-yellow text-base">Fan Speed Warning</span>
            )}
            {ds.gas_sensor_error && (
              <span className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red text-base">Gas Sensor Error</span>
            )}
            {ds.rht_error && (
              <span className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red text-base">RHT Error</span>
            )}
            {ds.laser_failure && (
              <span className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red text-base">Laser Failure</span>
            )}
            {ds.fan_failure && (
              <span className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red text-base">Fan Failure</span>
            )}
          </div>
        </div>
      )}

      {health?.sensor && (health.sensor.crc_errors > 0 || health.sensor.i2c_errors > 0 || health.sensor.busy_skips?.count > 0) && (
        <div className="mb-6 p-4 bg-mantle rounded-lg">
          <h3 className="text-base font-medium text-text border-b border-surface-1 pb-2 mb-4">Sensor Errors</h3>
          <div className="flex flex-wrap gap-6">
            {health.sensor.crc_errors > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-overlay uppercase">CRC Errors</span>
                <span className="text-2xl font-semibold text-red">{health.sensor.crc_errors}</span>
                {health.sensor.last_crc_error && (
                  <span className="text-xs text-overlay">
                    Last: {health.sensor.last_crc_error.field} at read #{health.sensor.last_crc_error.read_number}
                  </span>
                )}
              </div>
            )}
            {health.sensor.i2c_errors > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-overlay uppercase">I2C Errors</span>
                <span className="text-2xl font-semibold text-red">{health.sensor.i2c_errors}</span>
              </div>
            )}
            {health.sensor.busy_skips?.count > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-overlay uppercase">Busy Skips</span>
                <span className="text-2xl font-semibold text-yellow">{health.sensor.busy_skips.count}</span>
              </div>
            )}
            {health.sensor.recoveries > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-overlay uppercase">Recovery Attempts</span>
                <span className="text-2xl font-semibold text-yellow">{health.sensor.recoveries}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {health?.fan && health.fan.stall_events > 0 && (
        <div className="mb-6 p-4 bg-mantle rounded-lg">
          <h3 className="text-base font-medium text-text border-b border-surface-1 pb-2 mb-4">Fan Errors</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Stall Events</span>
              <span className="text-2xl font-semibold text-red">{health.fan.stall_events}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Recovery Attempts</span>
              <span className="text-2xl font-semibold text-yellow">{health.fan.recovery_attempts}</span>
            </div>
          </div>
        </div>
      )}

      {health?.wifi && health.wifi.disconnect_count > 0 && (
        <div className="mb-6 p-4 bg-mantle rounded-lg">
          <h3 className="text-base font-medium text-text border-b border-surface-1 pb-2 mb-4">WiFi Errors</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Disconnections</span>
              <span className="text-2xl font-semibold text-red">{health.wifi.disconnect_count}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Reconnections</span>
              <span className="text-2xl font-semibold text-text">{health.wifi.connect_count}</span>
            </div>
          </div>
        </div>
      )}

      {health && (
        <div className="mt-6 pt-6 border-t border-surface-1">
          <h3 className="text-base font-medium text-text mb-4">Read Statistics</h3>
          <div className="flex flex-wrap gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Total Reads</span>
              <span className="text-xl font-semibold text-text">{health.sensor?.total_reads || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Successful</span>
              <span className="text-xl font-semibold text-text">{health.sensor?.successful_reads || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-overlay uppercase">Success Rate</span>
              <span className="text-xl font-semibold text-text">
                {health.sensor?.total_reads > 0
                  ? ((health.sensor.successful_reads / health.sensor.total_reads) * 100).toFixed(2)
                  : 0}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
