export type DoodleVariant = 'day' | 'night';

/**
 * Local-hour doodle state.
 * Day: 06:00–18:59 · Night: 19:00–05:59
 */
export function doodleVariantForHour(hour: number): DoodleVariant {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`hour must be an integer 0–23, got ${hour}`);
  }
  return hour >= 6 && hour < 19 ? 'day' : 'night';
}
