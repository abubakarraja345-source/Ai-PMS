import { env } from "../../../config/env";
import {
  AirbnbApiAdapter,
  AirbnbListing,
  AirbnbReservation,
  AirbnbTokenSet,
} from "./types";

/**
 * A development-only adapter for exercising the connect → import →
 * map → sync pipeline without a real Airbnb connection — everything
 * it returns is clearly labeled "[MOCK]" so it can never be mistaken
 * for real data if it somehow surfaced in a UI. Used exclusively by
 * this project's own regression tests and local manual testing.
 *
 * Guarded so it is structurally impossible to select in production:
 * requires BOTH NODE_ENV !== "production" AND an explicit opt-in env
 * var. adapter.ts (the real adapter) never imports or references this
 * file at all, so a production build has zero code path that could
 * accidentally reach it even if the guard were bypassed.
 */
export function isMockAdapterAllowed(): boolean {
  return (
    env.nodeEnv !== "production" &&
    process.env.AIRBNB_USE_MOCK_ADAPTER === "true"
  );
}

const MOCK_LISTINGS: AirbnbListing[] = [
  {
    externalListingId: "mock-listing-1",
    name: "[MOCK] Downtown Apartment",
    address: "123 Mock Street, Testville",
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    description: "[MOCK] A cozy downtown apartment for testing import.",
    city: "Testville",
    country: "PK",
    latitude: 33.6844,
    longitude: 73.0479,
    propertyType: "apartment",
    listingUrl: "https://www.airbnb.com/rooms/mock-listing-1",
    currency: "USD",
  },
  {
    externalListingId: "mock-listing-2",
    name: "[MOCK] Lakeview Villa",
    address: "45 Mock Lake Road, Testville",
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 8,
    description: null,
    city: "Testville",
    country: "PK",
    latitude: null,
    longitude: null,
    propertyType: "villa",
    listingUrl: "https://www.airbnb.com/rooms/mock-listing-2",
    currency: null,
  },
];

export const airbnbMockAdapter: AirbnbApiAdapter = {
  isMock: true,

  getAuthorizationUrl(state: string): string {
    return `http://localhost:5000/api/integrations/airbnb/mock-authorize?state=${encodeURIComponent(state)}`;
  },

  async exchangeAuthorizationCode(code: string): Promise<AirbnbTokenSet> {
    return {
      accessToken: `mock-access-token-${code}`,
      refreshToken: `mock-refresh-token-${code}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      externalAccountId: "mock-account-1",
      accountName: "[MOCK] Airbnb Host Account",
    };
  },

  async refreshAccessToken(refreshToken: string): Promise<AirbnbTokenSet> {
    return {
      accessToken: `mock-access-token-refreshed-${Date.now()}`,
      refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      externalAccountId: "mock-account-1",
      accountName: "[MOCK] Airbnb Host Account",
    };
  },

  async getListings(): Promise<AirbnbListing[]> {
    return MOCK_LISTINGS;
  },

  async getReservations(
    _accessToken: string,
    externalListingId: string
  ): Promise<AirbnbReservation[]> {
    // Deliberately STABLE across repeated calls for the same listing
    // (same externalReservationId every time) — a real API's
    // getReservations would return the same reservation on every poll
    // until it actually changes, and the sync pipeline's dedup logic
    // (matching on booking_reference) depends on that. A counter-based
    // id here would make every sync look like a brand-new booking and
    // silently defeat the exact duplicate-prevention behavior this
    // mock exists to test.
    return [
      {
        externalReservationId: `mock-res-${externalListingId}-1`,
        externalListingId,
        checkIn: "2029-11-10",
        checkOut: "2029-11-14",
        status: "accepted",
        guestName: "Mock Guest",
        guestEmail: null,
        adults: 2,
        children: 0,
        totalAmount: 480,
        currency: "USD",
      },
    ];
  },

  async revoke(): Promise<void> {
    // No-op — nothing external to revoke.
  },
};
