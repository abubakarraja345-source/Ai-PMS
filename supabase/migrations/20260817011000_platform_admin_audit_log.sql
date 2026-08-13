-- Phase 7 — audit trail for platform-admin (Super Admin) actions.
--
-- Deliberately a SEPARATE table from the existing `audit_log`, not a
-- reuse of it: audit_log.organization_id is NOT NULL (every existing
-- audit_log consumer relies on that), so a platform-wide event with no
-- organization in context (e.g. "viewed the platform dashboard")
-- structurally cannot be represented there without weakening a
-- guarantee every other module depends on. organization_id here is
-- nullable instead: NULL = platform-wide event, set = the platform
-- admin acted on/viewed that specific organization (e.g.
-- "organization.entered").
--
-- No DELETE grant — same append-only posture as audit_log itself.

CREATE TABLE platform_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_id UUID NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label TEXT NULL,
  action TEXT NOT NULL,
  organization_id UUID NULL REFERENCES organizations(id) ON DELETE SET NULL,
  reason TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX platform_admin_audit_log_admin_created_idx
  ON platform_admin_audit_log (platform_admin_id, created_at DESC);

CREATE INDEX platform_admin_audit_log_org_created_idx
  ON platform_admin_audit_log (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

GRANT SELECT, INSERT ON public.platform_admin_audit_log TO service_role;
