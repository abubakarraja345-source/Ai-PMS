import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import { validateReportsQuery } from "./validation";
import { getReportsSummary } from "./service";

/**
 * Our own validation throws plain `Error`s with friendly,
 * intentional messages — safe to forward as 400s. Supabase/
 * Postgres failures throw PostgrestError (which also extends
 * Error) and must not reach the client — those fall through to
 * a generic sanitized 500 instead.
 */
function isKnownError(error: unknown): error is Error {
  return (
    error instanceof Error && error.name !== "PostgrestError"
  );
}

export async function getReportsSummaryController(
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

    const { start, end } = validateReportsQuery(
      req.query as Record<string, unknown>
    );

    const data = await getReportsSummary(
      req.organization.id,
      start,
      end
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Reports summary error:", error);

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to load reports summary",
    });
  }
}
