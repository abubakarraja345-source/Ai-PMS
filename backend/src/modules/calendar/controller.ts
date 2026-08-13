import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";
import { validateCalendarQuery } from "./validation";
import { getCalendarReservations } from "./service";

/**
 * Our own validation/ownership checks throw plain `Error`s
 * with friendly, intentional messages — safe to forward as
 * 400s. Supabase/Postgres failures throw PostgrestError
 * (which also extends Error) and must not reach the client —
 * those fall through to the generic 500 below.
 */
function isKnownError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.name !== "PostgrestError"
  );
}

export async function listCalendarReservations(
  req: OrganizationRequest,
  res: Response
) {
  try {
    if (!req.organization || !req.user) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    const { start, end, property_id } =
      validateCalendarQuery(
        req.query as Record<string, unknown>
      );

    const data = await getCalendarReservations(
      req.organization.id,
      start,
      end,
      property_id,
      { role: req.organization.role, userId: req.user.id }
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "List calendar reservations error:",
      error
    );

    if (isKnownError(error)) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Unable to load calendar reservations",
    });
  }
}
