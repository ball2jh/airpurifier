import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { BIN_LABELS } from '@/utils/particleSource';

const ROWS = 5;
const HEIGHT = 200;

// Heatmap color: dark → green → yellow → red
function heatColor(intensity) {
  // intensity 0..1
  const t = Math.max(0, Math.min(1, intensity));
  if (t === 0) return [24, 24, 37]; // #181825 (mantle)
  if (t < 0.33) {
    const p = t / 0.33;
    return [
      24 + (166 - 24) * p,
      24 + (227 - 24) * p,
      37 + (161 - 37) * p,
    ]; // mantle → green #a6e3a1
  }
  if (t < 0.66) {
    const p = (t - 0.33) / 0.33;
    return [
      166 + (249 - 166) * p,
      227 + (226 - 227) * p,
      161 + (175 - 161) * p,
    ]; // green → yellow #f9e2af
  }
  const p = (t - 0.66) / 0.34;
  return [
    249 + (243 - 249) * p,
    226 + (139 - 226) * p,
    175 + (168 - 175) * p,
  ]; // yellow → red #f38ba8
}

function drawHeatmap(canvas, container, grid, binMaxes) {
  const dpr = window.devicePixelRatio || 1;
  const width = container.getBoundingClientRect().width;

  canvas.width = width * dpr;
  canvas.height = HEIGHT * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${HEIGHT}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cols = grid.length;
  const cellW = width / cols;
  const cellH = HEIGHT / ROWS;

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < ROWS; y++) {
      // y=0 is coarse (top), y=4 is ultrafine (bottom) — reverse bin order
      const binIdx = 4 - y;
      const intensity = grid[x][binIdx] / binMaxes[binIdx];
      const [r, g, b] = heatColor(intensity);
      ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
      ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
    }
  }
}

export default function HeatmapCanvas({ samples }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  // Compute differential bins for each sample + per-bin max for normalization
  const { grid, binMaxes, timestamps } = useMemo(() => {
    if (!samples?.length) return { grid: [], binMaxes: [1, 1, 1, 1, 1], timestamps: [] };

    const maxes = [0, 0, 0, 0, 0];
    const g = samples.map(s => {
      const nc0_5 = s.nc_pm0_5 ?? 0;
      const nc1_0 = s.nc_pm1_0 ?? 0;
      const nc2_5 = s.nc_pm2_5 ?? 0;
      const nc4_0 = s.nc_pm4_0 ?? 0;
      const nc10 = s.nc_pm10 ?? 0;

      const bins = [
        Math.max(0, nc0_5),
        Math.max(0, nc1_0 - nc0_5),
        Math.max(0, nc2_5 - nc1_0),
        Math.max(0, nc4_0 - nc2_5),
        Math.max(0, nc10 - nc4_0),
      ];
      bins.forEach((v, i) => { if (v > maxes[i]) maxes[i] = v; });
      return bins;
    });

    return {
      grid: g,
      binMaxes: maxes.map(m => m || 1),
      timestamps: samples.map(s => s.timestamp),
    };
  }, [samples]);

  // Draw canvas + redraw on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || grid.length === 0) return;

    drawHeatmap(canvas, container, grid, binMaxes);

    let timeout;
    const ro = new ResizeObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => drawHeatmap(canvas, container, grid, binMaxes), 100);
    });
    ro.observe(container);
    return () => { ro.disconnect(); clearTimeout(timeout); };
  }, [grid, binMaxes]);

  const handleMouseMove = useCallback((e) => {
    if (grid.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x / rect.width) * grid.length);
    const row = Math.floor((y / rect.height) * ROWS);

    if (col < 0 || col >= grid.length || row < 0 || row >= ROWS) {
      setTooltip(null);
      return;
    }

    const binIdx = 4 - row;
    const ts = timestamps[col];
    const date = new Date(ts * 1000);
    const timeStr = date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      label: BIN_LABELS[binIdx],
      value: grid[col][binIdx].toFixed(1),
      time: timeStr,
    });
  }, [grid, timestamps]);

  if (grid.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-overlay">
        No particle count data for this time range
      </div>
    );
  }

  // Reversed labels for y-axis: coarse at top, ultrafine at bottom
  const yLabels = [...BIN_LABELS].reverse();

  return (
    <div className="relative">
      <div className="flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-2 py-0" style={{ height: HEIGHT }}>
          {yLabels.map((label, i) => (
            <span key={i} className="text-xs text-overlay leading-none flex items-center" style={{ height: 40 }}>
              {label}
            </span>
          ))}
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="rounded-lg cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          />
          {tooltip && (
            <div
              className="absolute pointer-events-none bg-surface border border-surface-1 rounded-lg p-2 shadow-lg z-10"
              style={{
                left: Math.min(tooltip.x + 12, (containerRef.current?.getBoundingClientRect().width || 300) - 150),
                top: Math.max(tooltip.y - 60, 0),
              }}
            >
              <p className="text-xs text-overlay">{tooltip.time}</p>
              <p className="text-xs text-text font-medium">{tooltip.label}: {tooltip.value} #/cm³</p>
            </div>
          )}
        </div>
      </div>

      {/* Color scale legend */}
      <div className="flex items-center justify-end gap-2 mt-2">
        <span className="text-xs text-overlay">Low</span>
        <div className="w-24 h-2 rounded-full" style={{
          background: 'linear-gradient(to right, #181825, #a6e3a1, #f9e2af, #f38ba8)',
        }} />
        <span className="text-xs text-overlay">High</span>
      </div>
    </div>
  );
}
