import { useQuery } from '@tanstack/react-query';
import { Cpu, Wifi, HardDrive, Clock, Globe, Activity, Radio, RotateCcw, AlertTriangle, BarChart3 } from 'lucide-react';
import { getInfo, getOta } from '../api/esp32';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-1 last:border-b-0 [&:nth-last-child(2)]:lg:border-b-0">
      <Icon className="w-4 h-4 text-overlay" />
      <span className="text-sm text-subtext flex-1">{label}</span>
      <span className="text-sm font-medium text-text">{value}</span>
    </div>
  );
}

export default function SystemInfo({ health }) {
  const { data: info } = useQuery({
    queryKey: ['info'],
    queryFn: getInfo,
    refetchInterval: 10000,
  });

  const { data: ota } = useQuery({
    queryKey: ['ota'],
    queryFn: getOta,
    refetchInterval: 5000,
  });

  const formatBytes = (bytes) => {
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  return (
    <Card className="p-4 sm:p-6 border-surface-1 overflow-hidden">
      <h3 className="text-lg font-semibold text-text mb-4">System Info</h3>

      {/* Info Grid */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8">
        {info && (
          <>
            <InfoItem icon={Cpu} label="Device" value={info.device} />
            <InfoItem icon={Activity} label="Version" value={info.version} />
            <InfoItem icon={Clock} label="Uptime" value={info.uptime} />
            <InfoItem icon={Radio} label="NTP Time" value={info.time_synced ? info.current_time : 'Not synced'} />
            <InfoItem icon={Globe} label="IP Address" value={info.ip} />
            <InfoItem icon={HardDrive} label="Free Heap" value={`${formatBytes(info.free_heap)} (min: ${formatBytes(info.min_free_heap)})`} />
          </>
        )}
        {info && (
          <InfoItem icon={RotateCcw} label="Reset Reason" value={info.reset_reason} />
        )}
        {health?.wifi && (
          <>
            <InfoItem icon={Wifi} label="WiFi Signal" value={`${health.wifi.rssi} dBm`} />
            {health.wifi.disconnect_count > 0 && (
              <InfoItem icon={AlertTriangle} label="WiFi Disconnects" value={health.wifi.disconnect_count} />
            )}
          </>
        )}
        {health?.sensor && (
          <InfoItem
            icon={BarChart3}
            label="Sensor Reads"
            value={`${health.sensor.successful_reads}/${health.sensor.total_reads}${health.sensor.crc_errors > 0 ? ` (${health.sensor.crc_errors} CRC err)` : ''}`}
          />
        )}
        {ota && (
          <InfoItem icon={HardDrive} label="OTA Partition" value={ota.partition} />
        )}
      </div>

      {/* Health Status */}
      {health && (
        <div className="pt-4 border-t border-surface-1">
          <h4 className="text-sm font-medium text-subtext uppercase tracking-wider mb-3">Health Status</h4>

          <div className="flex flex-wrap gap-2">
            {health.sensor && (
              <Badge variant={health.sensor.healthy ? 'good' : 'poor'}>
                Sensor {health.sensor.healthy ? 'OK' : 'Error'}
              </Badge>
            )}
            {health.fan && (
              <Badge variant={health.fan.healthy ? 'good' : 'poor'}>
                Fan {health.fan.healthy ? 'OK' : 'Error'}
              </Badge>
            )}
            {health.wifi && (
              <Badge variant={health.wifi.connected ? 'good' : 'poor'}>
                WiFi {health.wifi.connected ? 'OK' : 'Error'}
              </Badge>
            )}
            {info && (
              <Badge variant={info.time_synced ? 'good' : 'moderate'}>
                NTP {info.time_synced ? 'Synced' : 'Pending'}
              </Badge>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
