import { Response } from "express";
import { OrganizationRequest } from "../../../middleware/organization.middleware";

import {
  getConnectionStatus,
  startAuthorization,
  handleCallback,
  disconnectAirbnb,
  listAvailableListings,
  listMappedListings,
  importListing,
  unmapListing,
  syncAirbnbApiConnection,
} from "./service";

import { validateCallback, validateImportListing } from "./validation";

function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

function requireOrgAndUser(req: OrganizationRequest, res: Response): boolean {
  if (!req.organization || !req.user) {
    res.status(403).json({
      success: false,
      error: "Organization context is required",
    });
    return false;
  }
  return true;
}

export async function getStatusController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!requireOrgAndUser(req, res)) return;

    const data = await getConnectionStatus(req.organization!.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Airbnb API status error:", error);
    return res.status(500).json({
      success: false,
      error: "Unable to load Airbnb connection status",
    });
  }
}

export async function connectController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!requireOrgAndUser(req, res)) return;

    const data = await startAuthorization(req.organization!.id, req.user!);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Airbnb API connect error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to start Airbnb authorization",
    });
  }
}

export async function callbackController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!requireOrgAndUser(req, res)) return;

    const input = validateCallback(req.body);
    const data = await handleCallback(
      req.organization!.id,
      req.user!,
      input.state,
      input.code
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Airbnb API callback error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to complete Airbnb authorization",
    });
  }
}

export async function disconnectController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!requireOrgAndUser(req, res)) return;

    const disconnected = await disconnectAirbnb(
      req.organization!.id,
      req.user!
    );

    if (!disconnected) {
      return res.status(404).json({
        success: false,
        error: "No Airbnb connection found",
      });
    }

    return res.status(200).json({ success: true, message: "Disconnected" });
  } catch (error) {
    console.error("Airbnb API disconnect error:", error);
    return res.status(500).json({
      success: false,
      error: "Unable to disconnect Airbnb",
    });
  }
}

export async function listListingsController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!requireOrgAndUser(req, res)) return;

    const data = await listAvailableListings(req.organization!.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Airbnb API list listings error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to load Airbnb listings",
    });
  }
}

export async function listMappedListingsController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!requireOrgAndUser(req, res)) return;

    const data = await listMappedListings(req.organization!.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Airbnb API list mapped listings error:", error);
    return res.status(500).json({
      success: false,
      error: "Unable to load mapped listings",
    });
  }
}

export async function importListingController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!requireOrgAndUser(req, res)) return;

    const input = validateImportListing(req.body);
    const data = await importListing(req.organization!.id, req.user!, input);

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Airbnb API import listing error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to import listing",
    });
  }
}

export async function unmapListingController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!requireOrgAndUser(req, res)) return;

    const linkId = req.params.linkId;

    if (!linkId) {
      return res.status(400).json({
        success: false,
        error: "linkId is required",
      });
    }

    const removed = await unmapListing(req.organization!.id, req.user!, linkId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: "Listing mapping not found",
      });
    }

    return res.status(200).json({ success: true, message: "Unmapped" });
  } catch (error) {
    console.error("Airbnb API unmap listing error:", error);
    return res.status(500).json({
      success: false,
      error: "Unable to unmap listing",
    });
  }
}

export async function syncController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!requireOrgAndUser(req, res)) return;

    const status = await getConnectionStatus(req.organization!.id);

    if (!status.integrationId) {
      return res.status(404).json({
        success: false,
        error: "No Airbnb connection found",
      });
    }

    const data = await syncAirbnbApiConnection(
      req.organization!.id,
      status.integrationId,
      "manual"
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Airbnb API sync error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to sync Airbnb",
    });
  }
}
