import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  addInventoryItem,
  adjustInventoryStock,
  editInventoryItem,
  getInventoryHistory,
  getInventoryItem,
  getInventorySummary,
  listInventoryForOrganization,
  listInventoryForProperty,
  removeInventoryItem,
} from "./service";

import {
  validateAdjustInventory,
  validateCreateInventoryItem,
  validateInventoryFilters,
  validateUpdateInventoryItem,
} from "./validation";

function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

function requirePropertyId(req: OrganizationRequest): string {
  const propertyId = req.params.propertyId;

  if (!propertyId) {
    throw new Error("Property ID is required");
  }

  return propertyId;
}

/* ------------------------------ Property-scoped -------------------------- */

export async function listPropertyInventoryController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const filters = validateInventoryFilters(req.query as Record<string, unknown>);

    const data = await listInventoryForProperty(
      req.organization.id,
      requirePropertyId(req),
      filters
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List property inventory error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to load inventory" });
  }
}

export async function getInventoryItemController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await getInventoryItem(
      req.organization.id,
      requirePropertyId(req),
      req.params.itemId
    );

    if (!data) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get inventory item error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to load inventory item" });
  }
}

export async function createInventoryItemController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const input = validateCreateInventoryItem(req.body);

    const data = await addInventoryItem(
      req.organization.id,
      requirePropertyId(req),
      req.user.id,
      input
    );

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Create inventory item error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to create inventory item",
    });
  }
}

export async function updateInventoryItemController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const updates = validateUpdateInventoryItem(req.body);

    const data = await editInventoryItem(
      req.organization.id,
      requirePropertyId(req),
      req.params.itemId,
      updates
    );

    if (!data) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Update inventory item error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to update inventory item",
    });
  }
}

export async function deleteInventoryItemController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const deleted = await removeInventoryItem(
      req.organization.id,
      requirePropertyId(req),
      req.params.itemId
    );

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }

    return res.status(200).json({ success: true, message: "Inventory item deleted successfully" });
  } catch (error) {
    console.error("Delete inventory item error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to delete inventory item",
    });
  }
}

export async function adjustInventoryController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const input = validateAdjustInventory(req.body);

    const data = await adjustInventoryStock(
      req.organization.id,
      requirePropertyId(req),
      req.params.itemId,
      req.user.id,
      input
    );

    if (!data) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Adjust inventory error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to adjust inventory",
    });
  }
}

export async function getInventoryHistoryController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await getInventoryHistory(
      req.organization.id,
      requirePropertyId(req),
      req.params.itemId
    );

    if (!data) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get inventory history error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to load inventory history" });
  }
}

/* ---------------------------- Organization-scoped ------------------------ */

export async function listOrganizationInventoryController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const filters = validateInventoryFilters(req.query as Record<string, unknown>);

    const data = await listInventoryForOrganization(req.organization.id, filters);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List organization inventory error:", error);

    return res.status(500).json({ success: false, error: "Unable to load inventory" });
  }
}

export async function getInventorySummaryController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await getInventorySummary(req.organization.id);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get inventory summary error:", error);

    return res.status(500).json({ success: false, error: "Unable to load inventory summary" });
  }
}
