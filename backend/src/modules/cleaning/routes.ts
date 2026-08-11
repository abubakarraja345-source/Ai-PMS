import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  listCleaningTasks,
  getCleaningTaskController,
  createCleaningTaskController,
  updateCleaningTaskController,
  deleteCleaningTaskController,
} from "./controller";

const router = Router();

/**
 * Only permanent deletion is restricted — creating/updating cleaning
 * tasks (including status transitions) remains open to every role,
 * since that's routine housekeeping work. This was a pre-existing
 * gap: any "member" could previously delete any cleaning task with
 * no role check.
 */
const destructive = requireRole("owner", "company_admin");

router.get(
  "/",
  requireAuth,
  requireOrganization,
  listCleaningTasks
);

router.post(
  "/",
  requireAuth,
  requireOrganization,
  createCleaningTaskController
);

router.get(
  "/:id",
  requireAuth,
  requireOrganization,
  getCleaningTaskController
);

router.patch(
  "/:id",
  requireAuth,
  requireOrganization,
  updateCleaningTaskController
);

router.delete(
  "/:id",
  requireAuth,
  requireOrganization,
  destructive,
  deleteCleaningTaskController
);

export default router;
