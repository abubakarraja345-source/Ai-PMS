import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  listMembersController,
  changeMemberRoleController,
  removeMemberController,
} from "./controller";

const router = Router();

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
