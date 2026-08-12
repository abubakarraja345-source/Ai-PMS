-- Multi-currency conversion.
--
-- Builds on the existing Phase 5 currency system (settings.currency as
-- the org's default transaction currency, properties.currency as an
-- optional override, reservations.currency as the immutable
-- transaction currency) without touching any of it. This migration
-- adds a SEPARATE, additive layer: a "base currency" that reservation
-- amounts get converted INTO for consolidated multi-currency
-- reporting, plus an optional "display currency" for on-the-fly
-- report rendering.
--
-- Deliberately does NOT introduce amount_original/currency_original
-- columns as literally suggested by the feature spec — those would
-- duplicate the already-existing reservations.total_amount and
-- reservations.currency columns. Only the net-new data (the converted
-- amount and the rate used to compute it) is stored.
--
-- settings.base_currency: nullable, NULL means "inherit
-- settings.currency" (the org's existing default) — mirrors the same
-- inheritance pattern already used by properties.currency, so in the
-- common case (one home currency) nothing new needs configuring.
--
-- settings.display_currency: nullable, NULL means "same as base
-- currency". Purely a rendering preference — converting a stored
-- base-currency total into the display currency happens live, at
-- request time, and is never persisted, so it can never go stale or
-- require a migration when it changes.
--
-- settings.exchange_rate_mode: 'auto' (fetch from a free public rate
-- API and cache in exchange_rates) or 'manual' (an owner/company_admin
-- enters and maintains the rate themselves). Defaults to 'auto'.

ALTER TABLE settings
  ADD COLUMN base_currency TEXT NULL,
  ADD COLUMN display_currency TEXT NULL,
  ADD COLUMN exchange_rate_mode TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE settings
  ADD CONSTRAINT settings_exchange_rate_mode_check
    CHECK (exchange_rate_mode IN ('auto', 'manual'));

-- Per-organization working rate table. One row per (organization,
-- base_currency, target_currency) pair, holding the latest known
-- rate — whether fetched automatically or entered manually. Reservation
-- creation reads (and upserts, in auto mode) from here, then snapshots
-- the exact rate it used onto the reservation row itself, so historical
-- reservations are never silently revalued when a rate here changes
-- later.
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT exchange_rates_source_check
    CHECK (source IN ('auto', 'manual')),

  CONSTRAINT exchange_rates_rate_positive_check
    CHECK (rate > 0)
);

CREATE UNIQUE INDEX exchange_rates_org_pair_key
  ON exchange_rates (organization_id, base_currency, target_currency);

-- Snapshot columns on reservations: amount_base is total_amount
-- converted into the org's base_currency AT CREATION TIME, using
-- exchange_rate captured at that same moment. All three are NULL for
-- a reservation whose own currency already equals the org's base
-- currency (exchange_rate is trivially 1, but left NULL rather than
-- writing a fake 1 into every existing/new same-currency row).
ALTER TABLE reservations
  ADD COLUMN amount_base NUMERIC NULL,
  ADD COLUMN base_currency TEXT NULL,
  ADD COLUMN exchange_rate NUMERIC NULL;

-- New tables created via a raw CREATE TABLE do not automatically
-- receive PostgREST-facing role grants (confirmed the hard way in
-- 20260812130000_organization_invitations_grants.sql) — granted here
-- upfront instead of as a follow-up fix. service_role only, matching
-- this project's established posture that anon/authenticated have zero
-- grants on any table.
GRANT SELECT, INSERT, UPDATE ON public.exchange_rates TO service_role;
