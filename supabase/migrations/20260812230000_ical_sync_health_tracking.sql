-- Phase 5 (Automatic iCal Sync + Connection Health).
--
-- Genuinely new tracking data only — last_sync_completed_at,
-- last_successful_sync_at, and last_sync_error are already correctly
-- derived from sync_logs (see integrations/service.ts's
-- toClientIntegration, built in Phase 4) and are deliberately NOT
-- duplicated here.
--
-- What's actually missing:
--
-- 1. integrations.last_sync_started_at / last_sync_duration_ms — no
--    existing field records when the most recent sync attempt BEGAN
--    or how long it took (sync_logs only ever recorded a single
--    completion timestamp). Needed to detect a stuck sync and to
--    surface duration in the UI.
--
-- 2. integrations.consecutive_failure_count — not cheaply derivable
--    from sync_logs without scanning the log newest-first until a
--    success on every health check; a running counter is the correct
--    minimal design. Drives health-state thresholds and the
--    escalation/recovery notification gates.
--
-- 3. sync_logs.started_at / duration_ms — the per-attempt equivalents
--    of the two integrations columns above, needed for an accurate
--    sync history table (Part 5/9 of this phase's spec).
--
-- Does not modify, rename, or drop any existing column, table, or
-- constraint.

ALTER TABLE integrations
  ADD COLUMN last_sync_started_at TIMESTAMPTZ,
  ADD COLUMN last_sync_duration_ms INTEGER,
  ADD COLUMN consecutive_failure_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sync_logs
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN duration_ms INTEGER;
