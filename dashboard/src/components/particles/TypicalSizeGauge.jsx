export default function TypicalSizeGauge({ typicalSize }) {
  if (typicalSize == null) return null;

  // Map typical_size (0–10 µm) to position (0–100%)
  // Use log scale: most meaningful range is 0.1–10 µm
  const clampedSize = Math.max(0.1, Math.min(10, typicalSize));
  const position = (Math.log10(clampedSize) - Math.log10(0.1)) / (Math.log10(10) - Math.log10(0.1)) * 100;

  // Zone boundaries (log scale percentages)
  const zones = [
    { label: 'Ultrafine', end: 35, color: '#f38ba8' },
    { label: 'Fine', end: 55, color: '#fab387' },
    { label: 'Medium', end: 75, color: '#f9e2af' },
    { label: 'Coarse', end: 100, color: '#89b4fa' },
  ];

  return (
    <div className="bg-surface rounded-xl p-4 sm:p-5">
      <p className="text-xs sm:text-sm font-medium text-subtext uppercase tracking-wider mb-4">Typical Particle Size</p>

      {/* Gauge bar */}
      <div className="relative h-4 flex items-center">
        {/* Background gradient */}
        <div className="absolute inset-x-0 h-3 rounded-full overflow-hidden flex">
          {zones.map((zone, i) => {
            const start = i === 0 ? 0 : zones[i - 1].end;
            const width = zone.end - start;
            return (
              <div
                key={i}
                className="h-full"
                style={{ width: `${width}%`, backgroundColor: zone.color, opacity: 0.4 }}
              />
            );
          })}
        </div>

        {/* Zone dividers */}
        {zones.slice(0, -1).map((zone, i) => (
          <div
            key={i}
            className="absolute h-5 border-l border-surface-1/50"
            style={{ left: `${zone.end}%` }}
          />
        ))}

        {/* Ball marker */}
        <div
          className="absolute -translate-x-1/2 transition-all duration-500"
          style={{ left: `${Math.min(100, Math.max(0, position))}%` }}
        >
          <div className="w-4 h-4 rounded-full bg-text border-2 border-base shadow-lg" />
        </div>
      </div>

      {/* Zone labels */}
      <div className="flex mt-3">
        {zones.map((zone, i) => {
          const start = i === 0 ? 0 : zones[i - 1].end;
          const width = zone.end - start;
          return (
            <div key={i} className="text-center" style={{ width: `${width}%` }}>
              <span className="text-xs text-overlay">{zone.label}</span>
            </div>
          );
        })}
      </div>

      {/* Numeric value */}
      <p className="text-center mt-3">
        <span className="text-2xl font-bold text-text tabular-nums">{typicalSize.toFixed(2)}</span>
        <span className="text-sm text-overlay ml-1">µm</span>
      </p>
    </div>
  );
}
