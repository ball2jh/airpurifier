// Compute differential size bins from cumulative NC values
// SEN55 reports cumulative: nc_pm0_5 <= nc_pm1_0 <= nc_pm2_5 <= nc_pm4_0 <= nc_pm10
export function computeDifferentialBins(pmNumber) {
  if (!pmNumber) return null;

  const { nc_pm0_5, nc_pm1_0, nc_pm2_5, nc_pm4_0, nc_pm10 } = pmNumber;
  if (nc_pm0_5 == null || nc_pm10 == null) return null;

  return [
    { label: '< 0.5 µm', shortLabel: '< 0.5', count: Math.max(0, nc_pm0_5 ?? 0), color: '#f38ba8' },
    { label: '0.5–1 µm', shortLabel: '0.5–1', count: Math.max(0, (nc_pm1_0 ?? 0) - (nc_pm0_5 ?? 0)), color: '#fab387' },
    { label: '1–2.5 µm', shortLabel: '1–2.5', count: Math.max(0, (nc_pm2_5 ?? 0) - (nc_pm1_0 ?? 0)), color: '#f9e2af' },
    { label: '2.5–4 µm', shortLabel: '2.5–4', count: Math.max(0, (nc_pm4_0 ?? 0) - (nc_pm2_5 ?? 0)), color: '#89dceb' },
    { label: '4–10 µm', shortLabel: '4–10', count: Math.max(0, (nc_pm10 ?? 0) - (nc_pm4_0 ?? 0)), color: '#89b4fa' },
  ];
}

// BIN_COLORS exported for use in charts
export const BIN_COLORS = ['#f38ba8', '#fab387', '#f9e2af', '#89dceb', '#89b4fa'];
export const BIN_LABELS = ['< 0.5 µm', '0.5–1 µm', '1–2.5 µm', '2.5–4 µm', '4–10 µm'];
export const BIN_SHORT_LABELS = ['< 0.5', '0.5–1', '1–2.5', '2.5–4', '4–10'];
