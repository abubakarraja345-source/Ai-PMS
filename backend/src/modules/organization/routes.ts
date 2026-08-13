import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { invitationRateLimiter } from "../../middleware/rateLimiter";

import {
  listMembersController,
  changeMemberRoleController,
  removeMemberController,
  getMyOrganizationController,
  createOrganizationController,
} from "./controller";

import {
  listInvitationsController,
  createInvitationController,
  resendInvitationController,
  revokeInvitationController,
  acceptInvitationController,
  previewInvitationController,
} from "./invitations.controller";

import {
  getApprovalSettingController,
  updateApprovalSettingController,
} from "../permissions/controller";

const router = Router();

// GET/POST /api/organization/approval-settings — the one bundled
// Member-approval on/off toggle (Phase 7.3). Same gate as other
// organization-configuration changes (settings, currency).
router.get(
  "/approval-settings",
  requireAuth,
  requireOrganization,
  getApprovalSettingController
);
router.post(
  "/approval-settings",
  requireAuth,
  requireOrganization,
  requirePermission("organization.update"),
  updateApprovalSettingController
);

/**
 * Phase 7 — migrated from requireRole("owner","company_admin") to
 * team.invite. Matrix grants it only to owner/company_admin, exactly
 * reproducing today's access for every existing role — no behavior
 * change for any organization that hasn't assigned a new role yet.
 */
const manageInvitations = requirePermission("team.invite");

// POST /api/organization/invitations/accept
// Authenticated only, deliberately NOT requireOrganization — the
// caller may not have an organization yet, which is the whole point.
// Registered before the /invitations collection routes purely for
// readability; Express matches this literal path independently of
// the /invitations/:id/* routes below (no collision either way).
router.post(
  "/invitations/accept",
  requireAuth,
  acceptInvitationController
);

// GET /api/organization/invitations
router.get(
  "/invitations",
  requireAuth,
  requireOrganization,
  manageInvitations,
  listInvitationsController
);

// GET /api/organization/invitations/:token
// Deliberately public — see previewInvitationController's own comment
// for why. Registered after the exact-literal "/invitations" list
// route above so Express never has to disambiguate between them (a
// bare "/invitations" request always matches the list route; anything
// with a second path segment falls through to this one).
router.get("/invitations/:token", previewInvitationController);

// POST /api/organization/invitations
router.post(
  "/invitations",
  requireAuth,
  requireOrganization,
  manageInvitations,
  invitationRateLimiter,
  createInvitationController
);

// POST /api/organization/invitations/:id/resend
router.post(
  "/invitations/:id/resend",
  requireAuth,
  requireOrganization,
  manageInvitations,
  invitationRateLimiter,
  resendInvitationController
);

// POST /api/organization/invitations/:id/revoke
router.post(
  "/invitations/:id/revoke",
  requireAuth,
  requireOrganization,
  manageInvitations,
  revokeInvitationController
);

// POST /api/organization
// Onboarding only — deliberately gated by requireAuth alone, not
// requireOrganization, since the whole point is the caller doesn't
// have one yet. createOrganization (service.ts) itself rejects a
// caller who already belongs to an organization.
router.post("/", requireAuth, createOrganizationController);

// GET /api/organization/me
// Resolves the authenticated user's organization context (or the
// same 403 requireOrganization already returns everywhere else),
// used by the frontend to decide dashboard vs. onboarding.
router.get(
  "/me",
  requireAuth,
  requireOrganization,
  getMyOrganizationController
);

// GET /api/organization/members
// Viewing the roster isn't a "manage" action — every role may
// list members (e.g. for an "assigned to" picker elsewhere).
router.get(
  "/members",
  requireAuth,
  requireOrganization,
  listMembersController
);

// PATCH /api/organization/members/:id
// Phase 7 — migrated to team.manage_roles (owner/company_admin only
// in the matrix, same as before). Fine-grained rules (can't touch the
// owner, can't change your own role) are still enforced in the
// service layer, since they depend on which specific member is
// targeted — permission engine only answers "is this role even
// allowed to attempt this at all."
router.patch(
  "/members/:id",
  requireAuth,
  requireOrganization,
  requirePermission("team.manage_roles"),
  changeMemberRoleController
);

// DELETE /api/organization/members/:id
router.delete(
  "/members/:id",
  requireAuth,
  requireOrganization,
  requirePermission("team.remove"),
  removeMemberController
);

export default router;
