import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  listChannelLinks,
  createChannelLink,
  removeChannelLink,
} from "./channelLinks.service";

function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

export async function listChannelLinksController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const data = await listChannelLinks(req.organization.id);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List channel links error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load channel links",
    });
  }
}

export async function createChannelLinkController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const data = await createChannelLink(req.organization.id, req.body);

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Create channel link error:", error);

    if (isKnownError(error)) {
      const status = error.message.includes("already") ? 409 : 400;

      return res.status(status).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to create channel link",
    });
  }
}

export async function deleteChannelLinkController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const linkId = req.params.id;

    if (!linkId) {
      return res.status(400).json({
        success: false,
        error: "Channel link ID is required",
      });
    }

    const deleted = await removeChannelLink(req.organization.id, linkId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Channel link not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Channel link removed successfully",
    });
  } catch (error) {
    console.error("Delete channel link error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to delete channel link",
    });
  }
}
