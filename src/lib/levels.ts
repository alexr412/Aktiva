export const LEVEL_THRESHOLDS: number[] = Array.from({ length: 100 }, (_, i) => {
  if (i === 0) return 0;
  return Math.round(30 * Math.pow(i, 1.68));
});

export function calculateLevel(pointsLifetime: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (pointsLifetime >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return Math.min(100, Math.max(1, level));
}
