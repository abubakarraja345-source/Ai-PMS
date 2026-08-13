-- Phase 7 — per-organization overrides on top of the hardcoded
-- PERMISSION_MATRIX (backend/src/modules/permissions/matrix.ts).
--
-- The matrix itself is application code, not a database table (it
-- changes with every code deploy, needs type-checking and code
-- review) — this table is the ONLY database-backed customization
-- layer on top of it. Zero rows for every organization until an
-- owner/admin explicitly changes something, which is what makes this
-- fully backward compatible on its own: an org with no override rows
-- behaves exactly per the hardcoded matrix defaults.
--
-- Concrete use: the matrix ships with 'approval' as the default
-- effect for role='member' on reservation reschedule/cancel/financial
-- actions (see matrix.ts's own comment). An owner who wants their
-- Members to keep editing reservations freely (today's behavior)
-- inserts a row here with effect='allow' for that
-- (role, resource_action) pair, overriding the default without any
-- code change.
--
-- effect values: 'allow' (permit outright), 'deny' (block outright),
-- 'approval' (permit, but route through the approval workflow).

CREATE TABLE role_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  resource_action TEXT NOT NULL,
  effect TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT role_permission_overrides_unique UNIQUE (organization_id, role, resource_action),
  CONSTRAINT role_permission_overrides_effect_check CHECK (effect IN ('allow', 'deny', 'approval'))
);

CREATE INDEX role_permission_overrides_org_idx
  ON role_permission_overrides (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permission_overrides TO service_role;
