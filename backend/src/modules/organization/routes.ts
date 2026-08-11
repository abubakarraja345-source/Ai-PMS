import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  listMembersController,
  changeMemberRoleController,
  removeMemberController,
  getMyOrganizationController,
  createOrganizationController,
} from "./controller";

const router = Router();

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
// Coarse gate: only owner/company_admin may even attempt this.
// Fine-grained rules (can't touch the owner, can't change your
// own role) are enforced in the service layer, since they
// depend on which specific member is targeted.
router.patch(
  "/members/:id",
  requireAuth,
  requireOrganization,
  requireRole("owner", "company_admin"),
  changeMemberRoleController
);

// DELETE /api/organization/members/:id
router.delete(
  "/members/:id",
  requireAuth,
  requireOrganization,
  requireRole("owner", "company_admin"),
  removeMemberController
);

export default router;
