import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

import {
  listProperties,
  createPropertyController,
  getPropertyController,
  updatePropertyController,
  deletePropertyController,
  listPropertyAssignmentsController,
  addPropertyAssignmentController,
  removePropertyAssignmentController,
} from "./controller";

const router = Router();

router.use(requireAuth, requireOrganization);

/**
 * Phase 7 — migrated from requireRole("owner","company_admin") to the
 * granular permission engine. The matrix (permissions/matrix.ts)
 * reproduces the exact same effective access for every existing role
 * (owner/company_admin: allow, member: deny) — the only actual change
 * is that "manager" (a brand new role no existing organization has
 * assigned yet) now gets properties.update, matching its "manage
 * assigned properties" spec definition. Create/delete remain
 * owner/admin only, same as before.
 */
router.get("/", requirePermission("properties.read"), listProperties);

router.post("/", requirePermission("properties.create"), createPropertyController);
router.get("/:id", requirePermission("properties.read"), getPropertyController);
router.patch("/:id", requirePermission("properties.update"), updatePropertyController);
router.delete("/:id", requirePermission("properties.delete"), deletePropertyController);

// Phase 7.4 — property-level access assignment. Gated
// team.assign_properties (owner/company_admin/manager per the spec).
router.get(
  "/:id/assignments",
  requirePermission("team.assign_properties"),
  listPropertyAssignmentsController
);
router.post(
  "/:id/assignments",
  requirePermission("team.assign_properties"),
  addPropertyAssignmentController
);
router.delete(
  "/:id/assignments/:userId",
  requirePermission("team.assign_properties"),
  removePropertyAssignmentController
);

export default router;