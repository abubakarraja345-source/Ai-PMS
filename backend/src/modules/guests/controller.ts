import { Response } from "express";
import { OrganizationRequest } from "../../middleware/organization.middleware";

import {
  getGuests,
  getGuest,
  addGuest,
  editGuest,
  removeGuest,
} from "./service";

import {
  validateCreateGuest,
} from "./validation";

export class GuestsController {
  /**
   * GET /api/guests
   */
  static async getAll(
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

      const data = await getGuests(
        req.organization.id
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

      const data = await getGuest(
        req.organization.id,
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

      const input =
        validateCreateGuest(req.body);

      const data = await addGuest(
        req.organization.id,
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

  /**
   * PATCH /api/guests/:id
   */
  static async update(
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

      const data = await editGuest(
        req.organization.id,
        req.params.id,
        req.body
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
        "Update guest error:",
        error
      );

      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update guest",
      });
    }
  }

  /**
   * DELETE /api/guests/:id
   */
  static async remove(
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

      const deleted = await removeGuest(
        req.organization.id,
        req.params.id
      );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Guest not found",
        });
      }

      return res.json({
        success: true,
        message: "Guest deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete guest error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Failed to delete guest",
      });
    }
  }
}
