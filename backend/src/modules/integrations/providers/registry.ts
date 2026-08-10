import { icalAdapter } from "./ical.adapter";
import { ProviderAdapter, ProviderId } from "./types";

/**
 * Real, working adapters only. Airbnb/Booking.com/VRBO are listed
 * as supported *providers* (SUPPORTED_PROVIDERS) so the UI/API can
 * reference them, but have no adapter here — no credentials or API
 * access exist for them, so we never pretend a connection works.
 * Attempting to sync one of these returns a clear "not yet
 * supported" error instead of fabricating a result.
 */
const ADAPTERS: Partial<Record<ProviderId, ProviderAdapter>> = {
  ical: icalAdapter,
};

export function getProviderAdapter(
  providerId: ProviderId
): ProviderAdapter | null {
  return ADAPTERS[providerId] ?? null;
}
