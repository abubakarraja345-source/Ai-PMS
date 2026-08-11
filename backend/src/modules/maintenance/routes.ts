import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  listMaintenanceTickets,
  getMaintenanceTicketController,
  createMaintenanceTicketController,
  updateMaintenanceTicketController,
  deleteMaintenanceTicketController,
} from "./controller";

const router = Router();

/**
 * Only permanent deletion is restricted — reporting/updating
 * maintenance tickets remains open to every role, since any staff
 * member should be able to log or progress an issue. This was a
 * pre-existing gap: any "member" could previously delete any
 * maintenance ticket with no role check.
 */
const destructive = requireRole("owner", "company_admin");

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
  destructive,
  deleteMaintenanceTicketController
);

export default router;
