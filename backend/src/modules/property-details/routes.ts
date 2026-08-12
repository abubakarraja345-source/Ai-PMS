import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  confirmDocumentUploadController,
  createAmenityController,
  createRuleController,
  deleteAmenityController,
  deleteDocumentController,
  deleteRuleController,
  getAvailabilityController,
  getIcalExportStatusController,
  listAmenitiesController,
  listDocumentsController,
  listRulesController,
  regenerateIcalExportController,
  requestDocumentUploadController,
  updateRuleController,
} from "./controller";

// Mounted at /api/properties/:propertyId
const router = Router({ mergeParams: true });

router.use(requireAuth, requireOrganization);

const mutate = requireRole("owner", "company_admin");

router.get("/availability", getAvailabilityController);

router.get("/ical-export", getIcalExportStatusController);
router.post("/ical-export/regenerate", mutate, regenerateIcalExportController);

router.get("/amenities", listAmenitiesController);
router.post("/amenities", mutate, createAmenityController);
router.delete("/amenities/:amenityId", mutate, deleteAmenityController);

router.get("/rules", listRulesController);
router.post("/rules", mutate, createRuleController);
router.patch("/rules/:ruleId", mutate, updateRuleController);
router.delete("/rules/:ruleId", mutate, deleteRuleController);

router.get("/documents", listDocumentsController);
router.post(
  "/documents/upload-url",
  mutate,
  requestDocumentUploadController
);
router.post("/documents", mutate, confirmDocumentUploadController);
router.delete(
  "/documents/:documentId",
  mutate,
  deleteDocumentController
);

export default router;
