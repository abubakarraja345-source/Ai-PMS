import { Router } from "express";
import {
  requireAuth,
  AuthenticatedRequest,
} from "../../middleware/auth.middleware";
import { validateCreateReservation } from "./validation";
import {
  addReservation,
  editReservation,
  getReservation,
  getReservations,
  removeReservation,
} from "./service";
import { supabase } from "../../config/supabase";

export const reservationRouter = Router();

reservationRouter.use(requireAuth);

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

async function getOrganizationId(userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.organization_id ?? null;
}

// GET /api/reservations
reservationRouter.get(
  "/",
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const organizationId =
        await getOrganizationId(req.user.id);

      if (!organizationId) {
        return res.status(403).json({
          success: false,
          error: "Organization not found",
        });
      }

      const data = await getReservations(
        organizationId
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
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const organizationId =
        await getOrganizationId(req.user.id);

      if (!organizationId) {
        return res.status(403).json({
          success: false,
          error: "Organization not found",
        });
      }

      const data = await getReservation(
        organizationId,
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
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const organizationId =
        await getOrganizationId(req.user.id);

      if (!organizationId) {
        return res.status(403).json({
          success: false,
          error: "Organization not found",
        });
      }

      const input =
        validateCreateReservation(req.body);

      const data = await addReservation(
        organizationId,
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
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const organizationId =
        await getOrganizationId(req.user.id);

      if (!organizationId) {
        return res.status(403).json({
          success: false,
          error: "Organization not found",
        });
      }

      const data = await editReservation(
        organizationId,
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
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const organizationId =
        await getOrganizationId(req.user.id);

      if (!organizationId) {
        return res.status(403).json({
          success: false,
          error: "Organization not found",
        });
      }

      const deleted = await removeReservation(
        organizationId,
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