import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import { listAuditLog } from "./service";
import { validateAuditLogFilters } from "./validation";

function isKnownError(error: unknown): error is Error {
  return error instanceof Error && error.name !== "PostgrestError";
}

export async function listAuditLogController(
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

    const filters = validateAuditLogFilters(
      req.query as Record<string, unknown>
    );

    const page = Number(req.query.page) || 1;

    const result = await listAuditLog(req.organization.id, filters, page);

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
      },
    });
  } catch (error) {
    console.error("List audit log error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to load audit log",
    });
  }
}
