import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  listExchangeRatesController,
  setExchangeRateController,
  convertLiveController,
} from "./controller";

const router = Router();

// GET /api/organization/exchange-rates/convert — registered before the
// exact-match "/" route purely for readability; Express matches
// distinct path segments independently regardless of order.
router.get(
  "/convert",
  requireAuth,
  requireOrganization,
  convertLiveController
);

router.get(
  "/",
  requireAuth,
  requireOrganization,
  listExchangeRatesController
);

router.patch(
  "/:targetCurrency",
  requireAuth,
  requireOrganization,
  requireRole("owner", "company_admin"),
  setExchangeRateController
);

export default router;
