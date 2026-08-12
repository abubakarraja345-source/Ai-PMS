/**
 * Same env-with-fallback pattern organization/invitations.service.ts's
 * invitationExpiryDays() already uses — read directly from
 * process.env here rather than routing through config/env.ts, which
 * only ever does plain passthrough, never derived/clamped values.
 */
const DEFAULT_INTERVAL_MINUTES = 30;
const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 1440; // 24 hours

export function resolveSyncIntervalMinutes(): number {
  const raw = Number(process.env.ICAL_SYNC_INTERVAL_MINUTES);

  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_INTERVAL_MINUTES;
  }

  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, raw));
}
