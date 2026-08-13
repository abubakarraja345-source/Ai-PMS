import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

import {
  listApprovalsController,
  approveRequestController,
  rejectRequestController,
} from "./controller";

const router = Router();

router.use(requireAuth, requireOrganization);

// GET /api/approvals — every role may call this; listApprovals itself
// narrows non-reviewers down to only their own requests (see
// service.ts). Reviewer-only actions below are still permission-gated.
router.get("/", listApprovalsController);

router.post("/:id/approve", requirePermission("approvals.review"), approveRequestController);
router.post("/:id/reject", requirePermission("approvals.review"), rejectRequestController);

export default router;
