-- Fixes a gap in the previous migration
-- (20260812120000_organization_invitations.sql): tables created via a
-- raw CREATE TABLE in the SQL Editor do not automatically receive the
-- standard PostgREST-facing role grants the way tables created through
-- Supabase's own Table Editor do. Confirmed live: every insert/select
-- against organization_invitations failed with
-- "permission denied for table organization_invitations" (SQLSTATE
-- 42501) using the backend's service-role client, even though the
-- table and its constraints were created successfully.
--
-- Granted to service_role only — matching this project's established
-- posture (confirmed in an earlier security audit) that `anon`/
-- `authenticated` have zero grants on any table; the Express backend's
-- service-role client is the only path to any data. No DELETE grant:
-- the invitation code never deletes rows (revoke sets status instead).

GRANT SELECT, INSERT, UPDATE ON public.organization_invitations TO service_role;
