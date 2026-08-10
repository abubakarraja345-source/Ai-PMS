import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";

import {
  deleteNotificationController,
  listNotificationsController,
  markAllReadController,
  markReadController,
  unreadCountController,
} from "./controller";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireOrganization,
  listNotificationsController
);

router.get(
  "/unread-count",
  requireAuth,
  requireOrganization,
  unreadCountController
);

router.patch(
  "/read-all",
  requireAuth,
  requireOrganization,
  markAllReadController
);

router.patch(
  "/:id/read",
  requireAuth,
  requireOrganization,
  markReadController
);

router.delete(
  "/:id",
  requireAuth,
  requireOrganization,
  deleteNotificationController
);

export default router;
