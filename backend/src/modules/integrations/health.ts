import { ConnectionHealth } from "./types";
import { resolveSyncIntervalMinutes } from "./syncConfig";

export interface HealthInput {
  status: string;
  consecutiveFailureCount: number;
  lastSuccessfulSyncAt: string | null;
}

/**
 * Thresholds are expressed as multiples of the configured sync
 * interval rather than fixed durations, so they scale sensibly
 * whether ICAL_SYNC_INTERVAL_MINUTES is 5 or 1440:
 *
 * - HEALTHY: no recorded failures, and either no sync has completed
 *   yet (a freshly connected feed hasn't had a chance to run) or the
 *   last successful sync happened within 2 sync cycles ago — i.e. it
 *   hasn't missed more than one scheduled run.
 * - ERROR: either the connection is in "error" status with 3+
 *   consecutive failures, or the last successful sync (if any) is
 *   older than 4 sync cycles — badly stale regardless of the
 *   recorded failure count (covers a connection that silently stopped
 *   being picked up by the scheduler for some other reason).
 * - WARNING: everything in between — a small number of recent
 *   failures, or moderate staleness that isn't yet "error"-level.
 * - DISABLED: status is "disabled" — reported as its own state rather
 *   than folded into "error", since an intentionally disabled
 *   connection isn't unhealthy, just inactive.
 */
const STALE_CYCLES_WARNING = 2;
const STALE_CYCLES_ERROR = 4;
const ERROR_STATUS_FAILURE_THRESHOLD = 3;

export function computeConnectionHealth(input: HealthInput): ConnectionHealth {
  if (input.status === "disabled") {
    return "disabled";
  }

  const intervalMs = resolveSyncIntervalMinutes() * 60 * 1000;
  const lastSuccessAgeMs = input.lastSuccessfulSyncAt
    ? Date.now() - new Date(input.lastSuccessfulSyncAt).getTime()
    : null;

  const isBadlyStale =
    lastSuccessAgeMs !== null &&
    lastSuccessAgeMs >= intervalMs * STALE_CYCLES_ERROR;

  if (
    isBadlyStale ||
    (input.status === "error" &&
      input.consecutiveFailureCount >= ERROR_STATUS_FAILURE_THRESHOLD)
  ) {
    return "error";
  }

  const isModeratelyStale =
    lastSuccessAgeMs !== null &&
    lastSuccessAgeMs >= intervalMs * STALE_CYCLES_WARNING;

  if (input.consecutiveFailureCount > 0 || isModeratelyStale) {
    return "warning";
  }

  return "healthy";
}
