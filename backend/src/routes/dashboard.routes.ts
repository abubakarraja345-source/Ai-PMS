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

import {
  findActiveAndUpcomingReservations,
  findRecentReservations,
} from "../modules/reservations/repository";

import { computeConnectionHealth } from "../modules/integrations/health";
import { ConnectionHealth } from "../modules/integrations/types";

const router = Router();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

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

/**
 * GET /api/dashboard/summary
 *
 * A single, consolidated dashboard payload — stats, today's
 * check-ins/check-outs, upcoming reservations, recent activity,
 * revenue (grouped by currency), and occupancy — computed from
 * a small, fixed, parallelized set of queries rather than one
 * request per widget.
 *
 * Business rules (documented since the schema doesn't encode
 * them):
 * - "Occupied" / "current stays" / today's check-ins & check-outs
 *   count `confirmed` + `pending` reservations. `cancelled` never
 *   occupied the property; a `completed` reservation still
 *   spanning today would be a data inconsistency, not something
 *   to present as active.
 * - Revenue counts `confirmed` + `completed` reservations only
 *   (pending hasn't been confirmed; cancelled never happened),
 *   grouped by currency — never summed across currencies. This
 *   stays true even though an organization default currency exists
 *   (settings.currency, see Phase 5's currency-support report):
 *   summing revenue figures denominated in different real-world
 *   currencies into one number is mathematically invalid regardless
 *   of which currency is "default" for new bookings, so grouping by
 *   currency is the correct behavior, not a workaround for a missing
 *   field.
 * - Occupancy rate is occupied-properties ÷ active-properties
 *   (inactive listings aren't part of the rentable pool).
 */
/**
 * Builds the same consolidated payload as GET /summary below, as a
 * plain function so other server-side callers (the AI context layer)
 * can reuse these exact business rules — occupancy, revenue-by-
 * currency, low-stock, etc. — instead of recomputing a second,
 * potentially conflicting definition.
 */
export async function getDashboardSummary(organizationId: string) {
  const today = todayUTC();

      const [
        propertiesResult,
        totalReservationsResult,
        pendingReservationsResult,
        reviewRequiredResult,
        activeAndUpcoming,
        revenueResult,
        recentReservations,
        recentGuestsResult,
        totalGuestsResult,
        cleaningTasksResult,
        maintenanceTicketsResult,
        inventoryResult,
        integrationsResult,
      ] = await Promise.all([
        supabase
          .from("properties")
          .select("status")
          .eq("organization_id", organizationId),

        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId),

        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("status", "pending"),

        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("needs_review", true),

        findActiveAndUpcomingReservations(
          organizationId,
          today
        ),

        supabase
          .from("reservations")
          .select("total_amount, currency")
          .eq("organization_id", organizationId)
          .in("status", ["confirmed", "completed"]),

        findRecentReservations(organizationId, 5),

        supabase
          .from("guests")
          .select(
            "id, first_name, last_name, created_at"
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("guests")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId),

        supabase
          .from("cleaning_tasks")
          .select("status")
          .eq("organization_id", organizationId),

        supabase
          .from("maintenance_tickets")
          .select("status, priority")
          .eq("organization_id", organizationId),

        supabase
          .from("inventory_items")
          .select("quantity, minimum_quantity")
          .eq("organization_id", organizationId),

        supabase
          .from("integrations")
          .select("id, status, consecutive_failure_count")
          .eq("organization_id", organizationId),
      ]);

      if (propertiesResult.error) throw propertiesResult.error;
      if (totalReservationsResult.error)
        throw totalReservationsResult.error;
      if (pendingReservationsResult.error)
        throw pendingReservationsResult.error;
      if (reviewRequiredResult.error) throw reviewRequiredResult.error;
      if (revenueResult.error) throw revenueResult.error;
      if (recentGuestsResult.error)
        throw recentGuestsResult.error;
      if (totalGuestsResult.error)
        throw totalGuestsResult.error;
      if (cleaningTasksResult.error)
        throw cleaningTasksResult.error;
      if (maintenanceTicketsResult.error)
        throw maintenanceTicketsResult.error;
      if (inventoryResult.error) throw inventoryResult.error;
      if (integrationsResult.error) throw integrationsResult.error;

      const cleaningTasks = cleaningTasksResult.data ?? [];
      const cleaningSummary = {
        total: cleaningTasks.length,
        pending: cleaningTasks.filter((t) => t.status === "pending").length,
        inProgress: cleaningTasks.filter((t) => t.status === "in_progress")
          .length,
      };

      const maintenanceTickets = maintenanceTicketsResult.data ?? [];
      const maintenanceSummary = {
        total: maintenanceTickets.length,
        open: maintenanceTickets.filter((t) => t.status === "open").length,
        inProgress: maintenanceTickets.filter(
          (t) => t.status === "in_progress"
        ).length,
        urgent: maintenanceTickets.filter(
          (t) =>
            t.priority === "urgent" &&
            !["resolved", "closed", "cancelled"].includes(t.status ?? "")
        ).length,
      };

      const inventoryItems = inventoryResult.data ?? [];
      const lowStockCount = inventoryItems.filter(
        (i) => i.quantity <= i.minimum_quantity
      ).length;

      const integrations = integrationsResult.data ?? [];
      const integrationsSummary = {
        total: integrations.length,
        active: integrations.filter((i) => i.status === "active").length,
        error: integrations.filter((i) => i.status === "error").length,
      };

      // "Calendar Health" — buckets every integration by the same
      // ConnectionHealth enum the integrations module itself computes
      // (see modules/integrations/health.ts), rather than the raw
      // status column above, so a feed that's gone silently stale
      // shows up here even while its status column still says "active".
      // lastSuccessfulSyncAt isn't a column on integrations itself (see
      // integrations/repository.ts's findLastSuccessfulSyncLog) — it's
      // derived from sync_logs, so it's fetched here in one bulk query
      // across every integration in the org rather than N+1 queries.
      const integrationIds = integrations.map((i) => i.id);

      const lastSuccessByIntegration = new Map<string, string>();

      if (integrationIds.length > 0) {
        const { data: successLogs, error: successLogsError } = await supabase
          .from("sync_logs")
          .select("integration_id, synced_at")
          .in("integration_id", integrationIds)
          .eq("status", "success")
          .order("synced_at", { ascending: false });

        if (successLogsError) throw successLogsError;

        for (const log of successLogs ?? []) {
          if (!lastSuccessByIntegration.has(log.integration_id)) {
            lastSuccessByIntegration.set(log.integration_id, log.synced_at);
          }
        }
      }

      const calendarHealthBuckets: Record<ConnectionHealth, number> = {
        healthy: 0,
        warning: 0,
        error: 0,
        disabled: 0,
      };

      for (const integration of integrations) {
        const health = computeConnectionHealth({
          status: integration.status,
          consecutiveFailureCount: integration.consecutive_failure_count ?? 0,
          lastSuccessfulSyncAt:
            lastSuccessByIntegration.get(integration.id) ?? null,
        });

        calendarHealthBuckets[health] += 1;
      }

      const calendarHealth = {
        ...calendarHealthBuckets,
        needsAttention:
          calendarHealthBuckets.warning + calendarHealthBuckets.error,
      };

      const properties = propertiesResult.data ?? [];
      const totalProperties = properties.length;
      const activeProperties = properties.filter(
        (p) => p.status === "active"
      ).length;

      const todayCheckIns = activeAndUpcoming.filter(
        (r) => r.check_in === today
      );

      const todayCheckOuts = activeAndUpcoming.filter(
        (r) => r.check_out === today
      );

      const currentStays = activeAndUpcoming.filter(
        (r) => r.check_in <= today && r.check_out > today
      );

      const occupiedProperties = new Set(
        currentStays.map((r) => r.property_id)
      ).size;

      // "Available" = active listings not currently occupied. Floored
      // at 0 rather than allowed to go negative — an inactive property
      // could theoretically still show as "occupied" from a lingering
      // reservation, which shouldn't ever read as a negative count.
      const availableProperties = Math.max(
        activeProperties - occupiedProperties,
        0
      );

      const upcomingReservations = activeAndUpcoming
        .filter((r) => r.check_in >= today)
        .slice(0, 10);

      const occupancyRate =
        activeProperties > 0
          ? Math.round(
              (occupiedProperties / activeProperties) *
                1000
            ) / 10
          : 0;

      const revenueByCurrency = new Map<
        string,
        { total: number; count: number }
      >();

      for (const row of revenueResult.data ?? []) {
        if (row.total_amount === null) continue;

        const currency = row.currency ?? "USD";
        const existing = revenueByCurrency.get(
          currency
        ) ?? { total: 0, count: 0 };

        existing.total += row.total_amount;
        existing.count += 1;

        revenueByCurrency.set(currency, existing);
      }

      const revenue = Array.from(
        revenueByCurrency.entries()
      ).map(([currency, { total, count }]) => ({
        currency,
        total: Math.round(total * 100) / 100,
        count,
      }));

      const recentActivity = [
        ...recentReservations.map((r) => ({
          type: "reservation_created" as const,
          id: r.id,
          created_at: r.created_at,
          guest: r.guest
            ? `${r.guest.first_name} ${
                r.guest.last_name ?? ""
              }`.trim()
            : "Unknown guest",
          property: r.property?.title ?? "Unknown property",
          status: r.status,
          booking_reference: r.booking_reference,
        })),
        ...(recentGuestsResult.data ?? []).map((g) => ({
          type: "guest_created" as const,
          id: g.id,
          created_at: g.created_at,
          guest: `${g.first_name} ${
            g.last_name ?? ""
          }`.trim(),
        })),
      ]
        .sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        )
        .slice(0, 8);

      return {
        stats: {
          totalProperties,
          activeProperties,
          availableProperties,
          totalReservations:
            totalReservationsResult.count ?? 0,
          pendingReservations:
            pendingReservationsResult.count ?? 0,
          occupiedProperties,
          reviewRequired: reviewRequiredResult.count ?? 0,
          totalGuests: totalGuestsResult.count ?? 0,
          cleaningTasks: cleaningSummary.total,
          maintenanceTickets: maintenanceSummary.total,
        },
        today: {
          date: today,
          checkIns: todayCheckIns,
          checkOuts: todayCheckOuts,
          currentStaysCount: currentStays.length,
          pendingReservations:
            pendingReservationsResult.count ?? 0,
        },
        upcomingReservations,
        recentActivity,
        revenue: {
          byCurrency: revenue,
        },
        occupancy: {
          occupiedProperties,
          activeProperties,
          occupancyRate,
        },
        cleaning: cleaningSummary,
        maintenance: maintenanceSummary,
        inventory: {
          totalItems: inventoryItems.length,
          lowStockCount,
        },
        integrations: integrationsSummary,
        calendarHealth,
      };
}

export type DashboardSummary = Awaited<
  ReturnType<typeof getDashboardSummary>
>;

router.get(
  "/summary",
  requireAuth,
  requireOrganization,
  async (req: OrganizationRequest, res: Response) => {
    try {
      const data = await getDashboardSummary(
        req.organization!.id
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Dashboard summary error:", error);

      return res.status(500).json({
        success: false,
        error: "Unable to load dashboard summary",
      });
    }
  }
);

export default router;