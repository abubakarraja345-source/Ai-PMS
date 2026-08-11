import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  listProperties,
  createPropertyController,
  getPropertyController,
  updatePropertyController,
  deletePropertyController,
} from "./controller";

const router = Router();

router.use(requireAuth, requireOrganization);

/**
 * Managing the property portfolio itself (as opposed to day-to-day
 * operations against an existing property) is owner/company_admin
 * only — matching every adjacent property-scoped module
 * (property-media, property-details, inventory), which were already
 * gated this way. This was a pre-existing gap: any "member" could
 * previously create/edit/delete any property with no role check.
 */
const mutate = requireRole("owner", "company_admin");

router.get("/", listProperties);

router.post("/", mutate, createPropertyController);
router.get("/:id", getPropertyController);
router.patch("/:id", mutate, updatePropertyController);
router.delete("/:id", mutate, deletePropertyController);

export default router;