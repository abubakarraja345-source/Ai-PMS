/**
 * A provider-neutral representation of one external calendar event
 * (a booking, block, or cancellation) — every adapter must normalize
 * into this shape so the sync service never needs to know which
 * provider produced it.
 */
export interface ExternalEvent {
  externalId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  summary: string | null;
  isCancelled: boolean;
}

export interface ProviderAdapter {
  readonly providerId: string;
  readonly isSupported: boolean;
  fetchEvents(config: { feedUrl: string | null }): Promise<ExternalEvent[]>;
}

export const SUPPORTED_PROVIDERS = [
  "airbnb",
  "booking.com",
  "vrbo",
  "ical",
  "direct",
] as const;

export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(value: string): value is ProviderId {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Maps a provider to the reservation.source value it should produce.
 * reservations.source is an established allowlist (direct/airbnb/
 * booking.com/vrbo/other) — a provider without a direct match (e.g.
 * a generic "ical" feed of unknown origin) maps to "other" rather
 * than inventing a new source value.
 */
export function providerToReservationSource(providerId: string): string {
  if (providerId === "airbnb" || providerId === "booking.com" || providerId === "vrbo") {
    return providerId;
  }

  if (providerId === "direct") {
    return "direct";
  }

  return "other";
}
