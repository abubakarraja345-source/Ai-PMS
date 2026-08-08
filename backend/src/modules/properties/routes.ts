import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";

import {
  listProperties,
  createPropertyController,
  getPropertyController,
} from "./controller";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireOrganization,
  listProperties
);

router.post(
  "/",
  requireAuth,
  requireOrganization,
  createPropertyController
);
router.get(
  "/:id",
  requireAuth,
  requireOrganization,
  getPropertyController
);
export default router;