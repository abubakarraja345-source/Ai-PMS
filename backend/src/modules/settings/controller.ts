import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from "./service";

import { validateUpdateSettings } from "./validation";

/**
 * Our own validation/business-rule checks throw plain `Error`s
 * with friendly, intentional messages — safe to forward as 400s.
 * Supabase/Postgres failures throw PostgrestError (which also
 * extends Error) and must not reach the client — those fall
 * through to a generic sanitized 500 instead.
 */
function isKnownError(error: unknown): error is Error {
  return (
    error instanceof Error && error.name !== "PostgrestError"
  );
}

export async function getSettingsController(
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

    const data = await getOrganizationSettings(
      req.organization.id
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get organization settings error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load organization settings",
    });
  }
}

export async function updateSettingsController(
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

    const input = validateUpdateSettings(req.body);

    const data = await updateOrganizationSettings(
      req.organization.id,
      input,
      req.user
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Update organization settings error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to update organization settings",
    });
  }
}
