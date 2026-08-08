import { Router, Response } from "express";
import { supabase } from "../config/supabase";

import {
  AuthenticatedRequest,
  requireAuth,
} from "../middleware/auth.middleware";

import {
  OrganizationRequest,
  requireOrganization,
} from "../middleware/organization.middleware";

const router = Router();

router.get(
  "/stats",
  requireAuth,
  requireOrganization,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const organizationId = req.organization!.id;

      // Properties
      const { count: totalProperties, error: propertiesError } =
        await supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId);

      if (propertiesError) {
        throw propertiesError;
      }

      const { count: activeProperties, error: activePropertiesError } =
        await supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("status", "active");

      if (activePropertiesError) {
        throw activePropertiesError;
      }

      // Reservations
      const { count: totalReservations, error: reservationsError } =
        await supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId);

      if (reservationsError) {
        throw reservationsError;
      }

      // Guests
      const { count: totalGuests, error: guestsError } =
        await supabase
          .from("guests")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId);

      if (guestsError) {
        throw guestsError;
      }

      // Cleaning tasks
      const { count: cleaningTasks, error: cleaningError } =
        await supabase
          .from("cleaning_tasks")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId);

      if (cleaningError) {
        throw cleaningError;
      }

      // Maintenance tickets
      const { count: maintenanceTickets, error: maintenanceError } =
        await supabase
          .from("maintenance_tickets")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId);

      if (maintenanceError) {
        throw maintenanceError;
      }

      return res.json({
        success: true,
        data: {
          totalProperties: totalProperties ?? 0,
          activeProperties: activeProperties ?? 0,
          totalReservations: totalReservations ?? 0,
          totalGuests: totalGuests ?? 0,
          cleaningTasks: cleaningTasks ?? 0,
          maintenanceTickets: maintenanceTickets ?? 0,
        },
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);

      return res.status(500).json({
        success: false,
        error: "Unable to load dashboard statistics",
      });
    }
  }
);

export default router;