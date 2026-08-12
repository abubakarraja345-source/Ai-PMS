import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  addIntegration,
  connectPropertyCalendar,
  disableIntegration,
  editIntegration,
  enableIntegration,
  getIntegration,
  listIntegrations,
  removeIntegration,
  testIcalFeedUrl,
  testIntegrationConnection,
} from "./service";

import { runManualSync } from "./sync.service";
import { findIntegrationById, findSyncLogsByIntegration } from "./repository";

import {
  validateConnectPropertyCalendar,
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

/**
 * Connect a property's calendar to an external (iCal-based) provider
 * in one step (Phase E/G) — tests the feed, registers the channel
 * mapping, and creates the connection, already active.
 */
export async function connectPropertyCalendarController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const input = validateConnectPropertyCalendar(req.body);

    const data = await connectPropertyCalendar(req.organization.id, input);

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Connect property calendar error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to connect this calendar",
    });
  }
}

/**
 * Test a feed URL before it's ever saved (Phase E/F's "Test
 * Connection" step of the connect-a-calendar wizard) — no integration
 * needs to exist yet. Never returns the raw URL back to the client;
 * only counts/samples derived from parsing it.
 */
export async function testIcalUrlController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const feedUrl =
      typeof req.body?.feedUrl === "string" ? req.body.feedUrl.trim() : "";

    if (!feedUrl) {
      return res.status(400).json({ success: false, error: "feedUrl is required" });
    }

    const data = await testIcalFeedUrl(feedUrl);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Test iCal URL error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to test this feed URL",
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

    const integrationId = req.params.id;

    if (!integrationId) {
      return res.status(400).json({ success: false, error: "Integration ID is required" });
    }

    let propertyId =
      typeof req.body?.propertyId === "string" ? req.body.propertyId.trim() : "";

    // A connection created through the new Connect Calendar flow
    // already knows its property — the caller no longer has to pick
    // one every sync (the old gap runManualSync's own comment
    // acknowledged). Only integrations without a property still
    // require the body to specify one.
    if (!propertyId) {
      const integration = await findIntegrationById(
        req.organization.id,
        integrationId
      );

      if (integration?.property_id) {
        propertyId = integration.property_id;
      }
    }

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: "propertyId is required — select which property this sync applies to",
      });
    }

    const data = await runManualSync(
      req.organization.id,
      integrationId,
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
