import { isSupportedProvider } from "./providers/types";

export const INTEGRATION_STATUSES = ["disabled", "active", "error"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

/**
 * Providers connectable through the calendar-connection wizard (Phase
 * E). Deliberately a subset of the wider SUPPORTED_PROVIDERS list —
 * "direct" has no external listing to connect, and every provider
 * here is delivered via iCal only (never an official OTA API; see
 * providers/registry.ts, which has no adapter for airbnb/booking.com/
 * vrbo). "Other" in the UI maps to the existing "ical" value, the
 * same convention property-channel-links-section.tsx already uses
 * ("iCal / Other").
 */
export const CONNECTABLE_PROVIDERS = [
  "airbnb",
  "booking.com",
  "vrbo",
  "ical",
] as const;

export interface ConnectPropertyCalendarInput {
  propertyId: string;
  provider: string;
  externalListingId: string;
  externalListingName: string | null;
  feedUrl: string;
}

export function validateConnectPropertyCalendar(
  input: unknown
): ConnectPropertyCalendarInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.propertyId !== "string" || !data.propertyId.trim()) {
    throw new Error("propertyId is required");
  }

  if (
    typeof data.provider !== "string" ||
    !(CONNECTABLE_PROVIDERS as readonly string[]).includes(data.provider)
  ) {
    throw new Error(
      `provider must be one of: ${CONNECTABLE_PROVIDERS.join(", ")}`
    );
  }

  if (
    typeof data.externalListingId !== "string" ||
    !data.externalListingId.trim()
  ) {
    throw new Error("externalListingId is required");
  }

  if (
    data.externalListingName !== undefined &&
    data.externalListingName !== null &&
    typeof data.externalListingName !== "string"
  ) {
    throw new Error("externalListingName must be a string or null");
  }

  if (typeof data.feedUrl !== "string" || !data.feedUrl.trim()) {
    throw new Error("feedUrl is required");
  }

  return {
    propertyId: data.propertyId.trim(),
    provider: data.provider,
    externalListingId: data.externalListingId.trim(),
    externalListingName:
      typeof data.externalListingName === "string"
        ? data.externalListingName.trim() || null
        : null,
    feedUrl: data.feedUrl.trim(),
  };
}

export interface CreateIntegrationInput {
  provider: string;
  accountName: string | null;
  feedUrl: string | null;
}

export function validateCreateIntegration(
  input: unknown
): CreateIntegrationInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.provider !== "string" || !isSupportedProvider(data.provider)) {
    throw new Error(
      "provider must be one of: airbnb, booking.com, vrbo, ical, direct"
    );
  }

  if (
    data.accountName !== undefined &&
    data.accountName !== null &&
    typeof data.accountName !== "string"
  ) {
    throw new Error("accountName must be a string or null");
  }

  if (
    data.feedUrl !== undefined &&
    data.feedUrl !== null &&
    typeof data.feedUrl !== "string"
  ) {
    throw new Error("feedUrl must be a string or null");
  }

  return {
    provider: data.provider,
    accountName:
      typeof data.accountName === "string"
        ? data.accountName.trim() || null
        : null,
    feedUrl:
      typeof data.feedUrl === "string" ? data.feedUrl.trim() || null : null,
  };
}

export interface UpdateIntegrationInput {
  accountName?: string | null;
  feedUrl?: string | null;
  externalListingName?: string | null;
}

export function validateUpdateIntegration(
  input: unknown
): UpdateIntegrationInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;
  const updates: UpdateIntegrationInput = {};

  if (data.accountName !== undefined) {
    if (data.accountName !== null && typeof data.accountName !== "string") {
      throw new Error("accountName must be a string or null");
    }

    updates.accountName =
      typeof data.accountName === "string"
        ? data.accountName.trim() || null
        : null;
  }

  if (data.feedUrl !== undefined) {
    if (data.feedUrl !== null && typeof data.feedUrl !== "string") {
      throw new Error("feedUrl must be a string or null");
    }

    updates.feedUrl =
      typeof data.feedUrl === "string" ? data.feedUrl.trim() || null : null;
  }

  if (data.externalListingName !== undefined) {
    if (
      data.externalListingName !== null &&
      typeof data.externalListingName !== "string"
    ) {
      throw new Error("externalListingName must be a string or null");
    }

    updates.externalListingName =
      typeof data.externalListingName === "string"
        ? data.externalListingName.trim() || null
        : null;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields provided to update");
  }

  return updates;
}
