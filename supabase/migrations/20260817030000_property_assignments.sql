-- Phase 7 — per-user property assignment, the basis for restricting
-- Manager/Host/Spectator visibility to only the properties assigned
-- to them (Owner/Admin remain unrestricted — see
-- backend/src/modules/permissions/propertyScope.ts).
--
-- organization_id is deliberately denormalized here (also derivable
-- via property_id -> properties.organization_id) rather than left
-- implicit: every query that filters by assignment ALSO independently
-- filters by organization_id, so a cross-org data leak would require
-- both filters to be wrong at once, not just one. This is a defense-
-- in-depth choice, not a normalization oversight.
--
-- No UPDATE grant — an assignment is added or removed, never edited
-- in place.

CREATE TABLE property_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT property_assignments_unique UNIQUE (property_id, user_id)
);

CREATE INDEX property_assignments_org_user_idx
  ON property_assignments (organization_id, user_id);

CREATE INDEX property_assignments_property_idx
  ON property_assignments (property_id);

GRANT SELECT, INSERT, DELETE ON public.property_assignments TO service_role;
