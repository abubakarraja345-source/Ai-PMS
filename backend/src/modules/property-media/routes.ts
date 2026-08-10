import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  confirmImageUploadController,
  deleteImageController,
  listImagesController,
  reorderImagesController,
  requestImageUploadController,
  updateImageController,
} from "./controller";

// Mounted at /api/properties/:propertyId/images
const router = Router({ mergeParams: true });

router.use(requireAuth, requireOrganization);

router.get("/", listImagesController);

router.post(
  "/upload-url",
  requireRole("owner", "company_admin"),
  requestImageUploadController
);

router.post(
  "/",
  requireRole("owner", "company_admin"),
  confirmImageUploadController
);

router.patch(
  "/reorder",
  requireRole("owner", "company_admin"),
  reorderImagesController
);

router.patch(
  "/:imageId",
  requireRole("owner", "company_admin"),
  updateImageController
);

router.delete(
  "/:imageId",
  requireRole("owner", "company_admin"),
  deleteImageController
);

export default router;
