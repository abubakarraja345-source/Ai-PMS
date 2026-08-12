import { isSupportedProvider } from "./providers/types";

export interface CreateChannelLinkInput {
  propertyId: string;
  provider: string;
  externalListingId: string;
}

/**
 * Reuses the same provider vocabulary as integrations/validation.ts's
 * validateCreateIntegration — one list of supported providers for the
 * whole module, not a second one invented here.
 */
export function validateCreateChannelLink(
  input: unknown
): CreateChannelLinkInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid request body");
  }

  const data = input as Record<string, unknown>;

  if (typeof data.propertyId !== "string" || !data.propertyId.trim()) {
    throw new Error("propertyId is required");
  }

  if (typeof data.provider !== "string" || !isSupportedProvider(data.provider)) {
    throw new Error(
      "provider must be one of: airbnb, booking.com, vrbo, ical, direct"
    );
  }

  if (
    typeof data.externalListingId !== "string" ||
    !data.externalListingId.trim()
  ) {
    throw new Error("externalListingId is required");
  }

  const externalListingId = data.externalListingId.trim();

  if (externalListingId.length > 200) {
    throw new Error("externalListingId must be 200 characters or fewer");
  }

  return {
    propertyId: data.propertyId.trim(),
    provider: data.provider,
    externalListingId,
  };
}
