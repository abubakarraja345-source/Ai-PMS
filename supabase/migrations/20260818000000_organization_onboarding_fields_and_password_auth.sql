-- Password-based auth migration: registration now collects extra
-- business-profile fields up front, and team invitations no longer
-- use an email/accept-link token flow (accounts + membership are
-- provisioned immediately, with an assigned password emailed to the
-- invitee) — see backend/src/modules/organization/service.ts and
-- invitations.service.ts.

-- New optional business-profile fields collected at registration.
-- All nullable — existing organizations are unaffected.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS number_of_listings INTEGER,
  ADD COLUMN IF NOT EXISTS property_types TEXT[],
  ADD COLUMN IF NOT EXISTS referral_source TEXT;

-- organization_invitations no longer represents a pending, token-based
-- invite the recipient must click an email link to accept — the
-- account and membership are created synchronously when an
-- owner/admin adds a team member, so token_hash/expires_at are no
-- longer populated. Relaxed (not dropped) to keep every historical
-- row intact and avoid a destructive migration.
ALTER TABLE organization_invitations
  ALTER COLUMN token_hash DROP NOT NULL,
  ALTER COLUMN expires_at DROP NOT NULL;

-- Records whether adding this member created a brand-new auth account
-- (and therefore an emailed temporary password) versus reusing an
-- existing account that had no organization yet.
ALTER TABLE organization_invitations
  ADD COLUMN IF NOT EXISTS account_provisioned BOOLEAN NOT NULL DEFAULT false;
