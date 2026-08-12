import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  addAmenity,
  addRule,
  confirmDocumentUpload,
  editRule,
  getIcalExportStatus,
  listAmenities,
  listDocuments,
  listRules,
  regenerateIcalExportToken,
  removeAmenity,
  removeDocument,
  removeRule,
  requestDocumentUpload,
} from "./service";

import {
  validateConfirmDocumentUpload,
  validateCreateAmenity,
  validateCreateRule,
  validateRequestDocumentUpload,
  validateUpdateRule,
} from "./validation";

import { getPropertyAvailabilityReport } from "../reservations/service";
import { validateDate } from "../reservations/validation";

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

/* ----------------------------- Availability ------------------------------ */

export async function getAvailabilityController(
  req: OrganizationRequest,
  res: Response
) {
  if (!req.organization) {
    return res.status(403).json({ success: false, error: "Organization context is required" });
  }

  let start: string;
  let end: string;

  try {
    start = validateDate(req.query.start, "start");
    end = validateDate(req.query.end, "end");

    if (end <= start) {
      throw new Error("end must be after start");
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Invalid start/end date",
    });
  }

  try {
    // Optional: lets the reservation-edit UI check availability for a
    // reservation's own current dates without that reservation
    // appearing as a conflict with itself. Not part of the base
    // contract (create-flow callers omit it entirely).
    const excludeReservationId =
      typeof req.query.exclude_reservation_id === "string" &&
      req.query.exclude_reservation_id.trim()
        ? req.query.exclude_reservation_id.trim()
        : undefined;

    const data = await getPropertyAvailabilityReport(
      req.organization.id,
      requirePropertyId(req),
      start,
      end,
      excludeReservationId
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get property availability error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to load property availability" });
  }
}

/* ---------------------------- iCal export feed --------------------------- */

export async function getIcalExportStatusController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await getIcalExportStatus(req.organization.id, requirePropertyId(req));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get iCal export status error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to load export status" });
  }
}

/**
 * Returns the raw token exactly once — never persisted, never
 * returned again by any other endpoint. Regenerating immediately
 * invalidates any previously issued export URL (the old raw token's
 * hash no longer matches the stored one).
 */
export async function regenerateIcalExportController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const token = await regenerateIcalExportToken(
      req.organization.id,
      requirePropertyId(req)
    );

    return res.status(200).json({ success: true, data: { token } });
  } catch (error) {
    console.error("Regenerate iCal export token error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to generate export URL",
    });
  }
}

/* ------------------------------- Amenities ------------------------------ */

export async function listAmenitiesController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await listAmenities(req.organization.id, requirePropertyId(req));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List amenities error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to load amenities" });
  }
}

export async function createAmenityController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const input = validateCreateAmenity(req.body);

    const data = await addAmenity(
      req.organization.id,
      requirePropertyId(req),
      input.name,
      input.category
    );

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Create amenity error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to create amenity",
    });
  }
}

export async function deleteAmenityController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const deleted = await removeAmenity(
      req.organization.id,
      requirePropertyId(req),
      req.params.amenityId
    );

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Amenity not found" });
    }

    return res.status(200).json({ success: true, message: "Amenity deleted successfully" });
  } catch (error) {
    console.error("Delete amenity error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to delete amenity",
    });
  }
}

/* ---------------------------------- Rules -------------------------------- */

export async function listRulesController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await listRules(req.organization.id, requirePropertyId(req));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List rules error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to load rules" });
  }
}

export async function createRuleController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const input = validateCreateRule(req.body);

    const data = await addRule(
      req.organization.id,
      requirePropertyId(req),
      input.title,
      input.description
    );

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Create rule error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to create rule",
    });
  }
}

export async function updateRuleController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const updates = validateUpdateRule(req.body);

    const data = await editRule(
      req.organization.id,
      requirePropertyId(req),
      req.params.ruleId,
      updates
    );

    if (!data) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Update rule error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to update rule",
    });
  }
}

export async function deleteRuleController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const deleted = await removeRule(
      req.organization.id,
      requirePropertyId(req),
      req.params.ruleId
    );

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }

    return res.status(200).json({ success: true, message: "Rule deleted successfully" });
  } catch (error) {
    console.error("Delete rule error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to delete rule",
    });
  }
}

/* -------------------------------- Documents ------------------------------ */

export async function listDocumentsController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const data = await listDocuments(req.organization.id, requirePropertyId(req));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List documents error:", error);

    if (isKnownError(error)) {
      return res.status(404).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: "Unable to load documents" });
  }
}

export async function requestDocumentUploadController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const input = validateRequestDocumentUpload(req.body);

    const data = await requestDocumentUpload(
      req.organization.id,
      requirePropertyId(req),
      input
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Request document upload error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to prepare document upload",
    });
  }
}

export async function confirmDocumentUploadController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const input = validateConfirmDocumentUpload(req.body);

    const data = await confirmDocumentUpload(
      req.organization.id,
      requirePropertyId(req),
      req.user.id,
      input
    );

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Confirm document upload error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to save uploaded document",
    });
  }
}

export async function deleteDocumentController(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization) {
      return res.status(403).json({ success: false, error: "Organization context is required" });
    }

    const deleted = await removeDocument(
      req.organization.id,
      requirePropertyId(req),
      req.params.documentId
    );

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }

    return res.status(200).json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete document error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error) ? error.message : "Unable to delete document",
    });
  }
}
