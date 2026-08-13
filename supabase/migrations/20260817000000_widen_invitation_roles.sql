-- Phase 7 — widen organization_invitations' role vocabulary from the
-- original 2 assignable roles to the full 6-tier org role model
-- (owner/admin/manager/host/member/spectator), while preserving the
-- original rule that an invitation can never mint a second owner.
--
-- 'company_admin' is kept as-is (not renamed to 'admin') — Phase 7's
-- compatibility layer treats "company_admin" as the stored value for
-- what the new permission system labels "Admin" everywhere else (see
-- backend/src/modules/permissions/roles.ts's ROLE_LABELS). This is a
-- pure additive widening of the CHECK constraint; no existing row's
-- role value is touched.
--
-- Does not modify organization_members (its role column has no CHECK
-- constraint at all — see organization.middleware.ts's own comment —
-- so the new role strings need no schema change there).

ALTER TABLE organization_invitations
  DROP CONSTRAINT organization_invitations_role_check;

ALTER TABLE organization_invitations
  ADD CONSTRAINT organization_invitations_role_check
    CHECK (role IN ('company_admin', 'manager', 'host', 'member', 'spectator'));
