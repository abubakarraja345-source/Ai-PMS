import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  getMaintenanceTickets,
  getMaintenanceTicket,
  addMaintenanceTicket,
  editMaintenanceTicket,
  removeMaintenanceTicket,
} from "./service";

import {
  validateCreateMaintenanceTicket,
  validateUpdateMaintenanceTicket,
  validateMaintenanceFilters,
} from "./validation";

import {
  buildPaginationMeta,
  getRange,
  parsePagination,
} from "../../utils/pagination";

/**
 * Our own validation/ownership checks throw plain `Error`s
 * with friendly, intentional messages — safe to forward as
 * 400s. Supabase/Postgres failures throw PostgrestError (which
 * also extends Error) and must not reach the client — those
 * fall through to a generic sanitized message instead.
 */
function isKnownError(error: unknown): error is Error {
  return (
    error instanceof Error && error.name !== "PostgrestError"
  );
}

export async function listMaintenanceTickets(
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

    const filters = validateMaintenanceFilters(
      req.query as Record<string, unknown>
    );

    const { page, limit } = parsePagination(
      req.query as Record<string, unknown>
    );

    const { data, total } = await getMaintenanceTickets(
      req.organization.id,
      filters,
      getRange(page, limit),
      req.user ? { role: req.organization.role, userId: req.user.id } : undefined
    );

    return res.status(200).json({
      success: true,
      data,
      meta: buildPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error("List maintenance tickets error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to load maintenance tickets",
    });
  }
}

export async function getMaintenanceTicketController(
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

    const ticket = await getMaintenanceTicket(
      req.organization.id,
      req.params.id,
      req.user ? { role: req.organization.role, userId: req.user.id } : undefined
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: "Maintenance ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Get maintenance ticket error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load maintenance ticket",
    });
  }
}

export async function createMaintenanceTicketController(
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

    const input = validateCreateMaintenanceTicket(req.body);

    const ticket = await addMaintenanceTicket(
      req.organization.id,
      req.user.id,
      input
    );

    return res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Create maintenance ticket error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error)
        ? error.message
        : "Unable to create maintenance ticket",
    });
  }
}

export async function updateMaintenanceTicketController(
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

    const updates = validateUpdateMaintenanceTicket(
      req.body
    );

    const ticket = await editMaintenanceTicket(
      req.organization.id,
      req.params.id,
      updates
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: "Maintenance ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Update maintenance ticket error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error)
        ? error.message
        : "Unable to update maintenance ticket",
    });
  }
}

export async function deleteMaintenanceTicketController(
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

    const deleted = await removeMaintenanceTicket(
      req.organization.id,
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Maintenance ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Maintenance ticket deleted successfully",
    });
  } catch (error) {
    console.error("Delete maintenance ticket error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to delete maintenance ticket",
    });
  }
}
