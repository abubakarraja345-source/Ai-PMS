import { isSupportedProvider } from "./providers/types";

export const INTEGRATION_STATUSES = ["disabled", "active", "error"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

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

  if (Object.keys(updates).length === 0) {
    throw new Error("No valid fields provided to update");
  }

  return updates;
}
