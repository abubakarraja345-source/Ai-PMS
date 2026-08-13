import { Router } from "express";
import {
  requireAuth,
} from "../../middleware/auth.middleware";
import {
  requireOrganization,
  OrganizationRequest,
} from "../../middleware/organization.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import {
  validateCreateReservation,
  validateReservationFilters,
} from "./validation";
import {
  addReservation,
  clearReviewFlag,
  editReservation,
  findConflictingReservations,
  getReservation,
  getReservations,
  getReservationStatusCounts,
  removeReservation,
  ReservationConflictError,
} from "./service";
import {
  buildPaginationMeta,
  getRange,
  parsePagination,
} from "../../utils/pagination";

export const reservationRouter = Router();

reservationRouter.use(requireAuth);
reservationRouter.use(requireOrganization);

/**
 * Only permanent deletion is restricted — creating/editing
 * reservations remains open to every role, since that's the core
 * front-desk workflow. This was a pre-existing gap: any "member"
 * could previously delete any reservation with no role check.
 *
 * Phase 7: migrated from requireRole("owner","company_admin") to
 * requirePermission per-action (reservations.review /
 * reservations.delete), same effective access as before for every
 * existing role. The generic PATCH /:id endpoint below is
 * deliberately NOT migrated to requirePermission here — it gets the
 * field-diff approval interceptor in the next checkpoint instead of a
 * single coarse gate, since one generic endpoint covers many
 * different kinds of edits with different permission requirements.
 */

/**
 * Returns a client-safe error message.
 *
 * Our own validation code throws plain `Error`s with
 * friendly, intentional messages — those are safe to
 * forward. Supabase/Postgres failures throw PostgrestError
 * (which also extends Error), whose `.message` can contain
 * raw constraint/column/table names — those must not reach
 * the client.
 */
function toClientErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    error instanceof Error &&
    error.name !== "PostgrestError"
  ) {
    return error.message;
  }

  return fallback;
}

// GET /api/reservations
reservationRouter.get(
  "/",
  async (req: OrganizationRequest, res) => {
    try {
      if (!req.organization) {
        return res.status(403).json({
          success: false,
          error: "Organization context is required",
        });
      }

      const filters = validateReservationFilters(
        req.query as Record<string, unknown>
      );

      const { page, limit } = parsePagination(
        req.query as Record<string, unknown>
      );

      const filtersWithoutStatus: Omit<
        typeof filters,
        "status"
      > = {};

      if (filters.guestId !== undefined)
        filtersWithoutStatus.guestId = filters.guestId;
      if (filters.propertyId !== undefined)
        filtersWithoutStatus.propertyId = filters.propertyId;
      if (filters.search !== undefined)
        filtersWithoutStatus.search = filters.search;
      if (filters.start !== undefined)
        filtersWithoutStatus.start = filters.start;
      if (filters.end !== undefined)
        filtersWithoutStatus.end = filters.end;

      const [{ data, total }, statusCounts] = await Promise.all([
        getReservations(
          req.organization.id,
          filters,
          getRange(page, limit)
        ),
        getReservationStatusCounts(
          req.organization.id,
          filtersWithoutStatus
        ),
      ]);

      return res.json({
        success: true,
        data,
        meta: {
          ...buildPaginationMeta(page, limit, total),
          statusCounts,
        },
      });
    } catch (error) {
      console.error(
        "Get reservations error:",
        error
      );

      if (
        error instanceof Error &&
        error.name !== "PostgrestError"
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Failed to fetch reservations",
      });
    }
  }
);

// GET /api/reservations/:id
reservationRouter.get(
  "/:id",
  async (req: OrganizationRequest, res) => {
    try {
      if (!req.organization) {
        return res.status(403).json({
          success: false,
          error: "Organization context is required",
        });
      }

      const data = await getReservation(
        req.organization.id,
        req.params.id
      );

      if (!data) {
        return res.status(404).json({
          success: false,
          error: "Reservation not found",
        });
      }

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Get reservation error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to fetch reservation",
      });
    }
  }
);

// POST /api/reservations
reservationRouter.post(
  "/",
  async (req: OrganizationRequest, res) => {
    try {
      if (!req.organization) {
        return res.status(403).json({
          success: false,
          error: "Organization context is required",
        });
      }

      const input =
        validateCreateReservation(req.body);

      const data = await addReservation(
        req.organization.id,
        input,
        req.user
      );

      return res.status(201).json({
        success: true,
        data,
        // Creation now hard-blocks on a real conflict (see
        // ReservationConflictError below), so this is only ever
        // nonzero in the rare case the post-insert safety net in
        // addReservation had to flag a race-created conflict for
        // review — kept as `conflictCount` for the existing frontend
        // contract rather than a boolean.
        conflictCount: data.needs_review ? 1 : 0,
      });
    } catch (error) {
      console.error(
        "Create reservation error:",
        error
      );

      if (error instanceof ReservationConflictError) {
        return res.status(409).json({
          success: false,
          error: error.message,
          data: error.conflict,
        });
      }

      return res.status(400).json({
        success: false,
        error: toClientErrorMessage(
          error,
          "Failed to create reservation"
        ),
      });
    }
  }
);

// PATCH /api/reservations/:id
reservationRouter.patch(
  "/:id",
  async (req: OrganizationRequest, res) => {
    try {
      if (!req.organization) {
        return res.status(403).json({
          success: false,
          error: "Organization context is required",
        });
      }

      const data = await editReservation(
        req.organization.id,
        req.params.id,
        req.body,
        req.user
      );

      if (!data) {
        return res.status(404).json({
          success: false,
          error: "Reservation not found",
        });
      }

      const conflicts = await findConflictingReservations(
        req.organization.id,
        data.property_id,
        data.check_in,
        data.check_out,
        data.id
      );

      return res.json({
        success: true,
        data,
        conflictCount: conflicts.length,
      });
    } catch (error) {
      console.error(
        "Update reservation error:",
        error
      );

      if (error instanceof ReservationConflictError) {
        return res.status(409).json({
          success: false,
          error: error.message,
          data: error.conflict,
        });
      }

      return res.status(400).json({
        success: false,
        error: toClientErrorMessage(
          error,
          "Failed to update reservation"
        ),
      });
    }
  }
);

// PATCH /api/reservations/:id/review
// Clears needs_review after staff have looked at a sync-flagged
// reservation. Same coarse gate as permanent deletion — owner/
// company_admin only, matching this router's one existing role-gated
// action (DELETE below). A 2-segment path, so this can never collide
// with the general "PATCH /:id" route above regardless of order.
reservationRouter.patch(
  "/:id/review",
  requirePermission("reservations.review"),
  async (req: OrganizationRequest, res) => {
    try {
      if (!req.organization) {
        return res.status(403).json({
          success: false,
          error: "Organization context is required",
        });
      }

      const reservationId = req.params.id;

      if (!reservationId) {
        return res.status(400).json({
          success: false,
          error: "Reservation ID is required",
        });
      }

      const data = await clearReviewFlag(
        req.organization.id,
        reservationId,
        req.user
      );

      if (!data) {
        return res.status(404).json({
          success: false,
          error: "Reservation not found",
        });
      }

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Clear reservation review flag error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to update reservation",
      });
    }
  }
);

// DELETE /api/reservations/:id
reservationRouter.delete(
  "/:id",
  requirePermission("reservations.delete"),
  async (req: OrganizationRequest, res) => {
    try {
      if (!req.organization) {
        return res.status(403).json({
          success: false,
          error: "Organization context is required",
        });
      }

      const deleted = await removeReservation(
        req.organization.id,
        req.params.id
      );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Reservation not found",
        });
      }

      return res.json({
        success: true,
        message: "Reservation deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete reservation error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to delete reservation",
      });
    }
  }
);
