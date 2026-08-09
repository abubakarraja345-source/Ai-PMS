import { Response } from "express";
import {
  AuthenticatedRequest,
} from "../../middleware/auth.middleware";

import {
  getGuests,
  getGuest,
  addGuest,
} from "./service";

import {
  validateCreateGuest,
} from "./validation";

import { supabase } from "../../config/supabase";

async function getOrganizationId(
  userId: string
) {
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

export class GuestsController {
  /**
   * GET /api/guests
   */
  static async getAll(
    req: AuthenticatedRequest,
    res: Response
  ) {
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

      const data = await getGuests(
        organizationId
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Get guests error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to fetch guests",
      });
    }
  }

  /**
   * GET /api/guests/:id
   */
  static async getOne(
    req: AuthenticatedRequest,
    res: Response
  ) {
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

      const data = await getGuest(
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
      console.error(
        "Get guest error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to fetch guest",
      });
    }
  }

  /**
   * POST /api/guests
   */
  static async create(
    req: AuthenticatedRequest,
    res: Response
  ) {
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

      const data = await addGuest(
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
}