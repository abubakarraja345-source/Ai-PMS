import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  confirmImageUpload,
  listPropertyImages,
  removePropertyImage,
  reorderPropertyImages,
  requestImageUpload,
  updatePropertyImage,
} from "./service";

import {
  validateConfirmImageUpload,
  validateReorderImages,
  validateRequestImageUpload,
  validateUpdateImage,
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

export async function listImagesController(
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

    const data = await listPropertyImages(
      req.organization.id,
      requirePropertyId(req)
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List property images error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res
      .status(500)
      .json({ success: false, error: "Unable to load property images" });
  }
}

export async function requestImageUploadController(
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

    const input = validateRequestImageUpload(req.body);

    const data = await requestImageUpload(
      req.organization.id,
      requirePropertyId(req),
      input
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Request image upload error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error)
        ? error.message
        : "Unable to prepare image upload",
    });
  }
}

export async function confirmImageUploadController(
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

    const input = validateConfirmImageUpload(req.body);

    const data = await confirmImageUpload(
      req.organization.id,
      requirePropertyId(req),
      input
    );

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Confirm image upload error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error)
        ? error.message
        : "Unable to save uploaded image",
    });
  }
}

export async function updateImageController(
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

    const updates = validateUpdateImage(req.body);

    const data = await updatePropertyImage(
      req.organization.id,
      requirePropertyId(req),
      req.params.imageId,
      updates
    );

    if (!data) {
      return res
        .status(404)
        .json({ success: false, error: "Image not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Update property image error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to update image",
    });
  }
}

export async function reorderImagesController(
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

    const order = validateReorderImages(req.body);

    const data = await reorderPropertyImages(
      req.organization.id,
      requirePropertyId(req),
      order
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Reorder property images error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to reorder images",
    });
  }
}

export async function deleteImageController(
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

    const deleted = await removePropertyImage(
      req.organization.id,
      requirePropertyId(req),
      req.params.imageId
    );

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Image not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Delete property image error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to delete image",
    });
  }
}
