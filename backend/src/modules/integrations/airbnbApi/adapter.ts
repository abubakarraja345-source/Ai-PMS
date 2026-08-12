import { env } from "../../../config/env";
import {
  AirbnbApiAdapter,
  AirbnbApiNotConfiguredError,
  AirbnbListing,
  AirbnbReservation,
  AirbnbTokenSet,
} from "./types";

/**
 * The REAL adapter — the one that would eventually talk to Airbnb's
 * actual API. Every data-fetching/token method throws
 * AirbnbApiNotConfiguredError unconditionally: this implementation has
 * no verified, authoritative Airbnb API documentation to build a
 * correct request/response contract from (exact endpoint paths, field
 * names, auth header format, error shapes), and Section 6/27 of the
 * Phase 6A spec is explicit that inventing one is worse than not
 * having it. This is the deliberate "STOP" boundary — the rest of the
 * pipeline (OAuth redirect, state validation, storage, listing
 * import UI, reservation normalization, sync scheduling) is fully
 * built and tested against the mock adapter; only the real HTTP calls
 * to Airbnb itself are missing, pending official partner/API access.
 *
 * getAuthorizationUrl is the one exception — the OAuth 2.0
 * authorization-request shape (client_id/redirect_uri/response_type/
 * state as query params to an authorization endpoint) is a public
 * IETF standard (RFC 6749 §4.1.1), not Airbnb-specific invented
 * knowledge, so it's safe to build for real once an operator has
 * supplied their own AIRBNB_AUTHORIZATION_URL/AIRBNB_CLIENT_ID/
 * AIRBNB_REDIRECT_URI.
 */

export function isAirbnbApiConfigured(): boolean {
  return Boolean(
    env.airbnbClientId &&
      env.airbnbClientSecret &&
      env.airbnbRedirectUri &&
      env.airbnbAuthorizationUrl &&
      env.airbnbTokenUrl
  );
}

function assertConfigured(): void {
  if (!isAirbnbApiConfigured()) {
    throw new AirbnbApiNotConfiguredError(
      "Airbnb API credentials are not configured. Set AIRBNB_CLIENT_ID, AIRBNB_CLIENT_SECRET, AIRBNB_REDIRECT_URI, AIRBNB_AUTHORIZATION_URL, and AIRBNB_TOKEN_URL."
    );
  }
}

function notImplemented(capability: string): never {
  throw new AirbnbApiNotConfiguredError(
    `Airbnb API capability not configured: ${capability}. This requires a verified request/response contract from official Airbnb API documentation, which is not available to this build — see the Phase 6A architecture report.`
  );
}

export const airbnbApiAdapter: AirbnbApiAdapter = {
  isMock: false,

  getAuthorizationUrl(state: string): string {
    assertConfigured();

    const url = new URL(env.airbnbAuthorizationUrl!);
    url.searchParams.set("client_id", env.airbnbClientId!);
    url.searchParams.set("redirect_uri", env.airbnbRedirectUri!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);

    return url.toString();
  },

  async exchangeAuthorizationCode(): Promise<AirbnbTokenSet> {
    assertConfigured();
    return notImplemented("exchangeAuthorizationCode (token endpoint)");
  },

  async refreshAccessToken(): Promise<AirbnbTokenSet> {
    assertConfigured();
    return notImplemented("refreshAccessToken (token endpoint)");
  },

  async getListings(): Promise<AirbnbListing[]> {
    assertConfigured();
    return notImplemented("getListings");
  },

  async getReservations(): Promise<AirbnbReservation[]> {
    assertConfigured();
    return notImplemented("getReservations");
  },

  async revoke(): Promise<void> {
    assertConfigured();
    return notImplemented("revoke (token revocation endpoint)");
  },
};
