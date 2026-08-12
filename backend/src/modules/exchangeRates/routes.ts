import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  listExchangeRatesController,
  setExchangeRateController,
} from "./controller";

const router = Router();

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
