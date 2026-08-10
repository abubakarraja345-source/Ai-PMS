import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  addIntegration,
  disableIntegration,
  editIntegration,
  enableIntegration,
  getIntegration,
  listIntegrations,
  removeIntegration,
  testIntegrationConnection,
} from "./service";

import { runManualSync } from "./sync.service";
import { findSyncLogsByIntegration } from "./repository";

import {
  validateCreateIntegration,
  validateUpdateIntegration,
} from "./validation";

function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

export async function listIntegrationsController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await listIntegrations(req.organization.id);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List integrations error:", error);

    return res.status(500).json({ success: false, error: "Unable to load integrations" });
  }
}

export async function getIntegrationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await getIntegration(req.organization.id, req.params.id);

    if (!data) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get integration error:", error);

    return res.status(500).json({ success: false, error: "Unable to load integration" });
  }
}

export async function createIntegrationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const input = validateCreateIntegration(req.body);

    const data = await addIntegration(req.organization.id, input);

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Create integration error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to create integration",
    });
  }
}

export async function updateIntegrationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const updates = validateUpdateIntegration(req.body);

    const data = await editIntegration(req.organization.id, req.params.id, updates);

    if (!data) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Update integration error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to update integration",
    });
  }
}

export async function deleteIntegrationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const deleted = await removeIntegration(req.organization.id, req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    return res.status(200).json({ success: true, message: "Integration deleted successfully" });
  } catch (error) {
    console.error("Delete integration error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to delete integration",
    });
  }
}

export async function enableIntegrationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await enableIntegration(req.organization.id, req.params.id);

    if (!data) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Enable integration error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to enable integration",
    });
  }
}

export async function disableIntegrationController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await disableIntegration(req.organization.id, req.params.id);

    if (!data) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Disable integration error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to disable integration",
    });
  }
}

export async function testConnectionController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await testIntegrationConnection(req.organization.id, req.params.id);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Test integration connection error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to test connection",
    });
  }
}

export async function manualSyncController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const propertyId =
      typeof req.body?.propertyId === "string" ? req.body.propertyId.trim() : "";

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: "propertyId is required — select which property this sync applies to",
      });
    }

    const data = await runManualSync(
      req.organization.id,
      req.params.id,
      propertyId,
      req.user.id
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Manual sync error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to run sync",
    });
  }
}

export async function syncHistoryController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const integration = await getIntegration(req.organization.id, req.params.id);

    if (!integration) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    const rows = await findSyncLogsByIntegration(req.params.id);

    const data = rows.map((row) => {
      const response = (row.response ?? {}) as Record<string, unknown>;

      return {
        id: row.id,
        event: row.event,
        status: row.status,
        imported: Number(response.imported ?? 0),
        updated: Number(response.updated ?? 0),
        cancelled: Number(response.cancelled ?? 0),
        skipped: Number(response.skipped ?? 0),
        conflicts: Number(response.conflicts ?? 0),
        errorMessage:
          typeof response.errorMessage === "string" ? response.errorMessage : null,
        syncedAt: row.synced_at,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Sync history error:", error);

    return res.status(500).json({ success: false, error: "Unable to load sync history" });
  }
}
