import { Router } from "express";
import {
  requireAuth,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { supabase } from "../config/supabase";
import {
  createGuest,
  findGuestById,
  findGuestsByOrganization,
} from "../modules/guests/repository";
import { validateCreateGuest } from "../modules/guests/validation";

export const guestRouter = Router();

guestRouter.use(requireAuth);

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

// GET /api/guests
guestRouter.get(
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

      const data =
        await findGuestsByOrganization(
          organizationId
        );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Get guests error:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to fetch guests",
      });
    }
  }
);

// GET /api/guests/:id
guestRouter.get(
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

      const data = await findGuestById(
        organizationId,
        req.params.id
      );

      if (!data) {
        return res.status(404).json({
          success: false,
          error: "Guest not found",
        });
      }

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Get guest error:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to fetch guest",
      });
    }
  }
);

// POST /api/guests
guestRouter.post(
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
        validateCreateGuest(req.body);

      const data = await createGuest(
        organizationId,
        input
      );

      return res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Create guest error:",
        error
      );

      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create guest",
      });
    }
  }
);