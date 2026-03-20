import { useMemo } from 'react';
import { computeDifferentialBins } from '@/utils/particleSource';

export default function DistributionBar({ pmNumber }) {
  const bins = useMemo(() => computeDifferentialBins(pmNumber), [pmNumber]);

  const { total, percentages } = useMemo(() => {
    if (!bins) return { total: 0, percentages: [] };
    const t = bins.reduce((s, b) => s + b.count, 0);
    return { total: t, percentages: bins.map(b => (b.count / t) * 100) };
  }, [bins]);

  if (!bins || total === 0) return null;

  // Only show bins with nonzero counts in the bar
  const visibleBins = bins.map((bin, i) => ({ ...bin, pct: percentages[i], idx: i })).filter(b => b.pct > 0);

  return (
    <div className="bg-surface rounded-xl p-4 sm:p-5">
      <p className="text-xs sm:text-sm font-medium text-subtext uppercase tracking-wider mb-4">Size Distribution</p>

      {/* SVG stacked bar */}
      <svg viewBox="0 0 400 32" className="w-full" preserveAspectRatio="none">
        <defs>
          <clipPath id="bar-clip">
            <rect x="0" y="0" width="400" height="32" rx="6" ry="6" />
          </clipPath>
        </defs>
        <g clipPath="url(#bar-clip)">
          {(() => {
            let x = 0;
            return visibleBins.map((bin, i) => {
              const width = (bin.pct / 100) * 400;
              const el = (
                <g key={bin.idx}>
                  <rect x={x} y={0} width={width} height={32} fill={bin.color} />
                  {width > 30 && (
                    <text
                      x={x + width / 2}
                      y={20}
                      textAnchor="middle"
                      fill="#1e1e2e"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {bin.pct.toFixed(0)}%
                    </text>
                  )}
                </g>
              );
              x += width;
              return el;
            });
          })()}
        </g>
      </svg>

      {/* Bin labels — all 5 bins always shown for context */}
      <div className="flex mt-3 gap-1">
        {bins.map((bin, i) => (
          <div key={i} className="flex-1 text-center">
            <div className="flex items-center justify-center gap-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: bin.color, opacity: percentages[i] > 0 ? 1 : 0.3 }}
              />
              <span className={`text-xs truncate ${percentages[i] > 0 ? 'text-overlay' : 'text-overlay/40'}`}>
                {bin.shortLabel}
              </span>
            </div>
            <p className={`text-base tabular-nums mt-0.5 ${percentages[i] > 0 ? 'text-subtext' : 'text-overlay/40'}`}>
              {bin.count.toFixed(0)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
