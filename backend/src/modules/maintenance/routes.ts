import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";

import {
  listMaintenanceTickets,
  getMaintenanceTicketController,
  createMaintenanceTicketController,
  updateMaintenanceTicketController,
  deleteMaintenanceTicketController,
} from "./controller";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireOrganization,
  listMaintenanceTickets
);

router.post(
  "/",
  requireAuth,
  requireOrganization,
  createMaintenanceTicketController
);

router.get(
  "/:id",
  requireAuth,
  requireOrganization,
  getMaintenanceTicketController
);

router.patch(
  "/:id",
  requireAuth,
  requireOrganization,
  updateMaintenanceTicketController
);

router.delete(
  "/:id",
  requireAuth,
  requireOrganization,
  deleteMaintenanceTicketController
);

export default router;
