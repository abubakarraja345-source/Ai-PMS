import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganization } from "../../middleware/organization.middleware";
import { requireRole } from "../../middleware/role.middleware";

import {
  adjustInventoryController,
  createInventoryItemController,
  deleteInventoryItemController,
  getInventoryHistoryController,
  getInventoryItemController,
  getInventorySummaryController,
  listOrganizationInventoryController,
  listPropertyInventoryController,
  updateInventoryItemController,
} from "./controller";

// Mounted at /api/properties/:propertyId/inventory
export const propertyInventoryRoutes = Router({ mergeParams: true });

propertyInventoryRoutes.use(requireAuth, requireOrganization);

const mutate = requireRole("owner", "company_admin");

propertyInventoryRoutes.get("/", listPropertyInventoryController);
propertyInventoryRoutes.post("/", mutate, createInventoryItemController);
propertyInventoryRoutes.get("/:itemId", getInventoryItemController);
propertyInventoryRoutes.patch(
  "/:itemId",
  mutate,
  updateInventoryItemController
);
propertyInventoryRoutes.delete(
  "/:itemId",
  mutate,
  deleteInventoryItemController
);
propertyInventoryRoutes.post(
  "/:itemId/adjust",
  mutate,
  adjustInventoryController
);
propertyInventoryRoutes.get(
  "/:itemId/history",
  getInventoryHistoryController
);

// Mounted at /api/inventory
export const organizationInventoryRoutes = Router();

organizationInventoryRoutes.use(requireAuth, requireOrganization);

organizationInventoryRoutes.get("/items", listOrganizationInventoryController);
organizationInventoryRoutes.get("/summary", getInventorySummaryController);
