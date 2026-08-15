import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { invitationRateLimiter, registerRateLimiter, loginRateLimiter } from "../../middleware/rateLimiter";

import {
  listMembersController,
  changeMemberRoleController,
  removeMemberController,
  getMyOrganizationController,
  createOrganizationController,
  registerOrganizationController,
  loginController,
} from "./controller";

import {
  listInvitationsController,
  createInvitationController,
} from "./invitations.controller";

import {
  getApprovalSettingController,
  updateApprovalSettingController,
  listOrganizationAssignmentsController,
  getRoleMatrixController,
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

// GET /api/organization/property-assignments — org-wide summary, same
// gate as GET /members (viewing isn't a "manage" action).
router.get(
  "/property-assignments",
  requireAuth,
  requireOrganization,
  listOrganizationAssignmentsController
);

// GET /api/organization/role-matrix — every role's effective
// permissions, backing the Team page's "Change Role" preview.
router.get(
  "/role-matrix",
  requireAuth,
  requireOrganization,
  getRoleMatrixController
);

/**
 * Phase 7 — migrated from requireRole("owner","company_admin") to
 * team.invite. Matrix grants it only to owner/company_admin, exactly
 * reproducing today's access for every existing role — no behavior
 * change for any organization that hasn't assigned a new role yet.
 */
const manageInvitations = requirePermission("team.invite");

// GET /api/organization/invitations
// A history of team members added via invite (account + membership
// are both created synchronously by POST below — there is no
// pending/accept step anymore, so this is a log, not a queue).
router.get(
  "/invitations",
  requireAuth,
  requireOrganization,
  manageInvitations,
  listInvitationsController
);

// POST /api/organization/invitations
// Creates (or reuses) the invitee's auth account and their
// organization membership immediately — see invitations.service.ts.
router.post(
  "/invitations",
  requireAuth,
  requireOrganization,
  manageInvitations,
  invitationRateLimiter,
  createInvitationController
);

// POST /api/organization
// Onboarding only — deliberately gated by requireAuth alone, not
// requireOrganization, since the whole point is the caller doesn't
// have one yet. createOrganization (service.ts) itself rejects a
// caller who already belongs to an organization.
router.post("/", requireAuth, createOrganizationController);

// POST /api/organization/register
// Public self-service registration — no session exists yet at all,
// so this deliberately has no requireAuth. Creates the owner's
// password-based account and organization together; the frontend
// signs in with the same credentials immediately after this
// succeeds. Registered before the catch-all "/" POST route is
// irrelevant here since Express matches the literal "/register"
// segment independently, but kept adjacent to it for readability.
router.post(
  "/register",
  registerRateLimiter,
  registerOrganizationController
);

// POST /api/organization/login — public. See loginController's own
// comment for why login is proxied through the backend at all.
router.post("/login", loginRateLimiter, loginController);

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
