import { Router } from "express";
import {
  requireAuth,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import {
  requireOrganization,
  OrganizationRequest,
} from "../middleware/organization.middleware";

const router = Router();

router.get(
  "/me",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    res.json({
      success: true,
      user: req.user,
    });
  }
);

router.get(
  "/organization",
  requireAuth,
  requireOrganization,
  (req: OrganizationRequest, res) => {
    res.json({
      success: true,
      organization: req.organization,
    });
  }
);

export default router;