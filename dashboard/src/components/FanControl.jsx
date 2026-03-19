import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
} from 'recharts';
import { getStatus, setFan, setFanMode } from '../api/esp32';
import { Card } from '@/components/ui/card';
import { useWindowWidth } from './HistoryChart';

// PWM to RPM data from Arctic P14 Pro @ 12V (full dataset)
const PWM_CURVE_DATA = [
  { pwm: 0, rpm: 0 }, { pwm: 1, rpm: 0 }, { pwm: 2, rpm: 0 }, { pwm: 3, rpm: 0 },
  { pwm: 4, rpm: 426 }, { pwm: 5, rpm: 426 }, { pwm: 6, rpm: 426 }, { pwm: 7, rpm: 435 },
  { pwm: 8, rpm: 456 }, { pwm: 9, rpm: 483 }, { pwm: 10, rpm: 501 }, { pwm: 11, rpm: 525 },
  { pwm: 12, rpm: 540 }, { pwm: 13, rpm: 567 }, { pwm: 14, rpm: 588 }, { pwm: 15, rpm: 609 },
  { pwm: 16, rpm: 636 }, { pwm: 17, rpm: 654 }, { pwm: 18, rpm: 681 }, { pwm: 19, rpm: 702 },
  { pwm: 20, rpm: 723 }, { pwm: 21, rpm: 747 }, { pwm: 22, rpm: 774 }, { pwm: 23, rpm: 786 },
  { pwm: 24, rpm: 813 }, { pwm: 25, rpm: 831 }, { pwm: 26, rpm: 855 }, { pwm: 27, rpm: 876 },
  { pwm: 28, rpm: 897 }, { pwm: 29, rpm: 924 }, { pwm: 30, rpm: 945 }, { pwm: 31, rpm: 969 },
  { pwm: 32, rpm: 993 }, { pwm: 33, rpm: 1014 }, { pwm: 34, rpm: 1035 }, { pwm: 35, rpm: 1053 },
  { pwm: 36, rpm: 1074 }, { pwm: 37, rpm: 1098 }, { pwm: 38, rpm: 1122 }, { pwm: 39, rpm: 1146 },
  { pwm: 40, rpm: 1167 }, { pwm: 41, rpm: 1188 }, { pwm: 42, rpm: 1212 }, { pwm: 43, rpm: 1233 },
  { pwm: 44, rpm: 1260 }, { pwm: 45, rpm: 1272 }, { pwm: 46, rpm: 1299 }, { pwm: 47, rpm: 1317 },
  { pwm: 48, rpm: 1344 }, { pwm: 49, rpm: 1365 }, { pwm: 50, rpm: 1386 }, { pwm: 51, rpm: 1413 },
  { pwm: 52, rpm: 1434 }, { pwm: 53, rpm: 1458 }, { pwm: 54, rpm: 1479 }, { pwm: 55, rpm: 1500 },
  { pwm: 56, rpm: 1521 }, { pwm: 57, rpm: 1542 }, { pwm: 58, rpm: 1563 }, { pwm: 59, rpm: 1590 },
  { pwm: 60, rpm: 1611 }, { pwm: 61, rpm: 1635 }, { pwm: 62, rpm: 1656 }, { pwm: 63, rpm: 1677 },
  { pwm: 64, rpm: 1704 }, { pwm: 65, rpm: 1722 }, { pwm: 66, rpm: 1746 }, { pwm: 67, rpm: 1761 },
  { pwm: 68, rpm: 1785 }, { pwm: 69, rpm: 1809 }, { pwm: 70, rpm: 1833 }, { pwm: 71, rpm: 1854 },
  { pwm: 72, rpm: 1875 }, { pwm: 73, rpm: 1899 }, { pwm: 74, rpm: 1923 }, { pwm: 75, rpm: 1944 },
  { pwm: 76, rpm: 1968 }, { pwm: 77, rpm: 1992 }, { pwm: 78, rpm: 2010 }, { pwm: 79, rpm: 2031 },
  { pwm: 80, rpm: 2052 }, { pwm: 81, rpm: 2076 }, { pwm: 82, rpm: 2097 }, { pwm: 83, rpm: 2118 },
  { pwm: 84, rpm: 2145 }, { pwm: 85, rpm: 2172 }, { pwm: 86, rpm: 2190 }, { pwm: 87, rpm: 2214 },
  { pwm: 88, rpm: 2232 }, { pwm: 89, rpm: 2253 }, { pwm: 90, rpm: 2274 }, { pwm: 91, rpm: 2295 },
  { pwm: 92, rpm: 2319 }, { pwm: 93, rpm: 2343 }, { pwm: 94, rpm: 2367 }, { pwm: 95, rpm: 2391 },
  { pwm: 96, rpm: 2409 }, { pwm: 97, rpm: 2436 }, { pwm: 98, rpm: 2457 }, { pwm: 99, rpm: 2472 },
  { pwm: 100, rpm: 2472 },
];

// PQ Curve data - Pressure (mmH2O) vs Airflow (CFM) at max RPM
const PQ_CURVE_DATA = [
  { cfm: 0, pressure: 4.2 }, { cfm: 20, pressure: 3.9 }, { cfm: 40, pressure: 3.4 },
  { cfm: 60, pressure: 3.0 }, { cfm: 80, pressure: 2.2 }, { cfm: 100, pressure: 0.5 },
  { cfm: 107, pressure: 0 },
];

// Get expected RPM from PWM (direct lookup since we have all values)
function getRpmFromPwm(pwm) {
  const rounded = Math.round(Math.max(0, Math.min(100, pwm)));
  return PWM_CURVE_DATA[rounded]?.rpm ?? 0;
}

const PRESETS = [
  { label: 'Off', value: 0 },
  { label: 'Low', value: 25 },
  { label: 'Med', value: 50 },
  { label: 'High', value: 75 },
  { label: 'Max', value: 100 },
];

// Mini arc icon that matches the gauge style
function ArcIcon({ progress, color, isActive }) {
  const size = 20;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const startAngle = 135;
  const sweepAngle = 270;
  const arcLength = circumference * (sweepAngle / 360);
  const dashOffset = arcLength * (1 - progress);

  return (
    <svg width={size} height={size} className="mx-auto mb-1">
      {/* Background track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={isActive ? '#313244' : '#45475a'}
        strokeWidth={strokeWidth}
        strokeDasharray={`${arcLength} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(${startAngle} ${center} ${center})`}
      />
      {/* Progress arc */}
      {progress > 0 && (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${center} ${center})`}
        />
      )}
    </svg>
  );
}

function CircularGauge({ value, onChange, isPending, windowWidth }) {
  const svgRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fanRotation, setFanRotation] = useState(0);

  const size = 180;
  const strokeWidth = 10;
  const radius = (size - strokeWidth - 20) / 2; // Extra padding for knob
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Animate fan rotation - speed scales with value but stays visually pleasant
  useEffect(() => {
    if (value === 0) return;

    let animationId;
    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      // Slow rotation: 0.5 to 2 rotations per second based on value
      const rotationsPerSecond = 0.5 + (value / 100) * 1.5;
      const degreesPerSecond = rotationsPerSecond * 360;
      setFanRotation(prev => (prev + degreesPerSecond * deltaTime) % 360);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [value]);

  // Arc goes from 135° to 405° (270° total sweep)
  const startAngle = 135;
  const sweepAngle = 270;
  const progress = value / 100;
  const arcLength = circumference * (sweepAngle / 360);
  const dashOffset = arcLength * (1 - progress);

  const getValueFromEvent = (e) => {
    if (!svgRef.current) return value;

    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    angle = (angle + 360) % 360;

    // Convert angle to value (135° = 0%, 405°/45° = 100%)
    let normalizedAngle = angle - startAngle;
    if (normalizedAngle < 0) normalizedAngle += 360;
    if (normalizedAngle > sweepAngle) {
      normalizedAngle = normalizedAngle > sweepAngle + 45 ? 0 : sweepAngle;
    }

    return Math.round((normalizedAngle / sweepAngle) * 100);
  };

  const handleStart = (e) => {
    if (isPending) return;
    setIsDragging(true);
    const newValue = getValueFromEvent(e);
    onChange(newValue, false);
  };

  const handleMove = (e) => {
    if (!isDragging || isPending) return;
    e.preventDefault();
    const newValue = getValueFromEvent(e);
    onChange(newValue, false);
  };

  const handleEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      onChange(value, true);
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);

      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, value]);

  // Calculate knob position
  const knobAngle = startAngle + (progress * sweepAngle);
  const knobRad = (knobAngle * Math.PI) / 180;
  const knobX = center + radius * Math.cos(knobRad);
  const knobY = center + radius * Math.sin(knobRad);

  // Color based on speed
  const getColor = () => {
    if (value === 0) return '#6c7086';
    if (value <= 25) return '#a6e3a1';
    if (value <= 50) return '#89b4fa';
    if (value <= 75) return '#f9e2af';
    return '#fab387';
  };

  const color = getColor();

  return (
    <div className="w-[180px] sm:w-[220px] lg:w-[240px]">
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-auto cursor-pointer select-none touch-none"
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      {/* Background track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#313244"
        strokeWidth={strokeWidth}
        strokeDasharray={`${arcLength} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(${startAngle} ${center} ${center})`}
      />

      {/* Progress arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${arcLength} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(${startAngle} ${center} ${center})`}
      />

      {/* Knob */}
      <circle
        cx={knobX}
        cy={knobY}
        r={isPending ? 8 : 12}
        fill={color}
        stroke="#1e1e2e"
        strokeWidth={3}
      />

      {/* Center fan icon */}
      <g transform={`translate(${center}, ${center - 32}) rotate(${fanRotation})`}>
        {[0, 90, 180, 270].map((rotation) => (
          <path
            key={rotation}
            d="M0,-5 Q8,-8 5,-16 Q2,-13 0,-5"
            fill={color}
            opacity={0.9}
            transform={`rotate(${rotation})`}
          />
        ))}
        <circle r={4} fill="#1e1e2e" />
      </g>
    </svg>
    </div>
  );
}

export default function FanControl() {
  const queryClient = useQueryClient();
  const windowWidth = useWindowWidth();
  const [burstMode, setBurstMode] = useState(false);
  const burstTimeout = useRef(null);

  // Burst: 50ms (20/sec) for 5 seconds after adjustment, then 1000ms
  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
    refetchInterval: burstMode ? 50 : 1000,
    refetchOnWindowFocus: false,
  });

  const startBurst = () => {
    setBurstMode(true);
    if (burstTimeout.current) clearTimeout(burstTimeout.current);
    burstTimeout.current = setTimeout(() => setBurstMode(false), 5000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (burstTimeout.current) clearTimeout(burstTimeout.current);
    };
  }, []);

  const fan = status?.fan ?? {};
  const currentSpeed = fan.speed_percent ?? 0;
  const rpm = fan.rpm ?? 0;
  const stalled = fan.stalled;
  const mode = fan.mode ?? 'manual';
  const isAuto = mode === 'auto';
  const targetSpeed = fan.target_speed ?? 0;
  const pm25 = status?.sensor?.pm2_5;

  const [localSpeed, setLocalSpeed] = useState(currentSpeed);
  const [displaySpeed, setDisplaySpeed] = useState(currentSpeed);
  const isDragging = useRef(false);
  const animationRef = useRef(null);

  // Animate the knob smoothly to a target value
  const animateTo = (target, duration = 400) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const start = displaySpeed;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);

      setDisplaySpeed(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplaySpeed(target);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    // Only sync from server when not actively dragging
    if (!isDragging.current && currentSpeed !== undefined) {
      setLocalSpeed(currentSpeed);
      setDisplaySpeed(currentSpeed);
    }
  }, [currentSpeed]);

  const mutation = useMutation({
    mutationFn: setFan,
    onSuccess: () => {
      startBurst();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    }
  });

  const modeMutation = useMutation({
    mutationFn: ({ mode: newMode, speed }) => setFanMode(newMode, speed),
    onMutate: async ({ mode: newMode, speed }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['status'] });
      // Snapshot previous value
      const previousStatus = queryClient.getQueryData(['status']);
      // Optimistically update
      queryClient.setQueryData(['status'], (old) => ({
        ...old,
        fan: {
          ...old?.fan,
          mode: newMode,
          speed_percent: speed ?? old?.fan?.speed_percent,
          target_speed: speed ?? old?.fan?.target_speed,
        }
      }));
      return { previousStatus };
    },
    onSuccess: (data) => {
      // Update with actual server response
      queryClient.setQueryData(['status'], (old) => ({
        ...old,
        fan: {
          ...old?.fan,
          mode: data.mode,
          speed_percent: data.speed_percent,
          target_speed: data.target_speed,
        }
      }));
      startBurst();
    },
    onError: (error, variables, context) => {
      // Roll back on error
      if (context?.previousStatus) {
        queryClient.setQueryData(['status'], context.previousStatus);
      }
      console.error('Mode change failed:', error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    }
  });

  const setManualMode = () => {
    modeMutation.mutate({ mode: 'manual', speed: currentSpeed || 25 });
  };

  const setAutoMode = () => {
    modeMutation.mutate({ mode: 'auto' });
  };

  const handleGaugeChange = (newValue, commit) => {
    if (!commit) {
      isDragging.current = true;
      // While dragging, update both immediately (no animation)
      setLocalSpeed(newValue);
      setDisplaySpeed(newValue);
    } else {
      isDragging.current = false;
      setLocalSpeed(newValue);
      // If in auto mode, switch to manual with the new speed
      if (isAuto) {
        modeMutation.mutate({ mode: 'manual', speed: newValue });
      } else {
        mutation.mutate(newValue);
      }
    }
  };

  const handlePreset = (value) => {
    setLocalSpeed(value);
    animateTo(value); // Smooth animation to new position
    // If in auto mode, switch to manual with the preset value
    if (isAuto) {
      modeMutation.mutate({ mode: 'manual', speed: value });
    } else {
      mutation.mutate(value);
    }
  };

  // Get color for a given value
  const getPresetColor = (value) => {
    if (value === 0) return '#6c7086';
    if (value <= 25) return '#a6e3a1';
    if (value <= 50) return '#89b4fa';
    if (value <= 75) return '#f9e2af';
    return '#fab387';
  };

  const expectedRpm = getRpmFromPwm(localSpeed);
  const currentCfm = rpm > 0 ? Math.round((rpm / 2472) * 107) : 0;

  // PM2.5 thresholds for auto mode display
  const autoThresholds = [
    { max: 5, speed: 25, label: 'Clean' },
    { max: 15, speed: 50, label: 'Light' },
    { max: 25, speed: 75, label: 'Moderate' },
    { max: Infinity, speed: 100, label: 'High' },
  ];

  const currentThreshold = autoThresholds.find(t => (pm25 ?? 0) < t.max) || autoThresholds[3];

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8 border-surface-1">
        {/* Mode Toggle */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={setManualMode}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              !isAuto
                ? 'bg-blue text-base'
                : 'bg-surface text-subtext hover:text-text'
            }`}
          >
            Manual
          </button>
          <button
            onClick={setAutoMode}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              isAuto
                ? 'bg-green text-base'
                : 'bg-surface text-subtext hover:text-text'
            }`}
          >
            Auto
          </button>
        </div>

        <div className="flex flex-col items-center">
          {/* Circular Gauge */}
          <div className="relative mb-4">
            <CircularGauge
              value={displaySpeed}
              onChange={handleGaugeChange}
              isPending={mutation.isPending || modeMutation.isPending}
              windowWidth={windowWidth}
            />

            {/* Center overlay with value */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-6">
              <span className="text-3xl font-bold tabular-nums text-text">
                {displaySpeed}%
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-subtext">{rpm} RPM</span>
                {stalled && (
                  <AlertTriangle className="w-3 h-3 text-red" />
                )}
              </div>
            </div>
          </div>

          {/* Auto Mode: PM2.5 Thresholds */}
          {isAuto && (
            <div className="w-full max-w-xs mb-4">
              <div className="grid grid-cols-4 gap-1 bg-mantle rounded-xl p-1">
                {autoThresholds.map((t, i) => {
                  const isActive = currentThreshold === t;
                  const colors = ['#a6e3a1', '#89b4fa', '#f9e2af', '#fab387'];
                  return (
                    <div
                      key={i}
                      className={`py-2 px-1 text-center rounded-lg transition-all ${
                        isActive ? 'bg-surface shadow-sm' : ''
                      }`}
                    >
                      <div
                        className="text-lg font-bold mb-0.5"
                        style={{ color: isActive ? colors[i] : '#6c7086' }}
                      >
                        {t.speed}%
                      </div>
                      <div className={`text-[10px] ${isActive ? 'text-text' : 'text-overlay'}`}>
                        {t.label}
                      </div>
                      <div className="text-[9px] text-overlay">
                        {i === 0 ? '<5' : i === 3 ? '>25' : `${autoThresholds[i-1]?.max || 0}-${t.max}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manual Mode: Presets */}
          {!isAuto && (
            <div className="flex w-full max-w-xs bg-mantle rounded-xl p-1 gap-1">
              {PRESETS.map(preset => {
                const isActive = localSpeed === preset.value;
                const presetColor = getPresetColor(preset.value);
                return (
                  <button
                    key={preset.value}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                      isActive
                        ? 'bg-surface text-text shadow-sm'
                        : 'text-overlay hover:text-subtext'
                    }`}
                    onClick={() => handlePreset(preset.value)}
                  >
                    <ArcIcon
                      progress={preset.value / 100}
                      color={presetColor}
                      isActive={isActive}
                    />
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Fan Curves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PWM vs RPM Curve */}
        <Card className="p-4 sm:p-6 border-surface-1">
          <h3 className="text-sm font-medium text-text mb-1">PWM vs RPM</h3>
          <p className="text-xs text-overlay mb-4">Arctic P14 Pro @ 12V</p>
          <ResponsiveContainer width="100%" height={windowWidth < 640 ? 180 : 220}>
            <LineChart data={PWM_CURVE_DATA} title="Fan PWM to RPM response curve" margin={{ top: 10, right: 10, bottom: 15, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
              <XAxis
                dataKey="pwm"
                stroke="#6c7086"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                stroke="#6c7086"
                tick={{ fontSize: 10 }}
                domain={[0, 2600]}
                tickFormatter={(v) => v.toLocaleString()}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-surface border border-surface-1 rounded-lg p-3 shadow-lg">
                      <div className="text-xs text-overlay mb-2">PWM: {label}%</div>
                      {payload.map((entry) => (
                        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                          <span className="text-subtext">Speed:</span>
                          <span className="text-text font-medium">{entry.value.toLocaleString()} RPM</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Line
                connectNulls
                type="monotone"
                dataKey="rpm"
                stroke="#89b4fa"
                strokeWidth={2}
                dot={false}
                name="Expected"
              />
              {/* Vertical line at current PWM */}
              {localSpeed > 0 && (
                <ReferenceLine
                  x={localSpeed}
                  stroke="#6c7086"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
              )}
              {/* Predicted RPM dot (on the curve) */}
              {localSpeed > 0 && (
                <ReferenceDot
                  x={localSpeed}
                  y={expectedRpm}
                  r={5}
                  fill="#89b4fa"
                  stroke="#1e1e2e"
                  strokeWidth={2}
                />
              )}
              {/* Actual RPM dot */}
              {localSpeed > 0 && rpm > 0 && (
                <ReferenceDot
                  x={localSpeed}
                  y={rpm}
                  r={7}
                  fill="#a6e3a1"
                  stroke="#1e1e2e"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 text-xs mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue" />
              <span className="text-overlay">Expected: <span className="text-text">{expectedRpm} RPM</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green" />
              <span className="text-overlay">Actual: <span className="text-text">{rpm} RPM</span></span>
            </div>
            {rpm > 0 && Math.abs(rpm - expectedRpm) > 50 && (
              <span className={`${rpm > expectedRpm ? 'text-green' : 'text-yellow'}`}>
                ({rpm > expectedRpm ? '+' : ''}{rpm - expectedRpm})
              </span>
            )}
          </div>
        </Card>

        {/* PQ Curve */}
        <Card className="p-4 sm:p-6 border-surface-1">
          <h3 className="text-sm font-medium text-text mb-1">Pressure vs Airflow</h3>
          <p className="text-xs text-overlay mb-4">Performance at {rpm > 0 ? `${Math.round((rpm / 2472) * 100)}%` : 'max'} speed</p>
          <ResponsiveContainer width="100%" height={windowWidth < 640 ? 180 : 220}>
            <LineChart data={PQ_CURVE_DATA} title="Fan pressure versus airflow curve" margin={{ top: 10, right: 10, bottom: 15, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
              <XAxis
                dataKey="cfm"
                stroke="#6c7086"
                tick={{ fontSize: 10 }}
                label={{ value: 'CFM', position: 'bottom', fontSize: 10, fill: '#6c7086', offset: 0 }}
              />
              <YAxis
                stroke="#6c7086"
                tick={{ fontSize: 10 }}
                domain={[0, 5]}
                label={{ value: 'mmH₂O', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#6c7086' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-surface border border-surface-1 rounded-lg p-3 shadow-lg">
                      {payload.map((entry) => (
                        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                          <span className="text-subtext">{entry.dataKey === 'pressure' ? 'Pressure' : 'Airflow'}:</span>
                          <span className="text-text font-medium">
                            {entry.dataKey === 'pressure' ? `${entry.value} mmH₂O` : `${entry.value} CFM`}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Line
                connectNulls
                type="monotone"
                dataKey="pressure"
                stroke="#cba6f7"
                strokeWidth={2}
                dot={false}
              />
              {rpm > 0 && currentCfm > 0 && (
                <ReferenceLine
                  x={currentCfm}
                  stroke="#a6e3a1"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-center text-overlay mt-2">
            Max: 107 CFM @ 0 pressure | 4.2 mmH₂O @ 0 airflow
          </div>
        </Card>
      </div>
    </div>
  );
}
