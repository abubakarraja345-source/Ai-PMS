/**
 * Airbnb Official API — Phase 6A foundation.
 *
 * Deliberately a SEPARATE concept from the existing iCal provider
 * system (providers/types.ts's SUPPORTED_PROVIDERS/ProviderAdapter).
 * "airbnb_api" is never added to that list — it must never be routed
 * through getProviderAdapter (which is iCal-only by design; see that
 * file's own comment). An "airbnb_api" integrations row is
 * distinguished from an "airbnb" (iCal) row purely by this provider
 * string; the two coexist independently for the same organization.
 */
export const AIRBNB_API_PROVIDER = "airbnb_api" as const;

/** Reservation.source value Airbnb-API-imported bookings get — same
 * value iCal-sourced Airbnb bookings already use (source represents
 * the OTA brand, not the sync mechanism; see providers/types.ts's
 * providerToReservationSource for the existing precedent). */
export const AIRBNB_API_RESERVATION_SOURCE = "airbnb";

/** booking_reference namespace prefix, mirroring the existing
 * `ical:{integrationId}:{externalId}` convention (sync.repository.ts)
 * so dedup/re-sync detection works identically but never collides
 * with an iCal-imported row for the same external event. */
export function airbnbApiBookingReference(
  integrationId: string,
  externalId: string
): string {
  return `airbnb_api:${integrationId}:${externalId}`;
}

/**
 * Provider-neutral-ish normalized shapes — normalize.ts converts raw
 * adapter responses into these before anything touches the PMS
 * domain, so Airbnb-specific field names never leak past this
 * module. Fields are deliberately conservative (only what a listing
 * connection screen and reservation sync actually need) rather than a
 * speculative full mirror of Airbnb's data model.
 */
export interface AirbnbListing {
  externalListingId: string;
  name: string;
  address: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  /** Phase 6B — richer discovery/import fields. All optional: a real
   * adapter only ever populates what Airbnb's actual listing response
   * contains for a given account/listing; never fabricated when
   * absent (see Phase 6B spec's "Property Import" section). */
  description?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  propertyType?: string | null;
  listingUrl?: string | null;
  currency?: string | null;
}

export interface AirbnbReservation {
  externalReservationId: string;
  externalListingId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  status: "accepted" | "cancelled" | "pending";
  guestName: string | null;
  guestEmail: string | null;
  adults: number | null;
  children: number | null;
  totalAmount: number | null;
  currency: string | null;
}

export interface AirbnbTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null; // ISO timestamp
  externalAccountId: string | null;
  accountName: string | null;
}

/**
 * Every method here corresponds to a capability the connect/import/
 * sync pipeline actually calls — not a speculative full mirror of the
 * Airbnb API surface (see Phase 6A architecture report on avoiding
 * overbuilding). Implementations MUST throw AirbnbApiNotConfiguredError
 * rather than fabricate a response when the real request/response
 * contract cannot be verified — see adapter.ts.
 */
export interface AirbnbApiAdapter {
  readonly isMock: boolean;

  /** Builds the redirect URL for the OAuth authorization-code flow.
   * This part IS safe to implement for real once client/redirect/
   * authorization-URL config is present — it's the standard OAuth 2.0
   * (RFC 6749) authorization request shape, not an Airbnb-specific
   * invented contract. */
  getAuthorizationUrl(state: string): string;

  exchangeAuthorizationCode(code: string): Promise<AirbnbTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<AirbnbTokenSet>;
  getListings(accessToken: string): Promise<AirbnbListing[]>;
  getReservations(
    accessToken: string,
    externalListingId: string,
    since: string | null
  ): Promise<AirbnbReservation[]>;
  revoke(accessToken: string): Promise<void>;
}

/** Thrown by every adapter method whose real request/response contract
 * has not been verified against authoritative Airbnb documentation —
 * the explicit "STOP" boundary from the Phase 6A spec, never silently
 * swallowed into a fake success. */
export class AirbnbApiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AirbnbApiNotConfiguredError";
  }
}
