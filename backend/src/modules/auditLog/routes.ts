import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

import { listAuditLogController } from "./controller";

const router = Router();

// Phase 7 — migrated from requireRole("owner","company_admin") to
// audit.read. Matrix grants it to owner/company_admin (unchanged) plus
// manager (new — matches the spec's "Audit Log ✓Manager" example),
// reproducing today's exact access for every existing role.
router.get(
  "/",
  requireAuth,
  requireOrganization,
  requirePermission("audit.read"),
  listAuditLogController
);

export default router;
