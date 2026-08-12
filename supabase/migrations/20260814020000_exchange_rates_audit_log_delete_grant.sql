-- Fixes a gap in 20260814000000_multi_currency_conversion.sql and
-- 20260814010000_audit_log.sql: both granted SELECT/INSERT/UPDATE
-- (exchange_rates) or SELECT/INSERT (audit_log) but neither included
-- DELETE. Confirmed live: a service-role DELETE against exchange_rates
-- failed with "permission denied for table exchange_rates" (SQLSTATE
-- 42501), the same class of gap documented in
-- 20260812130000_organization_invitations_grants.sql for a different
-- table.
--
-- exchange_rates needs DELETE so a stale/incorrect manual rate can be
-- removed outright rather than only ever overwritten. audit_log is
-- append-only by the application today (nothing in the codebase
-- deletes from it), but DELETE is granted here too for the same
-- reason invitations eventually needed it: operational cleanup
-- (removing test/erroneous data) shouldn't require a separate
-- follow-up migration a second time.

GRANT DELETE ON public.exchange_rates TO service_role;
GRANT DELETE ON public.audit_log TO service_role;
