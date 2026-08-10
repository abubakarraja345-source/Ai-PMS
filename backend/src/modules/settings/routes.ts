import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  getSettingsController,
  updateSettingsController,
} from "./controller";

const router = Router();

// GET /api/organization/settings
// Any organization member may view current settings.
router.get(
  "/",
  requireAuth,
  requireOrganization,
  getSettingsController
);

// PATCH /api/organization/settings
// Only owner/company_admin may change organization settings.
router.patch(
  "/",
  requireAuth,
  requireOrganization,
  requireRole("owner", "company_admin"),
  updateSettingsController
);

export default router;
