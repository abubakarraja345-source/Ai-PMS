import {
  findReservationsCreatedInRange,
  findReservationsOverlappingRange,
  findPropertiesForOrganization,
  findGuestsCreatedInRange,
  findCleaningTasksCreatedInRange,
  findMaintenanceTicketsCreatedInRange,
  findInventoryForOrganization,
} from "./repository";

import {
  materializedReservations,
  getBucketGranularity,
  countBy,
  bucketCounts,
  revenueByCurrency,
  revenueTrend,
  adrByCurrency,
  cancellationRate,
  averageLeadTimeDays,
  computeOccupancy,
  computeRepeatGuests,
  vipProportion,
  averageHoursBetween,
  average,
  sum,
  round2,
} from "./calculations";

import { ReportsSummary } from "./types";

export async function getReportsSummary(
  organizationId: string,
  start: string,
  end: string
): Promise<ReportsSummary> {
  // created_at is a timestamp, so the range needs to be
  // expressed as timestamps, not bare dates, for a correct
  // >= start AND < end comparison.
  const startTimestamp = `${start}T00:00:00.000Z`;
  const endTimestamp = `${end}T00:00:00.000Z`;

  const [
    reservationsCreated,
    occupancyReservations,
    properties,
    guestsCreated,
    cleaningTasks,
    maintenanceTickets,
    inventoryItems,
  ] = await Promise.all([
    findReservationsCreatedInRange(
      organizationId,
      startTimestamp,
      endTimestamp
    ),
    findReservationsOverlappingRange(
      organizationId,
      start,
      end
    ),
    findPropertiesForOrganization(organizationId),
    findGuestsCreatedInRange(
      organizationId,
      startTimestamp,
      endTimestamp
    ),
    findCleaningTasksCreatedInRange(
      organizationId,
      startTimestamp,
      endTimestamp
    ),
    findMaintenanceTicketsCreatedInRange(
      organizationId,
      startTimestamp,
      endTimestamp
    ),
    findInventoryForOrganization(organizationId),
  ]);

  const granularity = getBucketGranularity(start, end);

  const activeProperties = properties.filter(
    (p) => p.status === "active"
  );

  const propertyTitleById = new Map(
    properties.map((p) => [p.id, p.title])
  );

  const materialized = materializedReservations(
    reservationsCreated
  );

  // ---- Overview + Revenue ----
  const revenue = revenueByCurrency(materialized);
  const adr = adrByCurrency(materialized);

  const avgLengthOfStay = average(
    materialized
      .map((r) => r.nights)
      .filter((n): n is number => n !== null)
  );

  const cxRate = cancellationRate(reservationsCreated);

  const portfolioOccupancy = computeOccupancy(
    occupancyReservations,
    activeProperties.length,
    start,
    end
  );

  const trend = revenueTrend(materialized, granularity);

  // ---- Bookings ----
  const volumeTrend = bucketCounts(
    reservationsCreated,
    (r) => r.created_at,
    granularity
  );

  const bySource = countBy(
    reservationsCreated,
    (r) => r.source
  );

  const byStatus = countBy(
    reservationsCreated,
    (r) => r.status
  );

  const avgLeadTimeDays = averageLeadTimeDays(materialized);

  // ---- Properties ----
  // Sorted by title (currency-agnostic, stable) rather than by
  // revenue — ranking across properties whose revenue may be in
  // different currencies would mean comparing currencies
  // directly, which the approved rules explicitly forbid.
  const propertiesReport = properties
    .map((p) => {
      const propReservations = materialized.filter(
        (r) => r.property_id === p.id
      );

      const propOccupancyReservations =
        occupancyReservations.filter(
          (r) => r.property_id === p.id
        );

      return {
        propertyId: p.id,
        title: p.title,
        status: p.status,
        reservationCount: propReservations.length,
        revenue: revenueByCurrency(propReservations),
        occupancy: computeOccupancy(
          propOccupancyReservations,
          1,
          start,
          end
        ),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  // ---- Guests ----
  const newGuestsTrend = bucketCounts(
    guestsCreated,
    (g) => g.created_at,
    granularity
  );

  const byCountry = countBy(guestsCreated, (g) => g.country);
  const byLanguage = countBy(
    guestsCreated,
    (g) => g.language
  );

  const repeatGuests = computeRepeatGuests(
    reservationsCreated
  );

  // ---- Cleaning ----
  const cleaningByStatus = countBy(
    cleaningTasks,
    (t) => t.status
  );

  const cleaningByPriority = countBy(
    cleaningTasks,
    (t) => t.priority
  );

  const cleaningByProperty = countBy(
    cleaningTasks,
    (t) => propertyTitleById.get(t.property_id) ?? null
  );

  const avgCompletionHours = averageHoursBetween(
    cleaningTasks.map((t) => ({
      start: t.started_at,
      end: t.completed_at,
    }))
  );

  // ---- Maintenance ----
  const maintenanceByStatus = countBy(
    maintenanceTickets,
    (t) => t.status
  );

  const maintenanceByPriority = countBy(
    maintenanceTickets,
    (t) => t.priority
  );

  // category is stored exactly as free text — grouped as-is,
  // no invented category list.
  const maintenanceByCategory = countBy(
    maintenanceTickets,
    (t) => t.category
  );

  const avgResolutionHours = averageHoursBetween(
    maintenanceTickets.map((t) => ({
      start: t.opened_at,
      end: t.resolved_at,
    }))
  );

  const estimatedCostTotal = sum(
    maintenanceTickets
      .map((t) => t.estimated_cost)
      .filter((c): c is number => c !== null)
  );

  const actualCostTotal = sum(
    maintenanceTickets
      .map((t) => t.actual_cost)
      .filter((c): c is number => c !== null)
  );

  // ---- Inventory ----
  const inventoryByCategory = countBy(
    inventoryItems,
    (i) => i.category
  );

  const lowStockCount = inventoryItems.filter(
    (i) => i.quantity <= i.minimum_quantity
  ).length;

  return {
    period: { start, end, granularity },

    overview: {
      totalReservations: reservationsCreated.length,
      revenue,
      avgLengthOfStay,
      adr,
      cancellationRate: cxRate,
      bookingVolume: reservationsCreated.length,
      occupancyRate: portfolioOccupancy.occupancyRate,
    },

    revenue: {
      trend,
      byCurrency: revenue,
    },

    bookings: {
      volumeTrend,
      bySource,
      byStatus,
      cancellationRate: cxRate,
      avgLengthOfStay,
      avgLeadTimeDays,
    },

    properties: propertiesReport,

    guests: {
      newGuestsTrend,
      vipProportion: vipProportion(guestsCreated),
      byCountry,
      byLanguage,
      repeatGuestCount: repeatGuests.repeatGuestCount,
      repeatGuestRate: repeatGuests.repeatGuestRate,
      uniqueGuestCount: repeatGuests.uniqueGuestCount,
    },

    cleaning: {
      taskVolume: cleaningTasks.length,
      byStatus: cleaningByStatus,
      byPriority: cleaningByPriority,
      avgCompletionHours,
      byProperty: cleaningByProperty,
    },

    maintenance: {
      ticketVolume: maintenanceTickets.length,
      byStatus: maintenanceByStatus,
      byPriority: maintenanceByPriority,
      byCategory: maintenanceByCategory,
      avgResolutionHours,
      estimatedCostTotal,
      actualCostTotal,
      costVariance: round2(
        actualCostTotal - estimatedCostTotal
      ),
    },

    inventory: {
      totalItems: inventoryItems.length,
      lowStockCount,
      byCategory: inventoryByCategory,
    },
  };
}
