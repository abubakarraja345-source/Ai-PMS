-- Audit log.
--
-- Records who did what, when, for the set of actions that matter most
-- for a PMS owner reviewing activity: reservation create/cancel,
-- member role changes/removal, invitation create/resend/revoke,
-- iCal connection create, review-flag clearing, and organization/
-- property currency changes. This is a deliberately curated set of
-- "important actions" (matching the feature spec's own framing),
-- not an exhaustive wrap of every mutation in the app — instrumenting
-- every endpoint would be its own much larger, riskier undertaking.
--
-- actor_label denormalizes the acting user's display name/email at
-- the time of the action, so a log entry stays readable even if the
-- user is later removed from the organization or deleted entirely
-- (actor_user_id then just goes NULL via ON DELETE SET NULL, but the
-- label survives).

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label TEXT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The audit log page always queries by organization, newest first.
CREATE INDEX audit_log_organization_created_idx
  ON audit_log (organization_id, created_at DESC);

GRANT SELECT, INSERT ON public.audit_log TO service_role;
