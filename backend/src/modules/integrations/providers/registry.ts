import { icalAdapter } from "./ical.adapter";
import { ProviderAdapter, ProviderId } from "./types";

/**
 * Real, working adapters only — every one of them is the SAME
 * icalAdapter, never a real Airbnb/Booking.com/VRBO API client (none
 * exist; no credentials are configured for any of them). This phase
 * makes airbnb/booking.com/vrbo connectable exclusively via iCal feed
 * URL (see integrations/validation.ts's CONNECTABLE_PROVIDERS) — the
 * `provider` value on a connection is a business label ("which OTA is
 * this calendar from") for display/reservation-source purposes only,
 * never a selector for a different fetch mechanism. Routing all four
 * to the identical adapter keeps that honest: syncing an "airbnb"
 * connection does exactly what syncing an "ical" one always did —
 * fetch and parse a calendar URL — never a live API call. If a real
 * Airbnb/Booking.com/VRBO API integration is ever built, it gets its
 * own distinct adapter here instead of overwriting this entry.
 */
const ADAPTERS: Partial<Record<ProviderId, ProviderAdapter>> = {
  ical: icalAdapter,
  airbnb: icalAdapter,
  "booking.com": icalAdapter,
  vrbo: icalAdapter,
};

export function getProviderAdapter(
  providerId: ProviderId
): ProviderAdapter | null {
  return ADAPTERS[providerId] ?? null;
}
