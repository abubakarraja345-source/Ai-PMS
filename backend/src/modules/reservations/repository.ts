import { supabase } from "../../config/supabase";
import {
  Reservation,
  ReservationListItem,
} from "./types";
import { CreateReservationInput } from "./validation";

export async function findReservationsByOrganization(
  organizationId: string
): Promise<ReservationListItem[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(`
      id,
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
      currency,
      created_at,
      updated_at
    `)
    .eq("organization_id", organizationId)
    .order("check_in", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function findReservationById(
  organizationId: string,
  reservationId: string
): Promise<Reservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
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
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
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
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
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