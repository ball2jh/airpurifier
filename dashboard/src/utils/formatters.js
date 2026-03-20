export const formatBytes = (bytes) => {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
};

export function formatTimestamp(unixSeconds, tier, forTooltip = false) {
  const date = new Date(unixSeconds * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  // For tooltip - show more detail based on tier
  if (forTooltip) {
    const timeOpts = (tier === 'raw' || tier === '15m' || tier === '30m')
      ? { hour: 'numeric', minute: '2-digit', second: '2-digit' }
      : { hour: 'numeric', minute: '2-digit' };
    const timeStr = date.toLocaleTimeString([], timeOpts);

    if (isToday) return timeStr;
    if (isYesterday) return `Yesterday ${timeStr}`;
    const dayName = date.toLocaleDateString([], { weekday: 'short' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dayName} ${dateStr} ${timeStr}`;
  }

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // For axis labels - keep compact based on tier
  if (tier === 'raw' || tier === '15m' || tier === '30m' || tier === 'fine') {
    return timeStr;
  }
  if (tier === 'medium') {
    if (isToday) return timeStr;
    return date.toLocaleDateString([], { weekday: 'short', hour: 'numeric' });
  }
  if (tier === 'coarse') {
    return date.toLocaleDateString([], { weekday: 'short', hour: 'numeric' });
  }
  if (tier === 'daily' || tier === 'archive') {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  // 1y/all - show month and year
  return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
}
