import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  getCleaningTasks,
  getCleaningTask,
  addCleaningTask,
  editCleaningTask,
  removeCleaningTask,
} from "./service";

import {
  validateCreateCleaningTask,
  validateUpdateCleaningTask,
  validateCleaningFilters,
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

export async function listCleaningTasks(
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

    const filters = validateCleaningFilters(
      req.query as Record<string, unknown>
    );

    const { page, limit } = parsePagination(
      req.query as Record<string, unknown>
    );

    const { data, total } = await getCleaningTasks(
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
    console.error("List cleaning tasks error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to load cleaning tasks",
    });
  }
}

export async function getCleaningTaskController(
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

    const task = await getCleaningTask(
      req.organization.id,
      req.params.id,
      req.user ? { role: req.organization.role, userId: req.user.id } : undefined
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Cleaning task not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("Get cleaning task error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load cleaning task",
    });
  }
}

export async function createCleaningTaskController(
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

    const input = validateCreateCleaningTask(req.body);

    const task = await addCleaningTask(
      req.organization.id,
      input
    );

    return res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("Create cleaning task error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error)
        ? error.message
        : "Unable to create cleaning task",
    });
  }
}

export async function updateCleaningTaskController(
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

    const updates = validateUpdateCleaningTask(req.body);

    const task = await editCleaningTask(
      req.organization.id,
      req.params.id,
      updates
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Cleaning task not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("Update cleaning task error:", error);

    return res.status(400).json({
      success: false,
      error: isKnownError(error)
        ? error.message
        : "Unable to update cleaning task",
    });
  }
}

export async function deleteCleaningTaskController(
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

    const deleted = await removeCleaningTask(
      req.organization.id,
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Cleaning task not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cleaning task deleted successfully",
    });
  } catch (error) {
    console.error("Delete cleaning task error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to delete cleaning task",
    });
  }
}
