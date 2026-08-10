import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  createIntegrationController,
  deleteIntegrationController,
  disableIntegrationController,
  enableIntegrationController,
  getIntegrationController,
  listIntegrationsController,
  manualSyncController,
  syncHistoryController,
  testConnectionController,
  updateIntegrationController,
} from "./controller";

const router = Router();

router.use(requireAuth, requireOrganization);

const mutate = requireRole("owner", "company_admin");

router.get("/", listIntegrationsController);
router.post("/", mutate, createIntegrationController);
router.get("/:id", getIntegrationController);
router.patch("/:id", mutate, updateIntegrationController);
router.delete("/:id", mutate, deleteIntegrationController);
router.post("/:id/enable", mutate, enableIntegrationController);
router.post("/:id/disable", mutate, disableIntegrationController);
router.post("/:id/test", mutate, testConnectionController);
router.post("/:id/sync", mutate, manualSyncController);
router.get("/:id/sync-history", syncHistoryController);

export default router;
