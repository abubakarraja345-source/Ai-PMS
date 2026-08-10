import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";

import { listCalendarReservations } from "./controller";

const router = Router();

// GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&property_id=
router.get(
  "/",
  requireAuth,
  requireOrganization,
  listCalendarReservations
);

export default router;
