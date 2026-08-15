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
import { ReservationListItem } from "../modules/reservations/types";

import { computeConnectionHealth } from "../modules/integrations/health";
import { ConnectionHealth } from "../modules/integrations/types";
import { resolvePropertyScope } from "../modules/permissions/propertyScope";
import { getOrganizationSettings } from "../modules/settings/service";

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
/**
 * Phase 7.4 fail-closed case — a restricted caller (Manager/Host/
 * Spectator) with ZERO property_assignments rows sees an entirely
 * empty dashboard rather than the org-wide one. Shape matches
 * getDashboardSummary's own return value exactly.
 */
function buildEmptyDashboardSummary(today: string) {
  return {
    stats: {
      totalProperties: 0,
      activeProperties: 0,
      availableProperties: 0,
      totalReservations: 0,
      pendingReservations: 0,
      occupiedProperties: 0,
      reviewRequired: 0,
      totalGuests: 0,
      cleaningTasks: 0,
      maintenanceTickets: 0,
    },
    today: {
      date: today,
      checkIns: [] as ReservationListItem[],
      checkOuts: [] as ReservationListItem[],
      currentStaysCount: 0,
      pendingReservations: 0,
    },
    upcomingReservations: [] as ReservationListItem[],
    recentActivity: [] as Array<
      | {
          type: "reservation_created";
          id: string;
          created_at: string;
          guest: string;
          property: string;
          status: string | null;
          booking_reference: string | null;
        }
      | { type: "guest_created"; id: string; created_at: string; guest: string }
    >,
    revenue: {
      byCurrency: [] as { currency: string; total: number; count: number; totalBase: number }[],
      baseCurrency: "USD",
    },
    occupancy: { occupiedProperties: 0, activeProperties: 0, occupancyRate: 0 },
    cleaning: { total: 0, pending: 0, inProgress: 0 },
    maintenance: { total: 0, open: 0, inProgress: 0, urgent: 0 },
    inventory: { totalItems: 0, lowStockCount: 0 },
    integrations: { total: 0, active: 0, error: 0 },
    calendarHealth: {
      healthy: 0,
      warning: 0,
      error: 0,
      disabled: 0,
      needsAttention: 0,
    },
  };
}

/**
 * Phase 7.4 — scopedPropertyIds is only ever set for a property-scope-
 * restricted caller (Manager/Host/Spectator with assignments — see
 * permissions/propertyScope.ts). Undefined/null means unrestricted,
 * the exact same queries as before this phase. Guests and
 * integrations are deliberately NOT scoped here — a guest isn't
 * attributable to a single property (they may have stays at several),
 * and an org's connected integrations list isn't per-property
 * sensitive data the way reservation/guest details are; both remain
 * organization-wide regardless of the caller's property scope, same
 * as Team page's org info. This is a documented boundary, not an
 * oversight — see the Phase 7.4 checkpoint report.
 */
export async function getDashboardSummary(
  organizationId: string,
  scopedPropertyIds?: string[] | null
) {
  const today = todayUTC();
  const scoped = scopedPropertyIds && scopedPropertyIds.length > 0 ? scopedPropertyIds : null;

  // A restricted caller with zero assignments must never fall back to
  // "see everything" — an empty (non-null) array means "restricted,
  // nothing assigned," which is deliberately distinct from
  // scopedPropertyIds being undefined/null (unrestricted).
  if (scopedPropertyIds && scopedPropertyIds.length === 0) {
    return buildEmptyDashboardSummary(today);
  }

      let propertiesQuery = supabase
        .from("properties")
        .select("status")
        .eq("organization_id", organizationId);
      if (scoped) propertiesQuery = propertiesQuery.in("id", scoped);

      let totalReservationsQuery = supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (scoped) totalReservationsQuery = totalReservationsQuery.in("property_id", scoped);

      let pendingReservationsQuery = supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "pending");
      if (scoped) pendingReservationsQuery = pendingReservationsQuery.in("property_id", scoped);

      let reviewRequiredQuery = supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("needs_review", true);
      if (scoped) reviewRequiredQuery = reviewRequiredQuery.in("property_id", scoped);

      let revenueQuery = supabase
        .from("reservations")
        .select("total_amount, currency, amount_base")
        .eq("organization_id", organizationId)
        .in("status", ["confirmed", "completed"]);
      if (scoped) revenueQuery = revenueQuery.in("property_id", scoped);

      // Org's base currency — lets the revenue-by-currency cards show a
      // "≈ converted" line using each reservation's own amount_base
      // snapshot (computed once at booking time, see reservations/
      // service.ts's addReservation) rather than re-converting live,
      // which would drift from what was actually charged.
      //
      // Deliberately getOrganizationSettings() (the settings table's
      // base_currency, falling back to its own currency column), NOT
      // a direct `organizations.currency` lookup — caught live: those
      // are two different, independent columns (see settings/
      // service.ts's own comment on why they're kept separate).
      // addReservation computes amount_base against
      // getOrganizationSettings()'s baseCurrency specifically, so
      // reading anything else here produces a baseCurrency that
      // doesn't match what was actually converted — the exact bug
      // that showed up as "≈ PKR 0.00" for a $356 reservation.
      const organizationSettingsPromise = getOrganizationSettings(organizationId);

      let cleaningTasksQuery = supabase
        .from("cleaning_tasks")
        .select("status")
        .eq("organization_id", organizationId);
      if (scoped) cleaningTasksQuery = cleaningTasksQuery.in("property_id", scoped);

      let maintenanceTicketsQuery = supabase
        .from("maintenance_tickets")
        .select("status, priority")
        .eq("organization_id", organizationId);
      if (scoped) maintenanceTicketsQuery = maintenanceTicketsQuery.in("property_id", scoped);

      let inventoryQuery = supabase
        .from("inventory_items")
        .select("quantity, minimum_quantity")
        .eq("organization_id", organizationId);
      if (scoped) inventoryQuery = inventoryQuery.in("property_id", scoped);

      const [
        propertiesResult,
        totalReservationsResult,
        pendingReservationsResult,
        reviewRequiredResult,
        activeAndUpcoming,
        revenueResult,
        organizationSettings,
        recentReservations,
        recentGuestsResult,
        totalGuestsResult,
        cleaningTasksResult,
        maintenanceTicketsResult,
        inventoryResult,
        integrationsResult,
      ] = await Promise.all([
        propertiesQuery,
        totalReservationsQuery,
        pendingReservationsQuery,
        reviewRequiredQuery,

        findActiveAndUpcomingReservations(
          organizationId,
          today,
          200,
          scoped ?? undefined
        ),

        revenueQuery,
        organizationSettingsPromise,

        findRecentReservations(organizationId, 5, scoped ?? undefined),

        // Not property-scoped — see this function's own comment.
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

        cleaningTasksQuery,
        maintenanceTicketsQuery,
        inventoryQuery,

        // Not property-scoped — see this function's own comment.
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

      const baseCurrency = organizationSettings.baseCurrency;

      const revenueByCurrency = new Map<
        string,
        { total: number; count: number; totalBase: number }
      >();

      for (const row of revenueResult.data ?? []) {
        if (row.total_amount === null) continue;

        const currency = row.currency ?? "USD";
        const existing = revenueByCurrency.get(
          currency
        ) ?? { total: 0, count: 0, totalBase: 0 };

        existing.total += row.total_amount;
        existing.count += 1;
        // amount_base is only populated when a conversion actually
        // happened (see addReservation) — when a reservation's own
        // currency already IS the org's base currency, total_amount
        // already IS the base-currency amount, so that's the fallback
        // rather than treating a missing snapshot as 0.
        existing.totalBase +=
          row.amount_base ?? (currency === baseCurrency ? row.total_amount : 0);

        revenueByCurrency.set(currency, existing);
      }

      const revenue = Array.from(
        revenueByCurrency.entries()
      ).map(([currency, { total, count, totalBase }]) => ({
        currency,
        total: Math.round(total * 100) / 100,
        count,
        // Only meaningful (and only ever shown by the frontend) when
        // this currency differs from baseCurrency below — equal to
        // `total` itself when it doesn't.
        totalBase: Math.round(totalBase * 100) / 100,
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
          baseCurrency,
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
      const scope = req.user
        ? await resolvePropertyScope(
            req.organization!.id,
            req.organization!.role,
            req.user.id
          )
        : { restricted: false, propertyIds: [] };

      const data = await getDashboardSummary(
        req.organization!.id,
        scope.restricted ? scope.propertyIds : undefined
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