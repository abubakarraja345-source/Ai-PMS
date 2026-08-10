import { Router } from "express";
import {
  requireAuth,
} from "../../middleware/auth.middleware";
import {
  requireOrganization,
  OrganizationRequest,
} from "../../middleware/organization.middleware";
import { validateCreateReservation } from "./validation";
import {
  addReservation,
  editReservation,
  getReservation,
  getReservations,
  removeReservation,
} from "./service";

export const reservationRouter = Router();

reservationRouter.use(requireAuth);
reservationRouter.use(requireOrganization);

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

      const data = await getReservations(
        req.organization.id
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Get reservations error:",
        error
      );

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
        input
      );

      return res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Create reservation error:",
        error
      );

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
        req.body
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
        "Update reservation error:",
        error
      );

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

// DELETE /api/reservations/:id
reservationRouter.delete(
  "/:id",
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
