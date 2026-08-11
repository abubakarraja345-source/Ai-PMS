-- Enforces the application's existing "one user -> one organization"
-- invariant at the database level. Every existing code path already
-- assumes at most one organization_members row per user (see
-- backend/src/middleware/organization.middleware.ts's requireOrganization,
-- which selects with .limit(1)) — this constraint makes that assumption
-- true by construction instead of only by convention.
--
-- Directly closes a confirmed race condition: two concurrent
-- POST /api/organization requests from the same authenticated user could
-- both pass the application-level "does this user already have an
-- organization" check before either had inserted its membership row,
-- resulting in two organizations and two organization_members rows for
-- one user. With this constraint in place, the second insert is rejected
-- by Postgres itself (unique_violation, SQLSTATE 23505), which
-- backend/src/modules/organization/service.ts catches and converts into
-- the same friendly 409 the sequential (non-racing) case already returns.
--
-- Scope: user_id only. Multiple users may still belong to the same
-- organization — this does not touch organization_id or any other
-- column/table.
--
-- Pre-migration check (2026-08-12, live query against
-- organization_members): 2 total rows, 2 distinct user_id values, 0
-- duplicates. Safe to apply.

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_user_id_key UNIQUE (user_id);
