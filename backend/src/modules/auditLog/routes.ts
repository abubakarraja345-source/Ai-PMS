import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import { listAuditLogController } from "./controller";

const router = Router();

// Activity history is sensitive across the whole organization — only
// owner/company_admin can view it, matching the same gate used for
// GET /api/organization/invitations.
router.get(
  "/",
  requireAuth,
  requireOrganization,
  requireRole("owner", "company_admin"),
  listAuditLogController
);

export default router;
