export const PREP_SECONDS = 15 * 60; // 15-minute prep grace before countdown starts

/**
 * Remaining play seconds with a prep grace period.
 * - Before startsAt: full timeRemaining (not counting yet)
 * - After startsAt: counts down from max(startsAt, updatedAt)
 */
export function remainingSeconds(
  timeRemaining: number,
  startsAt: Date,
  updatedAt: Date,
  now: number = Date.now()
): number {
  if (now < startsAt.getTime()) return timeRemaining;
  const anchor = Math.max(startsAt.getTime(), updatedAt.getTime());
  const elapsed = Math.floor((now - anchor) / 1000);
  return Math.max(0, timeRemaining - elapsed);
}

/** Seconds until countdown begins (0 once started). */
export function prepRemaining(startsAt: Date, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((startsAt.getTime() - now) / 1000));
}
