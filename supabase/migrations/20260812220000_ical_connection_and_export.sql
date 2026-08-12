-- Phase (iCal Integration Management System).
--
-- 1. integrations.property_id / external_listing_name — turns each
--    integration row into a real per-property connection instead of
--    an org-wide feed requiring manual property selection at every
--    sync (see integrations/sync.service.ts's runManualSync comment,
--    which already acknowledges this exact gap). Nullable: existing
--    integrations without a property association remain valid, and
--    nothing about the existing sync engine's behavior changes for
--    them.
--
-- 2. properties.ical_export_token_hash — backs the new PMS calendar
--    export feed (GET /api/ical/:token.ics). Only a SHA-256 hash is
--    stored, mirroring organization_invitations.token_hash exactly —
--    the raw token is shown to the user once (at generation/
--    regeneration time) and never persisted anywhere.
--
-- Does not modify, rename, or drop any existing column, table, or
-- constraint.

ALTER TABLE integrations
  ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  ADD COLUMN external_listing_name TEXT;

CREATE INDEX integrations_property_id_idx ON integrations (property_id);

ALTER TABLE properties
  ADD COLUMN ical_export_token_hash TEXT UNIQUE;

CREATE INDEX properties_ical_export_token_hash_idx
  ON properties (ical_export_token_hash)
  WHERE ical_export_token_hash IS NOT NULL;
