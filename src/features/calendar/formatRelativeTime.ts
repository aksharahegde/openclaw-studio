export function formatRelativeTime(atMs: number, nowMs: number = Date.now()): string {
  const deltaMs = atMs - nowMs;
  if (deltaMs < 0) return "past";
  const minutes = Math.floor(deltaMs / 60_000);
  const hours = Math.floor(deltaMs / 3_600_000);
  const days = Math.floor(deltaMs / 86_400_000);
  if (minutes < 1) return "in less than a min";
  if (minutes < 60) return `in ${minutes} min`;
  if (hours < 24) return `in ${hours} hours`;
  if (days < 7) return `in ${days} days`;
  const weeks = Math.floor(days / 7);
  return weeks <= 1 ? "in 1 week" : `in ${weeks} weeks`;
}
