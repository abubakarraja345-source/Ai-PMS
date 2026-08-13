-- Phase 7 — approval workflow for sensitive member-tier mutations
-- (e.g. a Member rescheduling/cancelling a reservation, or changing a
-- financial field), per the permission engine's 'approval' effect
-- (see backend/src/modules/permissions/matrix.ts and
-- role_permission_overrides in 20260817040000).
--
-- `payload` stores the exact request body the original mutation would
-- have received — approving a request replays it through the SAME
-- service-layer function (e.g. editReservation) the immediate path
-- would have used, so validation logic is never duplicated between
-- "apply now" and "apply after approval" (see
-- backend/src/modules/approvals/registry.ts).
--
-- No DELETE grant — terminal requests (approved/rejected/cancelled)
-- are retained, same append-only-ish posture as audit_log.

CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_by_label TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  original_snapshot JSONB NULL,
  reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_label TEXT NULL,
  review_note TEXT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT approval_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE INDEX approval_requests_org_status_idx
  ON approval_requests (organization_id, status, created_at DESC);

CREATE INDEX approval_requests_entity_idx
  ON approval_requests (entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO service_role;
