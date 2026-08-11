import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";

import { getReportsSummaryController } from "./controller";

const router = Router();

// GET /api/reports/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get(
  "/summary",
  requireAuth,
  requireOrganization,
  getReportsSummaryController
);

export default router;
