import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import {
  addProperty,
  getProperties,
  getProperty,
  editProperty,
  removeProperty,
} from "./service";

/**
 * Our own thrown `Error`s carry safe, intentional messages; a raw
 * PostgrestError's `.message` can leak column/table/constraint names
 * and must not reach the client — same convention used across every
 * other module in this codebase (e.g. reservations/routes.ts).
 */
function toClientErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name !== "PostgrestError") {
    return error.message;
  }

  return fallback;
}

export async function listProperties(
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

    const properties = await getProperties(
      req.organization.id
    );

    return res.status(200).json({
      success: true,
      data: properties,
    });
  } catch (error) {
    console.error("List properties error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load properties",
    });
  }
}

export async function createPropertyController(
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

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const property = await addProperty(
      req.organization.id,
      req.user.id,
      req.body
    );

    return res.status(201).json({
      success: true,
      data: property,
    });
  } catch (error) {
    console.error("Create property error:", error);

    return res.status(400).json({
      success: false,
      error: toClientErrorMessage(error, "Unable to create property"),
    });
  }
}

export async function getPropertyController(
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

    const property = await getProperty(
      req.organization.id,
      req.params.id
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    console.error("Get property error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load property",
    });
  }
}

export async function updatePropertyController(
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

    const property = await editProperty(
      req.organization.id,
      req.params.id,
      req.body
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    console.error("Update property error:", error);

    return res.status(400).json({
      success: false,
      error: toClientErrorMessage(error, "Unable to update property"),
    });
  }
}

export async function deletePropertyController(
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

    const deleted = await removeProperty(
      req.organization.id,
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (error) {
    console.error("Delete property error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to delete property",
    });
  }
}