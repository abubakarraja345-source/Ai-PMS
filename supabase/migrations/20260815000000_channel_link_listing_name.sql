-- Phase 6A (Airbnb Official API architecture foundation).
--
-- Adds one nullable, purely-cosmetic column so the listing-mapping UI
-- can display a human-readable name ("Villa Lake View") next to a
-- property_channel_links row without re-fetching the provider's
-- listing list on every page load. Mirrors the naming and nullability
-- of the existing integrations.external_listing_name column exactly.
--
-- No new tables: property_channel_links remains the single source of
-- truth for property<->external-listing mapping for BOTH the existing
-- iCal provider family and the new Airbnb Official API provider
-- ("airbnb_api") — see the Phase 6A architecture report for why a
-- separate airbnb_listing_mappings table was deliberately not created.
--
-- Does not modify, rename, or drop any existing column, table, or
-- constraint. Existing rows simply get NULL here.

ALTER TABLE property_channel_links
  ADD COLUMN external_listing_name TEXT NULL;
