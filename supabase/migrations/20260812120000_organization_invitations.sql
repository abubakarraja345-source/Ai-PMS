-- Team invitation system.
--
-- Stores pending/accepted/revoked/expired invitations for new team
-- members, invited by an existing owner/company_admin. Mirrors the
-- existing organization_members role vocabulary but deliberately
-- excludes 'owner' — an invitation can never create a second owner
-- (enforced here at the database level via the role CHECK constraint,
-- backing up the same rule enforced in
-- backend/src/modules/organization/invitations.validation.ts).
--
-- Only a SHA-256 hash of the invitation token is stored (token_hash).
-- The raw token exists only in the invitation email/URL and is never
-- persisted.
--
-- Does NOT modify organization_members or its
-- organization_members_user_id_key unique constraint (see
-- 20260812000000_organization_members_user_id_unique.sql).

CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  role TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT organization_invitations_role_check
    CHECK (role IN ('company_admin', 'member')),

  CONSTRAINT organization_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))
);

-- Every accept request looks up by token hash; must be unique so a
-- hash collision could never let one token accept a different
-- invitation than the one it was issued for.
CREATE UNIQUE INDEX organization_invitations_token_hash_key
  ON organization_invitations (token_hash);

-- GET /api/organization/invitations lists by organization.
CREATE INDEX organization_invitations_organization_id_idx
  ON organization_invitations (organization_id);

-- At most one PENDING invitation per (organization, email) — an
-- accepted/revoked/expired invitation doesn't block re-inviting the
-- same address later. Email is normalized to lowercase before insert
-- (see invitations.validation.ts), so a plain equality index is
-- sufficient without a functional lowercase() index.
CREATE UNIQUE INDEX organization_invitations_org_email_pending_key
  ON organization_invitations (organization_id, email)
  WHERE status = 'pending';
