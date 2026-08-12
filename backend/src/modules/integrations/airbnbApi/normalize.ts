import { CreateReservationInput } from "../../reservations/validation";
import { AirbnbReservation, airbnbApiBookingReference } from "./types";

/**
 * The Normalization Layer between the Airbnb connector and the
 * existing PMS reservation domain — converts an already-adapter-
 * normalized AirbnbReservation into the exact CreateReservationInput
 * shape the existing reservations/service.ts already validates and
 * persists, so nothing Airbnb-specific ever leaks past this function.
 * currency/property_id/guest_id are resolved by the caller (service.ts)
 * using the SAME effective-currency and property-lock rules every
 * other reservation source already uses — never invented here.
 */
export function normalizeAirbnbReservation(
  reservation: AirbnbReservation,
  integrationId: string,
  propertyId: string,
  guestId: string
): CreateReservationInput {
  return {
    property_id: propertyId,
    guest_id: guestId,
    booking_reference: airbnbApiBookingReference(
      integrationId,
      reservation.externalReservationId
    ),
    source: "airbnb",
    status: reservation.status === "cancelled" ? "cancelled" : "confirmed",
    check_in: reservation.checkIn,
    check_out: reservation.checkOut,
    adults: reservation.adults ?? 1,
    children: reservation.children ?? 0,
    infants: 0,
    pets: 0,
    total_amount: reservation.totalAmount,
    cleaning_fee: 0,
    taxes: 0,
    // Never trusted from the adapter directly — addReservation always
    // overwrites this with the property's effective currency, exactly
    // like every other reservation source (see reservations/service.ts).
    currency: null,
    amount_base: null,
    base_currency: null,
    exchange_rate: null,
    special_requests: null,
  };
}
