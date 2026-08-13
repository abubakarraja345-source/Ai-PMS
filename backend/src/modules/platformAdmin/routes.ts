import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePlatformAdmin } from "../../middleware/platformAdmin.middleware";

import {
  getPlatformStatsController,
  listOrganizationsController,
  getOrganizationDetailController,
  suspendOrganizationController,
  reactivateOrganizationController,
  enterOrganizationController,
  exitOrganizationController,
  listPlatformAuditLogController,
} from "./controller";

const router = Router();

// Deliberately no requireOrganization anywhere in this router — a
// platform admin operates above organizations, not as a member of
// one. Every route here is gated purely by requireAuth +
// requirePlatformAdmin.
router.use(requireAuth, requirePlatformAdmin);

router.get("/stats", getPlatformStatsController);
router.get("/organizations", listOrganizationsController);
router.get("/organizations/:orgId", getOrganizationDetailController);
router.post("/organizations/:orgId/suspend", suspendOrganizationController);
router.post("/organizations/:orgId/reactivate", reactivateOrganizationController);
router.post("/organizations/:orgId/enter", enterOrganizationController);
router.post("/organizations/:orgId/exit", exitOrganizationController);
router.get("/audit-log", listPlatformAuditLogController);

export default router;
