-- Phase 1 (PMS core readiness for OTA/channel-manager integration).
--
-- 1. reservations.needs_review — lets a sync process import a booking
--    that overlaps an existing confirmed reservation (rather than
--    silently dropping it, which is what the current iCal sync does
--    today in backend/src/modules/integrations/sync.service.ts) while
--    still surfacing it for staff attention. Defaults to false, so
--    every existing reservation is completely unaffected.
--
-- 2. property_channel_links — maps one of this organization's
--    properties to its listing ID on an external channel (Airbnb,
--    Booking.com, VRBO, a future Hostaway/Guesty adapter, etc.).
--    This mapping does not exist anywhere today — manual sync
--    currently requires the caller to pick the property by hand on
--    every sync run (see runManualSync's own comment acknowledging
--    this gap). A property may have at most one link per provider;
--    an external listing ID may only be claimed by one property per
--    organization per provider.
--
-- Does not modify, rename, or drop any existing column, table, or
-- constraint.

ALTER TABLE reservations
  ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE property_channel_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_listing_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT property_channel_links_property_provider_key
    UNIQUE (property_id, provider),

  CONSTRAINT property_channel_links_org_provider_external_key
    UNIQUE (organization_id, provider, external_listing_id)
);

CREATE INDEX property_channel_links_property_id_idx
  ON property_channel_links (property_id);

CREATE INDEX property_channel_links_organization_id_idx
  ON property_channel_links (organization_id);

-- Tables created via a raw CREATE TABLE in the SQL Editor don't
-- automatically receive PostgREST's standard service_role grants
-- (confirmed the hard way in an earlier migration) — granted here so
-- the backend's service-role client can actually use this table.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_channel_links TO service_role;
