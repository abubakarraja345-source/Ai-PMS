import { supabase } from "../../config/supabase";

export interface ReservationAnalyticsRow {
  id: string;
  property_id: string;
  guest_id: string;
  source: string;
  status: string;
  check_in: string;
  check_out: string;
  nights: number | null;
  total_amount: number | null;
  currency: string | null;
  created_at: string;
}

export interface OccupancyReservationRow {
  property_id: string;
  check_in: string;
  check_out: string;
}

export interface PropertyRow {
  id: string;
  title: string;
  status: string;
}

export interface GuestAnalyticsRow {
  id: string;
  vip: boolean;
  country: string | null;
  language: string | null;
  created_at: string;
}

export interface CleaningAnalyticsRow {
  id: string;
  property_id: string;
  status: string;
  priority: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface MaintenanceAnalyticsRow {
  id: string;
  property_id: string;
  status: string;
  priority: string;
  category: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  opened_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

/**
 * Reports uses its own lean, purpose-built SELECTs rather than
 * reusing reservations/repository.ts's RESERVATION_SELECT —
 * aggregation only needs raw scalar columns (ids/dates/amounts),
 * not the full property/guest join every other module needs for
 * display. This avoids fetching and discarding join data across
 * what can be a much larger row set (a whole date range) than a
 * single list/detail view.
 *
 * "Booking-based" metrics (everything except occupancy) are
 * scoped to reservations *created* within [start, end) — i.e.
 * "reservations booked in this period." Occupancy is the one
 * exception, scoped by stay dates instead (see
 * findReservationsOverlappingRange), because occupancy is
 * inherently about which nights were occupied, not when the
 * booking was made.
 */
export async function findReservationsCreatedInRange(
  organizationId: string,
  startTimestamp: string,
  endTimestampExclusive: string
): Promise<ReservationAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, property_id, guest_id, source, status, check_in, check_out, nights, total_amount, currency, created_at"
    )
    .eq("organization_id", organizationId)
    .gte("created_at", startTimestamp)
    .lt("created_at", endTimestampExclusive);

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Reservations overlapping [start, end) for range-based
 * occupancy. Only confirmed/pending count (approved rule);
 * cancelled reservations never occupied the property.
 */
export async function findReservationsOverlappingRange(
  organizationId: string,
  start: string,
  end: string
): Promise<OccupancyReservationRow[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select("property_id, check_in, check_out")
    .eq("organization_id", organizationId)
    .in("status", ["confirmed", "pending"])
    .lt("check_in", end)
    .gt("check_out", start);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function findPropertiesForOrganization(
  organizationId: string
): Promise<PropertyRow[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, title, status")
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export interface InventoryAnalyticsRow {
  id: string;
  category: string | null;
  quantity: number;
  minimum_quantity: number;
}

/**
 * Current inventory state, not date-range scoped — stock levels
 * are a point-in-time snapshot, not an event created within a
 * range (same reasoning as `findPropertiesForOrganization` above).
 */
export async function findInventoryForOrganization(
  organizationId: string
): Promise<InventoryAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, category, quantity, minimum_quantity")
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function findGuestsCreatedInRange(
  organizationId: string,
  startTimestamp: string,
  endTimestampExclusive: string
): Promise<GuestAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("guests")
    .select("id, vip, country, language, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", startTimestamp)
    .lt("created_at", endTimestampExclusive);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function findCleaningTasksCreatedInRange(
  organizationId: string,
  startTimestamp: string,
  endTimestampExclusive: string
): Promise<CleaningAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("cleaning_tasks")
    .select(
      "id, property_id, status, priority, started_at, completed_at, created_at"
    )
    .eq("organization_id", organizationId)
    .gte("created_at", startTimestamp)
    .lt("created_at", endTimestampExclusive);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function findMaintenanceTicketsCreatedInRange(
  organizationId: string,
  startTimestamp: string,
  endTimestampExclusive: string
): Promise<MaintenanceAnalyticsRow[]> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select(
      "id, property_id, status, priority, category, estimated_cost, actual_cost, opened_at, resolved_at, created_at"
    )
    .eq("organization_id", organizationId)
    .gte("created_at", startTimestamp)
    .lt("created_at", endTimestampExclusive);

  if (error) {
    throw error;
  }

  return data ?? [];
}
