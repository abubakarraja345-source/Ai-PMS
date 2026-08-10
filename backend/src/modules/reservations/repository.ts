import { supabase } from "../../config/supabase";
import {
  Reservation,
  ReservationListItem,
} from "./types";
import { CreateReservationInput } from "./validation";

const RESERVATION_SELECT = `
  id,
  organization_id,
  property_id,
  guest_id,
  booking_reference,
  source,
  status,
  check_in,
  check_out,
  adults,
  children,
  infants,
  pets,
  nights,
  total_amount,
  cleaning_fee,
  taxes,
  currency,
  special_requests,
  created_at,
  updated_at,

  property:properties(
    id,
    title
  ),

  guest:guests(
    id,
    first_name,
    last_name,
    email
  )
`;

export async function findReservationsByOrganization(
  organizationId: string
): Promise<ReservationListItem[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("organization_id", organizationId)
    .order("check_in", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  /*
   * Supabase's untyped client (no Database generic passed
   * to createClient) infers embedded relations as arrays by
   * default. At runtime PostgREST returns a single object
   * here because guest_id/property_id are many-to-one FKs —
   * this assertion aligns the type with actual behavior.
   */
  return (data ?? []) as unknown as ReservationListItem[];
}

/**
 * Reservations overlapping [start, end) for calendar/availability
 * views. Checkout is treated as exclusive, matching how `nights`
 * is already computed elsewhere (the checkout day itself is not
 * occupied):
 *
 *   check_in < end AND check_out > start
 *
 * Cancelled reservations are excluded — they don't occupy the
 * property.
 */
export async function findReservationsByOrganizationInRange(
  organizationId: string,
  start: string,
  end: string,
  propertyId?: string
): Promise<ReservationListItem[]> {
  let query = supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("organization_id", organizationId)
    .neq("status", "cancelled")
    .lt("check_in", end)
    .gt("check_out", start)
    .order("check_in", {
      ascending: true,
    });

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as ReservationListItem[];
}

/**
 * Reservations that are either currently staying or still
 * upcoming, as of `fromDate` (inclusive). Drives the dashboard's
 * "today" section and upcoming-reservations list from a single
 * query instead of one query per metric.
 *
 * Only `confirmed`/`pending` reservations count — `cancelled`
 * never occupied the property, and `completed` reservations
 * checking out today/later would be a data inconsistency, not
 * something the dashboard should present as active.
 *
 * Bounded to `limit` rows (ordered by check_in ascending, so a
 * cap only ever drops the furthest-out reservations, not the
 * ones the dashboard actually needs).
 */
export async function findActiveAndUpcomingReservations(
  organizationId: string,
  fromDate: string,
  limit = 200
): Promise<ReservationListItem[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("organization_id", organizationId)
    .in("status", ["confirmed", "pending"])
    .gte("check_out", fromDate)
    .order("check_in", {
      ascending: true,
    })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as ReservationListItem[];
}

/**
 * Most recently created reservations, for the dashboard's
 * recent-activity feed. Includes every status — a cancellation
 * is still activity worth showing.
 */
export async function findRecentReservations(
  organizationId: string,
  limit = 5
): Promise<ReservationListItem[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as ReservationListItem[];
}

export async function findReservationById(
  organizationId: string,
  reservationId: string
): Promise<Reservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as Reservation | null;
}

export async function createReservation(
  organizationId: string,
  input: CreateReservationInput
): Promise<Reservation> {
  const checkIn = new Date(input.check_in);
  const checkOut = new Date(input.check_out);

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) /
      millisecondsPerDay
  );

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      organization_id: organizationId,

      property_id: input.property_id,
      guest_id: input.guest_id,

      booking_reference:
        input.booking_reference,

      source: input.source,

      status:
        input.status ?? "confirmed",

      check_in: input.check_in,
      check_out: input.check_out,

      adults: input.adults ?? 1,
      children: input.children ?? 0,
      infants: input.infants ?? 0,
      pets: input.pets ?? 0,

      nights,

      total_amount:
        input.total_amount ?? null,

      cleaning_fee:
        input.cleaning_fee ?? 0,

      taxes:
        input.taxes ?? 0,

      currency:
        input.currency ?? "USD",

      special_requests:
        input.special_requests ?? null,
    })
    .select(RESERVATION_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as Reservation;
}

export async function updateReservation(
  organizationId: string,
  reservationId: string,
  updates: Record<string, unknown>
): Promise<Reservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .update(updates)
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .select(RESERVATION_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as Reservation | null;
}

export async function deleteReservation(
  organizationId: string,
  reservationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    throw error;
  }

  return !!data && data.length > 0;
}